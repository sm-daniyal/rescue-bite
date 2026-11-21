import asyncio
from datetime import datetime, time, timedelta
import json
from pathlib import Path
import yaml

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, create_all_tables
from app.models import (
    BreakWindow,
    FlashDeal,
    InventorySnapshot,
    MenuItem,
    Restaurant,
    Student,
    SurplusEvent,
)

SEED_DIR = Path(__file__).resolve().parent


def _parse_time(t_str: str) -> time:
    parts = t_str.split(":")
    return time(int(parts[0]), int(parts[1]))


async def seed_all(db: AsyncSession) -> dict[str, int]:
    # 1. Restaurants
    with open(SEED_DIR / "restaurants.json", "r", encoding="utf-8") as f:
        restaurants_data = json.load(f)

    r_count = 0
    for r in restaurants_data:
        existing = await db.get(Restaurant, r["id"])
        if not existing:
            db.add(Restaurant(**r))
            r_count += 1
    await db.commit()

    # 2. Menu Items
    with open(SEED_DIR / "menu_items.json", "r", encoding="utf-8") as f:
        items_data = json.load(f)

    m_count = 0
    for item in items_data:
        existing = await db.get(MenuItem, item["id"])
        if not existing:
            db.add(MenuItem(**item))
            m_count += 1
    await db.commit()

    # 3. Break Windows
    with open(SEED_DIR / "break_windows.json", "r", encoding="utf-8") as f:
        windows_data = json.load(f)

    w_count = 0
    for w in windows_data:
        existing = await db.get(BreakWindow, w["id"])
        if not existing:
            db.add(
                BreakWindow(
                    id=w["id"],
                    college_id=w.get("college_id", 1),
                    label=w["label"],
                    start_time=_parse_time(w["start_time"]),
                    end_time=_parse_time(w["end_time"]),
                    days_of_week=w.get("days_of_week", "1,2,3,4,5"),
                )
            )
            w_count += 1
    await db.commit()

    # 4. Students
    if (SEED_DIR / "students.json").exists():
        with open(SEED_DIR / "students.json", "r", encoding="utf-8") as f:
            students_data = json.load(f)
        for s in students_data:
            existing = await db.get(Student, s["id"])
            if not existing:
                db.add(Student(**s))
        await db.commit()

    # 5. Inventory Snapshots & Demo Scenarios
    scenarios_path = SEED_DIR / "demo_scenarios.yaml"
    now = datetime.now()
    if scenarios_path.exists():
        with open(scenarios_path, "r", encoding="utf-8") as f:
            scenarios_data = yaml.safe_load(f).get("scenarios", {})

        for s_key, s_val in scenarios_data.items():
            item_id = s_val["item_id"]
            rest_id = s_val["restaurant_id"]
            qty = s_val["surplus_quantity"]
            avg_sold = s_val["avg_daily_sold"]
            score = s_val.get("score", 0.85)
            gemini_cached = s_val.get("cached_gemini_response", {})
            discount_pct = gemini_cached.get("discount_pct", 40)
            reasoning = gemini_cached.get("reasoning", "Surplus clearance deal.")

            # Create inventory snapshot
            snap = InventorySnapshot(
                restaurant_id=rest_id,
                item_id=item_id,
                timestamp=now,
                quantity_available=qty,
                avg_daily_sold=avg_sold,
                confidence_score=0.85,
            )
            db.add(snap)
            await db.flush()

            # Ensure an active SurplusEvent + FlashDeal exists for this demo scenario
            res_event = await db.execute(
                select(SurplusEvent).where(
                    SurplusEvent.item_id == item_id,
                    SurplusEvent.status == "active",
                )
            )
            existing_event = res_event.scalar_one_or_none()
            if not existing_event:
                window_min = s_val.get("window_minutes", 45)
                event = SurplusEvent(
                    restaurant_id=rest_id,
                    item_id=item_id,
                    triggered_at=now,
                    expires_at=now + timedelta(minutes=window_min),
                    status="active",
                    score=score,
                )
                db.add(event)
                await db.flush()

                deal = FlashDeal(
                    surplus_event_id=event.id,
                    discount_pct=discount_pct,
                    ai_recommended_discount=discount_pct,
                    gemini_reasoning_snippet=reasoning,
                    deal_window_start=now,
                    deal_window_end=now + timedelta(minutes=window_min),
                )
                db.add(deal)

        await db.commit()

    return {"restaurants": r_count, "items": m_count, "windows": w_count}


async def main() -> None:
    await create_all_tables()
    async with AsyncSessionLocal() as session:
        await seed_all(session)
        # Fetch current total counts
        r_total = len((await session.execute(select(Restaurant))).scalars().all())
        m_total = len((await session.execute(select(MenuItem))).scalars().all())
        w_total = len((await session.execute(select(BreakWindow))).scalars().all())

    print(f"Seeded {r_total} restaurants, {m_total} items, {w_total} break windows")


if __name__ == "__main__":
    asyncio.run(main())
