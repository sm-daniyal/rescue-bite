from datetime import datetime, time
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    cuisine_type: Mapped[str] = mapped_column(String(100), nullable=False)
    avg_prep_time_min: Mapped[int] = mapped_column(Integer, default=10)
    reliability_score: Mapped[float] = mapped_column(Float, default=1.0)

    menu_items: Mapped[list["MenuItem"]] = relationship(back_populates="restaurant")
    surplus_events: Mapped[list["SurplusEvent"]] = relationship(back_populates="restaurant")

    __table_args__ = (
        Index("ix_restaurants_lat_lng", "lat", "lng"),
    )


class MenuItem(Base):
    __tablename__ = "menu_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    base_price: Mapped[int] = mapped_column(Integer, nullable=False)  # in rupees
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    is_vegetarian: Mapped[bool] = mapped_column(Boolean, default=False)

    restaurant: Mapped["Restaurant"] = relationship(back_populates="menu_items")
    inventory_snapshots: Mapped[list["InventorySnapshot"]] = relationship(back_populates="item")


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(nullable=False)
    quantity_available: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_daily_sold: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.7)

    item: Mapped["MenuItem"] = relationship(back_populates="inventory_snapshots")

    __table_args__ = (
        Index("ix_inventory_snapshots_item_time", "item_id", "timestamp"),
    )


class SurplusEvent(Base):
    __tablename__ = "surplus_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    restaurant_id: Mapped[int] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("menu_items.id"), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(nullable=False)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('active','expired','fulfilled','cancelled')"),
        default="active",
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)

    restaurant: Mapped["Restaurant"] = relationship(back_populates="surplus_events")
    flash_deal: Mapped[Optional["FlashDeal"]] = relationship(back_populates="surplus_event", uselist=False)

    __table_args__ = (
        Index("ix_surplus_events_status_expires", "status", "expires_at"),
    )


class FlashDeal(Base):
    __tablename__ = "flash_deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    surplus_event_id: Mapped[int] = mapped_column(ForeignKey("surplus_events.id"), nullable=False, unique=True)
    discount_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    ai_recommended_discount: Mapped[int] = mapped_column(Integer, nullable=False)
    gemini_reasoning_snippet: Mapped[Optional[str]] = mapped_column(Text)
    deal_window_start: Mapped[datetime] = mapped_column(nullable=False)
    deal_window_end: Mapped[datetime] = mapped_column(nullable=False)

    surplus_event: Mapped["SurplusEvent"] = relationship(back_populates="flash_deal")
    reservations: Mapped[list["Reservation"]] = relationship(back_populates="flash_deal")

    __table_args__ = (
        Index("ix_flash_deals_window_end", "deal_window_end"),
    )


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    flash_deal_id: Mapped[int] = mapped_column(ForeignKey("flash_deals.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(
        String(20),
        CheckConstraint("status IN ('pending','confirmed','rejected','completed','no_show')"),
        default="pending",
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(nullable=False)
    pickup_deadline: Mapped[datetime] = mapped_column(nullable=False)

    flash_deal: Mapped["FlashDeal"] = relationship(back_populates="reservations")
    student: Mapped["Student"] = relationship(back_populates="reservations")

    __table_args__ = (
        Index("ix_reservations_deal_status", "flash_deal_id", "status"),
    )


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    college_id: Mapped[int] = mapped_column(Integer, default=1)  # 1 = JNNCE
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    notification_pref: Mapped[bool] = mapped_column(Boolean, default=True)
    is_vegetarian: Mapped[bool] = mapped_column(Boolean, default=False)
    max_budget: Mapped[int] = mapped_column(Integer, default=150)  # rupees

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="student")


class BreakWindow(Base):
    __tablename__ = "break_windows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int] = mapped_column(Integer, default=1)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    # Stored as comma-separated ints (1=Mon..5=Fri) for SQLite compat
    days_of_week: Mapped[str] = mapped_column(String(20), default="1,2,3,4,5")
