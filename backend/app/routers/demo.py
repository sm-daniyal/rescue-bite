from datetime import datetime, timedelta
import logging
from pathlib import Path
from typing import Any
import yaml

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import FlashDeal, InventorySnapshot, SurplusEvent
from app.schemas import FlashDealOut, MenuItemOut, RestaurantOut
from app.services.sse_dispatcher import dispatcher

logger = logging.getLogger(__name__)

router = APIRouter()

SCENARIOS_FILE = Path(__file__).resolve().parent.parent.parent / "seed" / "demo_scenarios.yaml"


def _load_scenario(scenario_id: str) -> tuple[str, dict[str, Any]]:
    clean_id = scenario_id.lower().strip()
    if clean_id in ["a", "scenario_a"]:
        key = "scenario_a"
    elif clean_id in ["b", "scenario_b"]:
        key = "scenario_b"
    elif clean_id in ["c", "scenario_c"]:
        key = "scenario_c"
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown scenario '{scenario_id}'. Available: A, B, C",
        )

    if not SCENARIOS_FILE.exists():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="demo_scenarios.yaml fixture file not found",
        )

    with open(SCENARIOS_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    scenarios = data.get("scenarios", {})
    if key not in scenarios:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario key '{key}' not found in demo_scenarios.yaml",
        )

    return key, scenarios[key]


@router.get("/scenarios")
async def list_scenarios() -> dict[str, Any]:
    """Returns all scripted scenarios with pre-cached Gemini reasoning for judges."""
    if settings.environment != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo endpoints are disabled in production",
        )

    if not SCENARIOS_FILE.exists():
        return {"scenarios": {}}

    with open(SCENARIOS_FILE, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return data


@router.post("/trigger-scenario/{scenario_id}")
async def trigger_scenario(
    scenario_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Judge Walkthrough Trigger Endpoint.
    Instantly provisions an active SurplusEvent + FlashDeal using pre-cached
    Gemini responses (offline-safe), then fans out SSE to all connected clients.
    """
    if settings.environment != "development":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo endpoints are disabled in production",
        )

    key, s_data = _load_scenario(scenario_id)

    item_id = s_data["item_id"]
    rest_id = s_data["restaurant_id"]
    qty = s_data["surplus_quantity"]
    avg_sold = s_data["avg_daily_sold"]
    window_min = s_data.get("window_minutes", 45)
    score = s_data.get("score", 0.85)

    gemini_cached = s_data.get("cached_gemini_response", {})
    discount_pct = gemini_cached.get("discount_pct", 40)
    reasoning = gemini_cached.get("reasoning", "Surplus clearance pricing applied.")

    now = datetime.now()
    expires_at = now + timedelta(minutes=window_min)

    # 1. Update/Add inventory snapshot
    snap = InventorySnapshot(
        restaurant_id=rest_id,
        item_id=item_id,
        timestamp=now,
        quantity_available=qty,
        avg_daily_sold=avg_sold,
        confidence_score=0.90,
    )
    db.add(snap)
    await db.flush()

    # 2. Check if deal already exists for this item; update or create
    res_event = await db.execute(
        select(SurplusEvent)
        .where(SurplusEvent.item_id == item_id)
        .order_by(SurplusEvent.triggered_at.desc())
    )
    existing_event = res_event.scalars().first()

    if existing_event:
        existing_event.status = "active"
        existing_event.triggered_at = now
        existing_event.expires_at = expires_at
        existing_event.score = score
        event = existing_event

        # Ensure FlashDeal is updated
        res_deal = await db.execute(select(FlashDeal).where(FlashDeal.surplus_event_id == event.id))
        deal = res_deal.scalar_one_or_none()
        if deal:
            deal.discount_pct = discount_pct
            deal.ai_recommended_discount = discount_pct
            deal.gemini_reasoning_snippet = reasoning
            deal.deal_window_start = now
            deal.deal_window_end = expires_at
        else:
            deal = FlashDeal(
                surplus_event_id=event.id,
                discount_pct=discount_pct,
                ai_recommended_discount=discount_pct,
                gemini_reasoning_snippet=reasoning,
                deal_window_start=now,
                deal_window_end=expires_at,
            )
            db.add(deal)
    else:
        event = SurplusEvent(
            restaurant_id=rest_id,
            item_id=item_id,
            triggered_at=now,
            expires_at=expires_at,
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
            deal_window_end=expires_at,
        )
        db.add(deal)

    await db.commit()
    await db.refresh(deal)

    # 3. Load full restaurant and item relations for SSE payload
    stmt_full = (
        select(FlashDeal)
        .where(FlashDeal.id == deal.id)
        .options(
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.restaurant),
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.item),
        )
    )
    res_full = await db.execute(stmt_full)
    deal_full = res_full.scalar_one()

    deal_out = FlashDealOut(
        id=deal_full.id,
        surplus_event_id=deal_full.surplus_event_id,
        discount_pct=deal_full.discount_pct,
        ai_recommended_discount=deal_full.ai_recommended_discount,
        gemini_reasoning_snippet=deal_full.gemini_reasoning_snippet,
        deal_window_start=deal_full.deal_window_start,
        deal_window_end=deal_full.deal_window_end,
        restaurant=RestaurantOut.model_validate(deal_full.surplus_event.restaurant) if deal_full.surplus_event.restaurant else None,
        item=MenuItemOut.model_validate(deal_full.surplus_event.item) if deal_full.surplus_event.item else None,
    )

    # 4. Fan-out SSE to connected students
    deal_dict = deal_out.model_dump(mode="json")
    if key == "scenario_b":
        # Scenario B triggers Break Bell notification
        await dispatcher.fan_out_to_students({
            "type": "break_bell",
            "deal_count": 1,
            "deals": [deal_dict],
        })
    else:
        # Standard deal push
        await dispatcher.fan_out_to_students({
            "type": "new_deal",
            "deal": deal_dict,
        })

    logger.info("Demo scenario '%s' successfully triggered (deal #%d)", key, deal.id)

    return {
        "status": "triggered",
        "scenario": key,
        "name": s_data.get("name"),
        "deal_id": deal.id,
        "restaurant": s_data.get("restaurant_name"),
        "item": s_data.get("item_name"),
        "discount_pct": discount_pct,
        "reasoning": reasoning,
        "offline_cached": True,
    }
