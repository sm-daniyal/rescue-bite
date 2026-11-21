from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


# ── Shared ────────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Restaurant ────────────────────────────────────────────────────────────────

class RestaurantOut(OrmBase):
    id: int
    name: str
    lat: float
    lng: float
    cuisine_type: str
    avg_prep_time_min: int
    reliability_score: float


# ── MenuItem ──────────────────────────────────────────────────────────────────

class MenuItemOut(OrmBase):
    id: int
    restaurant_id: int
    name: str
    base_price: int
    category: str
    is_vegetarian: bool


# ── FlashDeal ─────────────────────────────────────────────────────────────────

class FlashDealOut(OrmBase):
    id: int
    surplus_event_id: int
    discount_pct: int
    ai_recommended_discount: int
    gemini_reasoning_snippet: Optional[str]
    deal_window_start: datetime
    deal_window_end: datetime
    # Joined fields (populated by query)
    restaurant: Optional[RestaurantOut] = None
    item: Optional[MenuItemOut] = None


class FlashDealDetail(FlashDealOut):
    score: float = 0.0  # from joined SurplusEvent


# ── Reservation ───────────────────────────────────────────────────────────────

class ReservationCreate(BaseModel):
    flash_deal_id: int
    student_id: int
    quantity: int = Field(default=1, ge=1, le=5)


class ReservationReject(BaseModel):
    rejection_reason: str = Field(
        min_length=3,
        max_length=200,
        examples=["item_unavailable", "quantity_reduced", "kitchen_closed"],
    )


class ReservationOut(OrmBase):
    id: int
    flash_deal_id: int
    student_id: int
    quantity: int
    status: str
    rejection_reason: Optional[str]
    created_at: datetime
    pickup_deadline: datetime


# ── Restaurant Dashboard ──────────────────────────────────────────────────────

class DashboardOut(BaseModel):
    restaurant: RestaurantOut
    active_deals: list[FlashDealOut]
    pending_reservations: list[ReservationOut]
    confirmed_reservations: list[ReservationOut]


# ── SSE Events ────────────────────────────────────────────────────────────────

class SSENewDeal(BaseModel):
    type: str = "new_deal"
    deal: FlashDealOut


class SSEBreakBell(BaseModel):
    type: str = "break_bell"
    deal_count: int
    deals: list[FlashDealOut]


class SSEReservationUpdate(BaseModel):
    type: str = "reservation_update"
    reservation: ReservationOut


class SSENewReservation(BaseModel):
    type: str = "new_reservation"
    reservation: ReservationOut
