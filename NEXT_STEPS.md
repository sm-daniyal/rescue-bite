# RescueBite — What To Do Next (Reference Card)
# Keep this open. Follow in order.

---

## STATUS DASHBOARD

| Step | Component | Status | Verification |
|---|---|---|---|
| **Step 1** | Python 3.12 venv + Dependencies | ✅ **COMPLETE** | 58 packages installed via uv |
| **Step 2** | Surplus Rule Engine | ✅ **COMPLETE** | 8/8 unit tests passing |
| **Step 3** | Gemini Flash Client + Fallbacks | ✅ **COMPLETE** | 6/6 unit tests passing (zero crash guarantee) |
| **Step 4** | API Routers (Deals, Reservations, SSE) | ⏳ **NEXT UP** | Pending implementation |
| **Step 5** | Seed Data & Demo Scenarios | ⏳ Planned | Fixtures & scripts |
| **Step 6** | React / Vite Frontend Scaffolding | ⏳ Planned | Tailwind + Radix UI |

---

## HOW TO RUN THE BACKEND NOW

The backend virtual environment is located at `D:\RescueBite\backend\.venv` (powered by Python 3.12):

```powershell
cd D:\RescueBite\backend
.\.venv\Scripts\activate
# Run all unit tests
python -m pytest tests/ -v
# Run linter
.\.venv\Scripts\ruff.exe check app tests
# Run local dev server
uvicorn app.main:app --reload
```

---

## STEP 1 — Backend Environment & Setup ✅ COMPLETED

- Created standalone CPython 3.12 virtual environment at `D:\RescueBite\backend\.venv`.
- Installed all 58 dependencies (FastAPI, SQLAlchemy, Pydantic, APScheduler, Google Generative AI, Pytest, Ruff).
- Configured `.env` and `pytest.ini`.

---

## STEP 2 — Surplus Engine & Logic ✅ COMPLETED

- File: `D:\RescueBite\backend\app\services\surplus_engine.py`
- Implements the 3-component weighted scoring system:
  1. Break Proximity Score (40%)
  2. Inventory Surplus Ratio (40%)
  3. Time-of-Day Post-Peak Weight (20%)
- Threshold >= 0.65 triggers deal creation with 45-min hold.
- 8 tests in `tests/test_surplus_engine.py` passing cleanly.

---

## STEP 3 — Gemini Flash Client with Bulletproof Fallback ✅ COMPLETED

- File: `D:\RescueBite\backend\app\services\gemini_client.py`
- **Zero-Crash Protocol**: All exceptions (network drop, quota exceeded, malformed output) are caught and automatically resolve to a safe 40% discount fallback.
- **Pre-Cached Bypass**: If a pre-cached discount exists (from demo fixtures), Gemini is not called at all.
- Clamps any LLM output to strictly [25%, 65%].
- 6 tests in `tests/test_gemini_client.py` passing cleanly.

---

## STEP 4 — API Routers & SSE Dispatcher ⏳ NEXT UP

Create these 4 files. Use the design doc (D:\RescueBite\docs\designs\swiggy-campus-rescue.md §9) as reference.

`app/routers/deals.py` — GET /deals, GET /deals/{id}
`app/routers/reservations.py` — POST, PATCH confirm/reject/complete
`app/routers/restaurants.py` — GET /restaurants/{id}/dashboard
`app/routers/sse.py` — streaming SSE endpoints

For SSE, use this pattern:
```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio, json

router = APIRouter()
# Simple in-memory registry: student_id -> asyncio.Queue
student_queues: dict[int, asyncio.Queue] = {}

@router.get("/student/{student_id}")
async def student_sse(student_id: int):
    q: asyncio.Queue = asyncio.Queue()
    student_queues[student_id] = q
    async def event_stream():
        try:
            while True:
                data = await q.get()
                yield f"data: {json.dumps(data)}\n\n"
        except asyncio.CancelledError:
            student_queues.pop(student_id, None)
    return StreamingResponse(event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

Unmount routers in main.py (uncomment the include_router lines).

---

## STEP 5 — Seed data (Day 6, ~2 hrs)

Create: `backend/seed/restaurants.json` — 8 restaurants, realistic Shivamogga names
Create: `backend/seed/menu_items.json` — 3-5 items per restaurant
Create: `backend/seed/break_windows.json`:
```json
[
  {"label":"Morning Break","start_time":"10:30","end_time":"10:45","days_of_week":"1,2,3,4,5"},
  {"label":"Lunch Break","start_time":"13:00","end_time":"14:00","days_of_week":"1,2,3,4,5"},
  {"label":"Evening Break","start_time":"16:30","end_time":"16:45","days_of_week":"1,2,3,4,5"}
]
```
Create: `backend/seed/demo_scenarios.yaml` — 3 scenarios with pre-cached Gemini responses
Create: `backend/seed/seed.py` — loads all JSONs, inserts with ON CONFLICT DO NOTHING

```powershell
python -m seed.seed
# Should print: "Seeded N restaurants, M items, K break windows"
```

---

## STEP 6 — Frontend scaffold (Day 8, ~1 hr)

```powershell
cd D:\RescueBite\frontend
pnpm create vite . --template react-ts
pnpm add tailwindcss @tailwindcss/vite lucide-react
pnpm add @radix-ui/react-toast
```

Add to `vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [react(), tailwindcss()] }
```

Create `src/lib/constants.ts`:
```ts
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
```

Create `src/lib/api.ts` — typed fetch wrappers for all endpoints.

---

## STEP 7 — Frontend core components (Days 9–13)

Build in this order:
1. `src/hooks/useSSE.ts` — wraps EventSource, handles reconnect
2. `src/hooks/useDeals.ts` — fetches /deals, subscribes to SSE
3. `src/components/DealCard.tsx` — the main card UI
4. `src/components/CountdownTimer.tsx` — counts down to deal expiry
5. `src/components/FuelMath.tsx` — net savings after fuel
6. `src/components/BreakBellToast.tsx` — Radix toast on break_bell SSE event
7. `src/pages/StudentFeed.tsx` — composes the above
8. `src/components/RestaurantDashboard.tsx` — confirm/reject reservations
9. `src/pages/DemoSwitcher.tsx` — 3 buttons: Trigger Scenario A/B/C

---

## STEP 8 — Demo hardening (Day 17)

Add: `app/routers/demo.py`
```python
@router.post("/trigger-scenario/{scenario_id}")
async def trigger_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    if settings.environment != "development":
        raise HTTPException(403, "Demo endpoints disabled in production")
    # Load scenario from demo_scenarios.yaml
    # Insert SurplusEvent + FlashDeal with pre-cached Gemini data
    # Fan out SSE to all connected students
    ...
```

Pre-cache 3 Gemini responses in demo_scenarios.yaml so the demo works offline.

---

## STEP 9 — Deploy

Backend (Railway):
1. Push D:\RescueBite to GitHub
2. Railway → New Project → Deploy from GitHub → select backend/
3. Add env vars: DATABASE_URL (Supabase), GEMINI_API_KEY, ENVIRONMENT=production
4. Run seed: Railway CLI → `python -m seed.seed`

Frontend (Vercel):
1. Vercel → New Project → select frontend/
2. Add env var: VITE_API_BASE_URL=https://your-railway-url.railway.app
3. Deploy

---

## STEP 10 — Before submission checklist

[ ] pytest tests/ -v → all pass
[ ] ruff check app/ → 0 violations
[ ] tsc --noEmit → 0 errors
[ ] pnpm run build → 0 errors
[ ] Demo Scenario A walkthrough < 4 min
[ ] Demo Scenario B walkthrough < 4 min
[ ] Demo Scenario C (rejection flow) works
[ ] Offline fallback: revoke Gemini key, Scenario A still works
[ ] SSE reconnects after 10s backend pause
[ ] Survey: 20+ responses collected and noted
[ ] Slide deck: 5 slides complete
[ ] Video walkthrough recorded (use OBS or Loom, < 5 min)

---

## PROMPTS TO USE WITH AI (when you start a new conversation)

**To continue backend work:**
"I'm building RescueBite for Swiggy Food for Thought 2.0 hackathon.
Design doc: D:\RescueBite\docs\designs\swiggy-campus-rescue.md
Stack: FastAPI + SQLAlchemy async + Supabase + Gemini Flash.
Current task: [describe what you need, e.g. 'write surplus_engine.py']
Follow the design doc exactly. No ML, no paid APIs beyond Gemini Flash free tier."

**To continue frontend work:**
"I'm building the React/Vite frontend for RescueBite (Swiggy hackathon prototype).
Backend API is at http://localhost:8000. Stack: React + TypeScript + Tailwind + Radix UI.
Current task: [describe, e.g. 'write useSSE.ts hook']
Use native EventSource API, not socket.io. No any types. Strict TypeScript."

**To write seed data:**
"Write realistic seed data for RescueBite. 8 restaurants in Shivamogga, Karnataka
(coords near 13.93°N 75.57°E). South Indian, North Indian, Darshini cuisine types.
Format: JSON matching this schema: [paste Restaurant model from models.py]"

**To write tests:**
"Write pytest tests for surplus_engine.py in RescueBite.
File location: backend/tests/test_surplus_engine.py.
Test boundary conditions: score at break window start, score 120min before break,
high surplus item, normal stock item. Use pytest fixtures, no mocks needed for pure functions."
