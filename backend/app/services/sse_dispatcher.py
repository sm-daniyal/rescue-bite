import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


class SSEDispatcher:
    def __init__(self) -> None:
        # student_id -> set of active asyncio.Queue
        self._students: dict[int, set[asyncio.Queue[dict[str, Any]]]] = {}
        # restaurant_id -> set of active asyncio.Queue
        self._restaurants: dict[int, set[asyncio.Queue[dict[str, Any]]]] = {}

    def register_student(self, student_id: int) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=50)
        self._students.setdefault(student_id, set()).add(q)
        logger.info("Student #%d subscribed to SSE (active queues: %d)", student_id, len(self._students[student_id]))
        return q

    def unregister_student(self, student_id: int, q: asyncio.Queue[dict[str, Any]]) -> None:
        if student_id in self._students:
            self._students[student_id].discard(q)
            if not self._students[student_id]:
                del self._students[student_id]
        logger.info("Student #%d disconnected from SSE", student_id)

    def register_restaurant(self, restaurant_id: int) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=50)
        self._restaurants.setdefault(restaurant_id, set()).add(q)
        logger.info("Restaurant #%d subscribed to SSE (active queues: %d)", restaurant_id, len(self._restaurants[restaurant_id]))
        return q

    def unregister_restaurant(self, restaurant_id: int, q: asyncio.Queue[dict[str, Any]]) -> None:
        if restaurant_id in self._restaurants:
            self._restaurants[restaurant_id].discard(q)
            if not self._restaurants[restaurant_id]:
                del self._restaurants[restaurant_id]
        logger.info("Restaurant #%d disconnected from SSE", restaurant_id)

    async def fan_out_to_students(self, event: dict[str, Any]) -> None:
        """Broadcast an event to all connected student clients."""
        for queues in list(self._students.values()):
            for q in list(queues):
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning("Student SSE queue full, dropping event")

    async def notify_student(self, student_id: int, event: dict[str, Any]) -> None:
        """Send an event to all active sessions for a specific student."""
        queues = self._students.get(student_id, set())
        for q in list(queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Student #%d SSE queue full, dropping event", student_id)

    async def notify_restaurant(self, restaurant_id: int, event: dict[str, Any]) -> None:
        """Send an event to all active sessions for a specific restaurant dashboard."""
        queues = self._restaurants.get(restaurant_id, set())
        for q in list(queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Restaurant #%d SSE queue full, dropping event", restaurant_id)


# Global singleton dispatcher
dispatcher = SSEDispatcher()
