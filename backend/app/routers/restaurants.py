from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import FlashDeal, Reservation, Restaurant, SurplusEvent
from app.schemas import DashboardOut, FlashDealOut, MenuItemOut, ReservationOut, RestaurantOut

router = APIRouter()


@router.get("/{id}/dashboard", response_model=DashboardOut)
async def get_restaurant_dashboard(id: int, db: AsyncSession = Depends(get_db)) -> DashboardOut:
    """Returns the one-screen operational dashboard for a restaurant partner."""
    now = datetime.now()

    # 1. Fetch restaurant
    res_rest = await db.execute(select(Restaurant).where(Restaurant.id == id))
    restaurant = res_rest.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    # 2. Fetch active deals for this restaurant
    stmt_deals = (
        select(FlashDeal)
        .join(SurplusEvent, FlashDeal.surplus_event_id == SurplusEvent.id)
        .where(
            SurplusEvent.restaurant_id == id,
            SurplusEvent.status == "active",
            FlashDeal.deal_window_end > now,
        )
        .options(
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.item),
        )
        .order_by(FlashDeal.deal_window_end.asc())
    )
    res_deals = await db.execute(stmt_deals)
    deals = res_deals.scalars().all()

    active_deals_out = []
    rest_out = RestaurantOut.model_validate(restaurant)

    for d in deals:
        item_out = None
        if d.surplus_event and d.surplus_event.item:
            item_out = MenuItemOut.model_validate(d.surplus_event.item)
        active_deals_out.append(
            FlashDealOut(
                id=d.id,
                surplus_event_id=d.surplus_event_id,
                discount_pct=d.discount_pct,
                ai_recommended_discount=d.ai_recommended_discount,
                gemini_reasoning_snippet=d.gemini_reasoning_snippet,
                deal_window_start=d.deal_window_start,
                deal_window_end=d.deal_window_end,
                restaurant=rest_out,
                item=item_out,
            )
        )

    # 3. Fetch pending reservations for this restaurant
    stmt_pending = (
        select(Reservation)
        .join(FlashDeal, Reservation.flash_deal_id == FlashDeal.id)
        .join(SurplusEvent, FlashDeal.surplus_event_id == SurplusEvent.id)
        .where(
            SurplusEvent.restaurant_id == id,
            Reservation.status == "pending",
        )
        .order_by(Reservation.created_at.desc())
    )
    res_pending = await db.execute(stmt_pending)
    pending_reservations = [
        ReservationOut.model_validate(r) for r in res_pending.scalars().all()
    ]

    # 4. Fetch confirmed reservations for this restaurant
    stmt_confirmed = (
        select(Reservation)
        .join(FlashDeal, Reservation.flash_deal_id == FlashDeal.id)
        .join(SurplusEvent, FlashDeal.surplus_event_id == SurplusEvent.id)
        .where(
            SurplusEvent.restaurant_id == id,
            Reservation.status == "confirmed",
        )
        .order_by(Reservation.created_at.desc())
    )
    res_confirmed = await db.execute(stmt_confirmed)
    confirmed_reservations = [
        ReservationOut.model_validate(r) for r in res_confirmed.scalars().all()
    ]

    return DashboardOut(
        restaurant=rest_out,
        active_deals=active_deals_out,
        pending_reservations=pending_reservations,
        confirmed_reservations=confirmed_reservations,
    )
