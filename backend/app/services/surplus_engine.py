"""
Surplus Rule Engine for RescueBite.

Computes a deterministic surplus score based on:
1. Campus Break Proximity (40%)
2. Inventory Surplus Ratio (40%)
3. Time of Day Weight (20%)

Threshold >= 0.65 triggers a SurplusEvent and generates a FlashDeal.
"""

from datetime import datetime, timedelta
import logging
from typing import Sequence

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import BreakWindow, FlashDeal, InventorySnapshot, MenuItem, SurplusEvent
from app.services.gemini_client import recommend_discount_for_event

logger = logging.getLogger(__name__)


# ── Component 1: Break Proximity Score (40%) ──────────────────────────────────

def break_proximity_score(now: datetime, windows: Sequence[BreakWindow]) -> float:
    """
    Score how close the current time is to a campus break window.
    - 1.0 if current time falls inside a break window.
    - Decays linearly from 1.0 (at T-0) to 0.0 (at T-120 minutes before start).
    - 0.0 if more than 120 minutes before or after a window.
    """
    if not windows:
        return 0.5  # fallback neutral if no break windows configured

    weekday = str(now.isoweekday())  # 1 = Monday ... 7 = Sunday
    best_score = 0.0

    for w in windows:
        # Check if window applies today
        allowed_days = [d.strip() for d in (w.days_of_week or "1,2,3,4,5").split(",")]
        if weekday not in allowed_days:
            continue

        start_dt = datetime.combine(now.date(), w.start_time)
        end_dt = datetime.combine(now.date(), w.end_time)

        # Inside the break window
        if start_dt <= now <= end_dt:
            return 1.0

        # Before the window starts
        if now < start_dt:
            diff_min = (start_dt - now).total_seconds() / 60.0
            if diff_min <= 120.0:
                score = max(0.0, 1.0 - (diff_min / 120.0))
                if score > best_score:
                    best_score = score

    return round(best_score, 3)


# ── Component 2: Surplus Ratio Score (40%) ────────────────────────────────────

def surplus_ratio_score(quantity_available: int, avg_daily_sold: float) -> float:
    """
    Score how much inventory remains relative to typical daily velocity.
    - ratio < 0.3: 0.0 (normal operations, healthy inventory).
    - ratio >= 2.0: 1.0 (heavy excess surplus, 2x+ typical sales).
    - In between: linear interpolation.
    """
    denom = max(float(avg_daily_sold), 1.0)
    ratio = max(0.0, float(quantity_available)) / denom

    if ratio < 0.3:
        return 0.0
    if ratio >= 2.0:
        return 1.0

    score = (ratio - 0.3) / (2.0 - 0.3)
    return round(min(1.0, max(0.0, score)), 3)


# ── Component 3: Time of Day Weight (20%) ─────────────────────────────────────

def time_of_day_weight(now: datetime) -> float:
    """
    Post-peak meal windows (post-lunch, evening, post-dinner) receive the highest
    weights because restaurants are most likely to have unconsumed prepared stock.
    """
    hour = now.hour
    minute = now.minute
    time_float = hour + (minute / 60.0)

    # Post-lunch trough (14:00 - 16:30): high excess likelihood
    if 14.0 <= time_float < 16.5:
        return 0.90
    # Evening snack window (16:30 - 18:00)
    elif 16.5 <= time_float < 18.0:
        return 0.80
    # Post-dinner wrap-up (20:30 - 23:00)
    elif 20.5 <= time_float < 23.0:
        return 0.95
    # Lunch service active (12:00 - 14:00)
    elif 12.0 <= time_float < 14.0:
        return 0.65
    # Morning / Mid-morning
    elif 9.0 <= time_float < 12.0:
        return 0.40
    # Overnight / Off-hours
    else:
        return 0.20


# ── Composite Surplus Score ───────────────────────────────────────────────────

def compute_surplus_score(
    snapshot: InventorySnapshot,
    now: datetime,
    windows: Sequence[BreakWindow],
) -> float:
    """
    Combines the three weighted signals into a normalized [0.0, 1.0] score:
      score = 0.4 * break_proximity + 0.4 * surplus_ratio + 0.2 * time_of_day
    """
    p_score = break_proximity_score(now, windows)
    s_score = surplus_ratio_score(snapshot.quantity_available, snapshot.avg_daily_sold)
    t_score = time_of_day_weight(now)

    composite = (p_score * 0.40) + (s_score * 0.40) + (t_score * 0.20)
    return round(min(1.0, max(0.0, composite)), 3)


# ── Engine Execution Tick ─────────────────────────────────────────────────────

async def run_engine_tick(db: AsyncSession, now: datetime | None = None) -> list[SurplusEvent]:
    """
    Scans the latest inventory snapshots across all restaurants, computes the surplus
    score, and provisions SurplusEvent + FlashDeal if score exceeds threshold.
    """
    if now is None:
        now = datetime.now()

    # 1. Fetch all configured break windows
    res_windows = await db.execute(select(BreakWindow))
    windows = res_windows.scalars().all()

    # 2. Fetch all menu items along with restaurant info
    res_items = await db.execute(
        select(MenuItem).options(selectinload(MenuItem.restaurant))
    )
    items = res_items.scalars().all()

    created_events: list[SurplusEvent] = []

    for item in items:
        # Check if there is already an active surplus event for this item
        res_existing = await db.execute(
            select(SurplusEvent).where(
                and_(
                    SurplusEvent.item_id == item.id,
                    SurplusEvent.status == "active",
                    SurplusEvent.expires_at > now,
                )
            )
        )
        if res_existing.scalar_one_or_none() is not None:
            continue  # Deal already active

        # Get latest InventorySnapshot for this item
        res_snap = await db.execute(
            select(InventorySnapshot)
            .where(InventorySnapshot.item_id == item.id)
            .order_by(InventorySnapshot.timestamp.desc())
            .limit(1)
        )
        snap = res_snap.scalar_one_or_none()
        if not snap:
            continue

        score = compute_surplus_score(snap, now, windows)
        if score >= settings.surplus_score_threshold:
            expires_at = now + timedelta(minutes=45)

            # AI Discount Recommendation via isolated Gemini Flash client
            ai_reco = recommend_discount_for_event(
                restaurant_name=item.restaurant.name,
                cuisine=item.restaurant.cuisine_type,
                item_name=item.name,
                base_price=item.base_price,
                quantity=snap.quantity_available,
                window_minutes=45,
            )

            discount_pct = ai_reco.get("discount_pct", 40)
            reasoning = ai_reco.get("reasoning", "Surplus clearance pricing applied.")

            event = SurplusEvent(
                restaurant_id=item.restaurant_id,
                item_id=item.id,
                triggered_at=now,
                expires_at=expires_at,
                status="active",
                score=score,
            )
            db.add(event)
            await db.flush()  # assign event.id

            deal = FlashDeal(
                surplus_event_id=event.id,
                discount_pct=discount_pct,
                ai_recommended_discount=discount_pct,
                gemini_reasoning_snippet=reasoning,
                deal_window_start=now,
                deal_window_end=expires_at,
            )
            db.add(deal)
            created_events.append(event)
            logger.info(
                "Created SurplusEvent #%d for item '%s' (score=%.2f, discount=%d%%)",
                event.id, item.name, score, discount_pct,
            )

    if created_events:
        await db.commit()

    return created_events
