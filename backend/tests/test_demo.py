import pytest
from httpx import ASGITransport, AsyncClient

from app.database import create_all_tables
from app.main import app
from seed.seed import main as seed_main


@pytest.fixture(autouse=True)
async def setup_db_with_seed():
    await create_all_tables()
    await seed_main()


@pytest.mark.asyncio
async def test_demo_scenarios_listing():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/demo/scenarios")
        assert resp.status_code == 200
        data = resp.json()
        assert "scenarios" in data
        assert "scenario_a" in data["scenarios"]
        assert "scenario_b" in data["scenarios"]
        assert "scenario_c" in data["scenarios"]


@pytest.mark.asyncio
async def test_trigger_scenario_a():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger Scenario A (Lunch Rescue)
        resp = await client.post("/demo/trigger-scenario/A")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "triggered"
        assert data["scenario"] == "scenario_a"
        assert data["restaurant"] == "Biryani Paradise"
        assert data["discount_pct"] == 51
        assert data["offline_cached"] is True

        # Verify deal is immediately listed under active deals
        deals_resp = await client.get("/deals")
        assert deals_resp.status_code == 200
        deals = deals_resp.json()
        matching = [d for d in deals if d["id"] == data["deal_id"]]
        assert len(matching) == 1
        assert matching[0]["discount_pct"] == 51


@pytest.mark.asyncio
async def test_trigger_scenario_b_break_bell():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Trigger Scenario B (Evening Snack Bell)
        resp = await client.post("/demo/trigger-scenario/B")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "triggered"
        assert data["scenario"] == "scenario_b"
        assert data["restaurant"] == "Meenakshi Bhavan Darshini"
        assert data["discount_pct"] == 38


@pytest.mark.asyncio
async def test_trigger_scenario_invalid():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/demo/trigger-scenario/nonexistent")
        assert resp.status_code == 404
