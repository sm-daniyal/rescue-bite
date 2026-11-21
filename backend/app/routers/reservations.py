from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import FlashDeal, Reservation, Student
from app.schemas import ReservationCreate, ReservationOut, ReservationReject
from app.services.sse_dispatcher import dispatcher

router = APIRouter()


@router.post("", response_model=ReservationOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ReservationOut, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_reservation(
    payload: ReservationCreate,
    db: AsyncSession = Depends(get_db),
) -> ReservationOut:
    """Reserves a portion of an active flash deal (30-minute hold window)."""
    now = datetime.now()

    # 1. Verify deal exists and is currently active
    stmt = (
        select(FlashDeal)
        .where(FlashDeal.id == payload.flash_deal_id)
        .options(selectinload(FlashDeal.surplus_event))
    )
    res_deal = await db.execute(stmt)
    deal = res_deal.scalar_one_or_none()

    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flash deal not found")

    if not deal.surplus_event or deal.surplus_event.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flash deal is no longer active")

    if deal.deal_window_end <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Flash deal window has expired")

    # 2. Verify student exists
    res_student = await db.execute(select(Student).where(Student.id == payload.student_id))
    student = res_student.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    # 3. Prevent duplicate active reservations for the same deal by the same student
    res_dup = await db.execute(
        select(Reservation).where(
            and_(
                Reservation.flash_deal_id == payload.flash_deal_id,
                Reservation.student_id == payload.student_id,
                Reservation.status.in_(["pending", "confirmed"]),
            )
        )
    )
    if res_dup.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Student already has an active reservation for this deal",
        )

    # 4. Create reservation
    deadline = now + timedelta(minutes=settings.reservation_hold_minutes)
    reservation = Reservation(
        flash_deal_id=payload.flash_deal_id,
        student_id=payload.student_id,
        quantity=payload.quantity,
        status="pending",
        created_at=now,
        pickup_deadline=deadline,
    )
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)

    out = ReservationOut.model_validate(reservation)

    # 5. Dispatch SSE event to the restaurant dashboard
    restaurant_id = deal.surplus_event.restaurant_id
    await dispatcher.notify_restaurant(
        restaurant_id=restaurant_id,
        event={"type": "new_reservation", "reservation": out.model_dump(mode="json")},
    )

    return out


@router.patch("/{id}/confirm", response_model=ReservationOut)
async def confirm_reservation(id: int, db: AsyncSession = Depends(get_db)) -> ReservationOut:
    """Restaurant confirms the student's reservation."""
    now = datetime.now()
    res = await db.execute(select(Reservation).where(Reservation.id == id))
    reservation = res.scalar_one_or_none()

    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    if reservation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot confirm reservation with status '{reservation.status}'",
        )

    if reservation.pickup_deadline < now:
        reservation.status = "no_show"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reservation pickup deadline has expired",
        )

    reservation.status = "confirmed"
    await db.commit()
    await db.refresh(reservation)

    out = ReservationOut.model_validate(reservation)

    # Dispatch SSE event to the student client
    await dispatcher.notify_student(
        student_id=reservation.student_id,
        event={"type": "reservation_update", "reservation": out.model_dump(mode="json")},
    )

    return out


@router.patch("/{id}/reject", response_model=ReservationOut)
async def reject_reservation(
    id: int,
    payload: ReservationReject,
    db: AsyncSession = Depends(get_db),
) -> ReservationOut:
    """Restaurant rejects a reservation with an auditable reason code."""
    res = await db.execute(select(Reservation).where(Reservation.id == id))
    reservation = res.scalar_one_or_none()

    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    if reservation.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject reservation with status '{reservation.status}'",
        )

    reservation.status = "rejected"
    reservation.rejection_reason = payload.rejection_reason
    await db.commit()
    await db.refresh(reservation)

    out = ReservationOut.model_validate(reservation)

    # Dispatch SSE event to the student client
    await dispatcher.notify_student(
        student_id=reservation.student_id,
        event={"type": "reservation_update", "reservation": out.model_dump(mode="json")},
    )

    return out


@router.patch("/{id}/complete", response_model=ReservationOut)
async def complete_reservation(id: int, db: AsyncSession = Depends(get_db)) -> ReservationOut:
    """Restaurant marks the food as picked up and paid."""
    res = await db.execute(select(Reservation).where(Reservation.id == id))
    reservation = res.scalar_one_or_none()

    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reservation not found")

    if reservation.status != "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only confirmed reservations can be completed (current: '{reservation.status}')",
        )

    reservation.status = "completed"
    await db.commit()
    await db.refresh(reservation)

    out = ReservationOut.model_validate(reservation)

    # Dispatch SSE event to the student client
    await dispatcher.notify_student(
        student_id=reservation.student_id,
        event={"type": "reservation_update", "reservation": out.model_dump(mode="json")},
    )

    return out
