from datetime import datetime, timedelta
import pytest
from httpx import ASGITransport, AsyncClient

from app.database import AsyncSessionLocal, create_all_tables
from app.main import app
from app.models import FlashDeal, MenuItem, Restaurant, Student, SurplusEvent


@pytest.fixture(autouse=True)
async def setup_db():
    await create_all_tables()


@pytest.mark.asyncio
async def test_deals_and_reservations_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Seed minimal fixtures in DB
        now = datetime.now()
        async with AsyncSessionLocal() as session:
            rest = Restaurant(
                name="Shivani Delicacy",
                lat=13.9300,
                lng=75.5700,
                cuisine_type="South Indian",
                avg_prep_time_min=10,
                reliability_score=0.95,
            )
            session.add(rest)
            await session.flush()

            item = MenuItem(
                restaurant_id=rest.id,
                name="Masala Dosa",
                base_price=60,
                category="Snacks",
                is_vegetarian=True,
            )
            session.add(item)
            await session.flush()

            student = Student(
                name="Rahul Sharma",
                college_id=1,
                department="Computer Science",
            )
            session.add(student)
            await session.flush()

            event = SurplusEvent(
                restaurant_id=rest.id,
                item_id=item.id,
                triggered_at=now,
                expires_at=now + timedelta(minutes=45),
                status="active",
                score=0.82,
            )
            session.add(event)
            await session.flush()

            deal = FlashDeal(
                surplus_event_id=event.id,
                discount_pct=45,
                ai_recommended_discount=45,
                gemini_reasoning_snippet="Post-lunch excess clearance.",
                deal_window_start=now,
                deal_window_end=now + timedelta(minutes=45),
            )
            session.add(deal)
            await session.commit()
            deal_id = deal.id
            student_id = student.id
            restaurant_id = rest.id

        # 2. Test GET /deals
        resp_deals = await client.get("/deals")
        assert resp_deals.status_code == 200
        deals_data = resp_deals.json()
        assert len(deals_data) >= 1
        found = next((d for d in deals_data if d["id"] == deal_id), None)
        assert found is not None
        assert found["discount_pct"] == 45
        assert found["restaurant"]["name"] == "Shivani Delicacy"
        assert found["item"]["name"] == "Masala Dosa"

        # 3. Test GET /deals/{id}
        resp_single = await client.get(f"/deals/{deal_id}")
        assert resp_single.status_code == 200
        single_data = resp_single.json()
        assert single_data["id"] == deal_id
        assert single_data["score"] == 0.82
        assert single_data["gemini_reasoning_snippet"] == "Post-lunch excess clearance."

        # 4. Test POST /reservations
        res_payload = {
            "flash_deal_id": deal_id,
            "student_id": student_id,
            "quantity": 2,
        }
        resp_res = await client.post("/reservations", json=res_payload)
        assert resp_res.status_code == 201
        res_data = resp_res.json()
        assert res_data["status"] == "pending"
        assert res_data["quantity"] == 2
        reservation_id = res_data["id"]

        # Duplicate reservation should fail with 409
        resp_dup = await client.post("/reservations", json=res_payload)
        assert resp_dup.status_code == 409

        # 5. Test GET /restaurants/{id}/dashboard
        resp_dash = await client.get(f"/restaurants/{restaurant_id}/dashboard")
        assert resp_dash.status_code == 200
        dash_data = resp_dash.json()
        assert dash_data["restaurant"]["id"] == restaurant_id
        assert len(dash_data["active_deals"]) >= 1
        assert any(r["id"] == reservation_id for r in dash_data["pending_reservations"])

        # 6. Test PATCH /reservations/{id}/confirm
        resp_confirm = await client.patch(f"/reservations/{reservation_id}/confirm")
        assert resp_confirm.status_code == 200
        assert resp_confirm.json()["status"] == "confirmed"

        # Cannot confirm again (invalid state)
        resp_reconfirm = await client.patch(f"/reservations/{reservation_id}/confirm")
        assert resp_reconfirm.status_code == 409

        # 7. Test PATCH /reservations/{id}/complete
        resp_complete = await client.patch(f"/reservations/{reservation_id}/complete")
        assert resp_complete.status_code == 200
        assert resp_complete.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_reservation_rejection_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        now = datetime.now()
        async with AsyncSessionLocal() as session:
            rest = Restaurant(
                name="City Tiffin",
                lat=13.9310,
                lng=75.5710,
                cuisine_type="Darshini",
            )
            session.add(rest)
            await session.flush()

            item = MenuItem(restaurant_id=rest.id, name="Idli Vada", base_price=40, category="Snacks")
            session.add(item)
            await session.flush()

            student = Student(name="Ayesha Khan", college_id=1, department="Electronics")
            session.add(student)
            await session.flush()

            event = SurplusEvent(
                restaurant_id=rest.id,
                item_id=item.id,
                triggered_at=now,
                expires_at=now + timedelta(minutes=30),
                status="active",
                score=0.75,
            )
            session.add(event)
            await session.flush()

            deal = FlashDeal(
                surplus_event_id=event.id,
                discount_pct=50,
                ai_recommended_discount=50,
                deal_window_start=now,
                deal_window_end=now + timedelta(minutes=30),
            )
            session.add(deal)
            await session.commit()
            deal_id = deal.id
            student_id = student.id

        # Create reservation
        resp = await client.post("/reservations", json={"flash_deal_id": deal_id, "student_id": student_id, "quantity": 1})
        assert resp.status_code == 201
        res_id = resp.json()["id"]

        # Reject reservation
        resp_reject = await client.patch(
            f"/reservations/{res_id}/reject",
            json={"rejection_reason": "item_unavailable"},
        )
        assert resp_reject.status_code == 200
        rejected_data = resp_reject.json()
        assert rejected_data["status"] == "rejected"
        assert rejected_data["rejection_reason"] == "item_unavailable"
