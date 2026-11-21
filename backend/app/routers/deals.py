from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import FlashDeal, SurplusEvent
from app.schemas import FlashDealDetail, FlashDealOut, MenuItemOut, RestaurantOut

router = APIRouter()


def _format_deal_out(d: FlashDeal) -> FlashDealOut:
    restaurant_out = None
    item_out = None
    if d.surplus_event:
        if d.surplus_event.restaurant:
            restaurant_out = RestaurantOut.model_validate(d.surplus_event.restaurant)
        if d.surplus_event.item:
            item_out = MenuItemOut.model_validate(d.surplus_event.item)

    return FlashDealOut(
        id=d.id,
        surplus_event_id=d.surplus_event_id,
        discount_pct=d.discount_pct,
        ai_recommended_discount=d.ai_recommended_discount,
        gemini_reasoning_snippet=d.gemini_reasoning_snippet,
        deal_window_start=d.deal_window_start,
        deal_window_end=d.deal_window_end,
        restaurant=restaurant_out,
        item=item_out,
    )


@router.get("", response_model=List[FlashDealOut])
@router.get("/", response_model=List[FlashDealOut], include_in_schema=False)
async def list_active_deals(db: AsyncSession = Depends(get_db)) -> List[FlashDealOut]:
    """Returns all currently active flash deals, sorted by urgency (deal window end time)."""
    now = datetime.now()
    stmt = (
        select(FlashDeal)
        .join(SurplusEvent, FlashDeal.surplus_event_id == SurplusEvent.id)
        .where(
            SurplusEvent.status == "active",
            FlashDeal.deal_window_end > now,
        )
        .options(
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.restaurant),
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.item),
        )
        .order_by(FlashDeal.deal_window_end.asc())
    )
    res = await db.execute(stmt)
    deals = res.scalars().all()
    return [_format_deal_out(d) for d in deals]


@router.get("/{id}", response_model=FlashDealDetail)
async def get_deal_detail(id: int, db: AsyncSession = Depends(get_db)) -> FlashDealDetail:
    """Returns full details for a flash deal, including AI discount reasoning and surplus score."""
    stmt = (
        select(FlashDeal)
        .where(FlashDeal.id == id)
        .options(
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.restaurant),
            selectinload(FlashDeal.surplus_event).selectinload(SurplusEvent.item),
        )
    )
    res = await db.execute(stmt)
    deal = res.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flash deal not found")

    base_out = _format_deal_out(deal)
    score = deal.surplus_event.score if deal.surplus_event else 0.0

    return FlashDealDetail(
        **base_out.model_dump(),
        score=score,
    )
