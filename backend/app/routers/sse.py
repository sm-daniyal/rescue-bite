import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.sse_dispatcher import dispatcher

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/student/{student_id}")
async def student_sse(student_id: int) -> StreamingResponse:
    """Streams real-time flash deals, Break Bell notifications, and reservation status to a student."""
    q = dispatcher.register_student(student_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Initial connection confirmation
            yield f"data: {json.dumps({'type': 'connected', 'student_id': student_id})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Send comment to prevent proxy timeouts
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            logger.info("SSE client cancelled for student #%d", student_id)
        finally:
            dispatcher.unregister_student(student_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/restaurant/{restaurant_id}")
async def restaurant_sse(restaurant_id: int) -> StreamingResponse:
    """Streams incoming reservations and updates to the restaurant dashboard."""
    q = dispatcher.register_restaurant(restaurant_id)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Initial connection confirmation
            yield f"data: {json.dumps({'type': 'connected', 'restaurant_id': restaurant_id})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            logger.info("SSE client cancelled for restaurant #%d", restaurant_id)
        finally:
            dispatcher.unregister_restaurant(restaurant_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
