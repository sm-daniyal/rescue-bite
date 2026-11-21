# Swiggy Campus Rescue — Design Document

*   **Author:** sm-daniyal
*   **Status:** Draft
*   **Date:** 2026-11-19
*   **Competition:** Swiggy Food for Thought 2.0 (2026–27)
*   **Campus Context:** JNNCE, Shivamogga, Karnataka

---

## 1. Overview

Swiggy Campus Rescue is a two-sided surplus food marketplace integrated into the Swiggy platform. It predicts which restaurant partners will have unsold food before the end of a service window, generates a Gemini Flash-recommended discount for each predicted surplus event, and notifies nearby college students with a time-limited flash deal they can reserve for self-pickup.

The system is built around one structural insight: college campuses have fixed, predictable break schedules. Restaurants near campuses accumulate surplus food at predictable times. Connecting the two — with a push notification fired at exactly the right moment — creates a transaction that would otherwise not happen. The restaurant recovers some revenue instead of discarding food. The student eats a meal at 40–65% off. Swiggy earns a commission on an order that was previously zero.

The prototype runs on synthetic restaurant data seeded to match realistic demand patterns in Shivamogga. All simulated data is disclosed in the UI. The prediction and discount recommendation logic is real and auditable.

---

## 2. Problem

### Student Pain Point

Students near JNNCE face a narrow set of affordable, good-quality meal options within walking distance. Canteens serve basic food of variable quality. Good restaurants are 2–5 km away and typically priced at ₹120–₹250 per meal — feasible occasionally, not daily. There is no mechanism by which students learn that a decent meal is available at 50% off at the right moment. By the time a student is hungry, the decision window is short, the full-price discovery path is slow, and the value case is not obvious.

### Restaurant Partner Pain Point

Restaurants near colleges experience a predictable demand pattern: spikes during lunch (12:00–1:30 PM) and evening snack (4:30–6:30 PM), troughs outside those windows. Surplus accumulates most heavily after the lunch peak — portions prepared for a midday crowd that did not fully materialise. This food is discarded or consumed by staff, generating zero revenue. Restaurants currently have no proactive channel on Swiggy to offer time-sensitive discounts tied to their actual remaining inventory.

### Market Gap

Swiggy has promotional tools (Partner Offers, Swiggy One deals) but none that are triggered by predicted surplus. The existing discount system is static, manually configured, and not time-sensitive at the minute scale. No product in the Indian market connects campus break schedules to restaurant surplus in real time.

---

## 3. Goals

**Primary goals (must ship for competition):**
1. Predict surplus events using a deterministic rule engine applied to synthetic inventory data.
2. Generate a Gemini Flash discount recommendation per event (cached, not per page view).
3. Display active flash deals to students in a real-time feed via SSE.
4. Fire a Break Bell notification to students at T-1 minute before each JNNCE break window.
5. Allow students to reserve a deal (30-minute hold, no payment, self-pickup).
6. Allow restaurant partners to confirm or reject reservations with a reason code.
7. Demo the full end-to-end flow across three scripted judge scenarios.

**Secondary goals (nice to have, not blockers):**
- Fuel Math widget on deal cards (calculates net savings after vehicle fuel cost).
- CO₂ Rescue counter per completed reservation.
- Restaurant reliability score (penalise restaurants with >20% expired deals in feed ranking).

---

## 4. Non-Goals

- **No live Swiggy API integration.** The prototype uses synthetic data and would require Swiggy's internal APIs for a production deployment.
- **No payment processing.** Students pay at pickup in cash or UPI. The prototype only tracks the reservation state machine.
- **No delivery.** Self-pickup only. Delivery fee negates the value proposition below ₹120.
- **No ML training pipeline.** The surplus prediction is a deterministic rule engine, not a trained model.
- **No campus canteen integration.** Focus is on Swiggy restaurant partners, not on-campus food infrastructure.
- **No multi-campus rollout.** JNNCE is the sole pilot context. Break windows are hardcoded for JNNCE.
- **No production auth.** Demo uses session-scoped student and restaurant IDs for the judge walkthrough.

---

## 5. Open Questions

| # | Question | Current assumption | Needs validation |
|---|---|---|---|
| OQ-1 | What is the minimum discount (%) that motivates a student to ride 3–5 km? | 40–50% | JNNCE survey |
| OQ-2 | Will restaurant partners manually confirm reservations, or is auto-confirm acceptable? | Manual confirm within 10 minutes | Restaurant interview |
| OQ-3 | Does the Break Bell notification increase click-through materially vs. passive feed? | Yes — the break window creates urgency | A/B in demo scenario |
| OQ-4 | What is the realistic surplus volume per restaurant per day near JNNCE? | 10–30 portions per meal window | Restaurant interview |
| OQ-5 | Will Supabase free tier handle SSE connection load during a live demo? | Yes — ≤20 concurrent connections | Load test before demo day |

---

## 6. Critical User Journeys

### CUJ-1: Student Discovers and Reserves a Flash Deal

**Actor:** A second-year BE student at JNNCE on a weekday at 12:59 PM.

**Flow:**
1. Student receives a Break Bell browser notification: "🔔 Lunch break! Biryani House has 8 portions of Chicken Biryani at ₹89 (was ₹180). 28 minutes left."
2. Student opens the student feed. The deal card shows: item name, restaurant name, distance (3.2 km), discounted price, original price, quantity remaining, countdown timer, Fuel Math ("Net save: ₹79 after fuel"), and AI reasoning snippet ("High surplus post-lunch peak, recommended 51% off").
3. Student taps "Reserve." The system creates a `Reservation` in `PENDING` state. A 30-minute countdown starts.
4. Restaurant partner sees the reservation on the dashboard and taps "Confirm."
5. Student receives an SSE event: reservation status updates to `CONFIRMED`. UI shows a reservation ID and pickup deadline.
6. Student rides to the restaurant, shows reservation ID, pays at pickup. Restaurant marks as `COMPLETED`.

**Success metric:** Student completes a reservation within 3 minutes of Break Bell.

---

### CUJ-2: Restaurant Partner Manages a Surplus Event

**Actor:** Restaurant staff at a Shivamogga eatery at 2:15 PM.

**Flow:**
1. The backend scheduler detects a surplus score ≥ 0.65 for "Veg Meals" at this restaurant (12 portions available, avg daily sold 8, 2 hours before dinner window).
2. Gemini Flash recommends 38% discount. A `FlashDeal` is created and pushed to the student feed via SSE.
3. Restaurant dashboard shows the active deal with quantity and time window. 3 reservations arrive.
4. Staff confirms 2, rejects 1 with reason "Item sold out at counter" (a manual override reason code).
5. Rejected student receives SSE update. Confirmed students receive pickup instructions.
6. At deal expiry, unsold portions are marked `EXPIRED`. Restaurant's reliability score is updated.

**Success metric:** Restaurant partner completes the confirm/reject flow in under 60 seconds per reservation.

---

### CUJ-3: Judge Demo Walkthrough (Scripted)

**Actor:** Competition judge evaluating the prototype live.

**Flow:**
1. Demo opens on a split-screen: student feed (left) and restaurant dashboard (right).
2. Judge clicks "Trigger Surplus Event" (a DemoSwitcher button that bypasses the scheduler timer and immediately creates a pre-seeded SurplusEvent for Scenario A).
3. Within 2 seconds, a deal card appears on the student feed. The Break Bell toast fires.
4. Judge clicks "Reserve" on the student side. The reservation appears on the restaurant dashboard in real time.
5. Judge clicks "Confirm" on the restaurant side. The student feed updates to `CONFIRMED` state.
6. Judge inspects the AI reasoning card: Gemini's discount recommendation and reasoning snippet are visible.
7. Judge clicks "Complete Pickup" on the restaurant side. CO₂ counter increments. Rescue Mission badge appears on student profile.

**Success metric:** Full E2E demo completes in under 4 minutes without page refresh or manual data manipulation.

---

## 7. Technical Plan

### System Overview

The system is a two-sided web application. The student side is a discovery and reservation feed. The restaurant side is a one-screen confirmation dashboard. A backend scheduler drives surplus detection and deal creation. Gemini Flash handles discount recommendation at event creation time only. All real-time updates flow over SSE.

There is no ML pipeline. There is no payment integration. There is no live Swiggy API. The seed data layer is the only source of truth for restaurant inventory, and it is clearly disclosed in the UI.

### Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React/Vite)                │
│  ┌─────────────────┐          ┌────────────────────────┐   │
│  │  Student Feed    │          │  Restaurant Dashboard   │   │
│  │  - Deal cards    │          │  - Active deals        │   │
│  │  - Countdown     │          │  - Reservations list   │   │
│  │  - Reserve btn   │          │  - Accept / Reject     │   │
│  │  - Fuel Math     │          │  - Reason codes        │   │
│  │  - Break Bell    │          │  - Reliability score   │   │
│  └────────┬────────┘          └───────────┬────────────┘   │
│           │ EventSource (SSE)             │ EventSource     │
└───────────┼───────────────────────────────┼─────────────────┘
            │                               │
┌───────────┼───────────────────────────────┼─────────────────┐
│           │       Backend (FastAPI)        │                 │
│  ┌────────┴────────────────────────────────┴──────────────┐ │
│  │                   SSE Dispatcher                       │ │
│  │  - /sse/student/{student_id}                           │ │
│  │  - /sse/restaurant/{restaurant_id}                     │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │                               │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │                REST API Layer                          │ │
│  │  POST /reservations     GET /deals                     │ │
│  │  PATCH /reservations/{id}/confirm                      │ │
│  │  PATCH /reservations/{id}/reject                       │ │
│  │  GET /restaurants/{id}/dashboard                       │ │
│  └──────────────────────────┬─────────────────────────────┘ │
│                             │                               │
│  ┌──────────────────────────▼─────────────────────────────┐ │
│  │            Background Scheduler (APScheduler)          │ │
│  │  - Every 30 min: run surplus rule engine               │ │
│  │  - At T-1 min before each break window: Break Bell     │ │
│  │  - Every 5 min: expire stale deals and reservations    │ │
│  └──────┬──────────────────────────────────┬──────────────┘ │
│         │                                  │               │
│  ┌──────▼──────────┐             ┌─────────▼─────────────┐ │
│  │  Surplus Rule   │             │   Gemini Flash Client  │ │
│  │  Engine         │             │   (discount reco)      │ │
│  │  compute_score()│             │   Called once per event│ │
│  │  → SurplusEvent │             │   Response cached in DB│ │
│  └─────────────────┘             └───────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            Supabase (PostgreSQL)                        ││
│  │  Restaurants | MenuItems | InventorySnapshots           ││
│  │  SurplusEvents | FlashDeals | Reservations              ││
│  │  Students | BreakWindows                                ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

Seed Data Layer (backend/seed/seed.py)
  → Populates all tables with deterministic synthetic data
  → Idempotent: INSERT ... ON CONFLICT DO NOTHING
  → Covers 8-10 Shivamogga restaurants, JNNCE break windows,
    realistic day-of-week demand patterns
```

### Surplus Rule Engine

The engine runs on a scheduler tick every 30 minutes. For each restaurant/item pair, it reads the latest `InventorySnapshot` from the database and computes a score:

```python
# Pseudocode — no implementation code in this document
score = (
    break_proximity_score(current_time, break_windows) * 0.4
    + surplus_ratio_score(snapshot.quantity_available, snapshot.avg_daily_sold) * 0.4
    + time_of_day_weight(current_time) * 0.2
)

if score >= 0.65:
    create SurplusEvent
    call Gemini Flash → cache discount_pct and reasoning in FlashDeal
    emit SSE to subscribed students
```

**Break proximity score**: 1.0 at the start of a break window, decaying linearly to 0.0 at T-120 minutes before the break.

**Surplus ratio score**: 0.0 when `quantity_available / avg_daily_sold < 0.3` (normal). Scales to 1.0 as the ratio increases.

**Time-of-day weight**: a lookup table keyed by hour. Highest during post-peak windows (2:00–4:00 PM for lunch, 9:30–11:00 PM for dinner).

The score is auditable. If a judge asks why an event was created, the three component scores can be displayed.

### Gemini Flash Discount Recommendation

One API call is made per `SurplusEvent` creation. The response is stored in `FlashDeals.ai_recommended_discount` and `FlashDeals.gemini_reasoning_snippet`. No further Gemini calls happen during the deal's lifetime.

**Prompt inputs (structured)**: restaurant name, cuisine, item name, base price, surplus quantity, minutes until deal window closes, estimated active students in the upcoming break window.

**Output contract**: `{"discount_pct": int, "reasoning": str}` — discount bounded 25–65%.

**Token budget**: ~400 tokens per call. At ≤10 events/day, the daily budget is 4,000 tokens. Gemini Flash free tier: 1 million tokens/month. No concern at prototype scale.

**Demo safety**: all three scripted demo scenarios have Gemini responses pre-cached in the seed data. If the Gemini API is unavailable, cached values serve as fallback.

### Real-Time Layer (SSE)

FastAPI exposes two persistent SSE endpoints:
- `GET /sse/student/{student_id}` — streams deal events, reservation status updates, and Break Bell notifications.
- `GET /sse/restaurant/{restaurant_id}` — streams incoming reservation events and status changes.

**Technology**: FastAPI `StreamingResponse` with `Content-Type: text/event-stream`. Frontend uses the native `EventSource` API with exponential backoff reconnection.

**Fan-out**: when a new FlashDeal is created, the scheduler dispatches an SSE event to all currently connected students via async background tasks.

**Reconnection visibility**: the student feed displays a "Live" / "Reconnecting…" indicator driven by `EventSource` `open` and `error` events.

### Break Bell Scheduler

APScheduler cron job fires at T-1 minute before each JNNCE break window (10:29 AM, 12:59 PM, 4:29 PM on weekdays). It queries active FlashDeals within 7 km of the JNNCE campus centroid and dispatches a Break Bell SSE event to all subscribed students. Rendered as a toast notification; optionally triggers a browser `Notification` API alert if the student has granted permission.

### Database Schema

```sql
Restaurants
  id SERIAL PK, name TEXT, lat FLOAT, lng FLOAT,
  cuisine_type TEXT, avg_prep_time_min INT

MenuItems
  id SERIAL PK, restaurant_id FK, name TEXT,
  base_price INT, category TEXT

InventorySnapshots
  id SERIAL PK, restaurant_id FK, item_id FK,
  timestamp TIMESTAMPTZ, quantity_available INT,
  avg_daily_sold FLOAT, confidence_score FLOAT

SurplusEvents
  id SERIAL PK, restaurant_id FK, item_id FK,
  triggered_at TIMESTAMPTZ, expires_at TIMESTAMPTZ,
  status TEXT CHECK(status IN ('active','expired','fulfilled','cancelled')),
  score FLOAT

FlashDeals
  id SERIAL PK, surplus_event_id FK,
  discount_pct INT, ai_recommended_discount INT,
  gemini_reasoning_snippet TEXT,
  deal_window_start TIMESTAMPTZ, deal_window_end TIMESTAMPTZ

Reservations
  id SERIAL PK, flash_deal_id FK, student_id FK,
  quantity INT,
  status TEXT CHECK(status IN ('pending','confirmed','rejected','completed','no_show')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ, pickup_deadline TIMESTAMPTZ

Students
  id SERIAL PK, name TEXT, college_id INT,
  department TEXT, notification_pref BOOLEAN

BreakWindows
  id SERIAL PK, college_id INT, label TEXT,
  start_time TIME, end_time TIME, days_of_week INT[]
```

Indexes: `SurplusEvents(status, expires_at)`, `FlashDeals(deal_window_end)`, `Reservations(flash_deal_id, status)`, `Restaurants(lat, lng)`.

### File & Directory Structure

```
D:\RescueBite\
├── frontend\                        (React/Vite)
│   ├── src\
│   │   ├── components\              (DealCard, CountdownTimer, ReservationStatus,
│   │   │                             RestaurantDashboard, BreakBellToast, FuelMath)
│   │   ├── pages\                   (StudentFeed, RestaurantView, DemoSwitcher)
│   │   ├── hooks\                   (useSSE, useBreakBell, useDeals)
│   │   ├── lib\                     (api.ts, formatters.ts, constants.ts)
│   │   └── App.tsx
│   ├── public\
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── backend\
│   ├── app\
│   │   ├── main.py                  (FastAPI app entry, lifespan, router mounts)
│   │   ├── routers\
│   │   │   ├── deals.py             (GET /deals, GET /deals/{id})
│   │   │   ├── reservations.py      (POST, PATCH confirm/reject)
│   │   │   ├── restaurants.py       (GET /restaurants/{id}/dashboard)
│   │   │   └── sse.py               (GET /sse/student/{id}, /sse/restaurant/{id})
│   │   ├── services\
│   │   │   ├── surplus_engine.py    (compute_surplus_score, run_engine_tick)
│   │   │   ├── gemini_client.py     (recommend_discount, build_prompt)
│   │   │   ├── scheduler.py         (APScheduler setup, break_bell_job, expiry_job)
│   │   │   └── sse_dispatcher.py    (connection registry, fan_out_event)
│   │   ├── models.py                (SQLAlchemy ORM models)
│   │   ├── schemas.py               (Pydantic v2 request/response schemas)
│   │   ├── database.py              (Supabase/SQLAlchemy engine, session factory)
│   │   └── config.py                (pydantic-settings: DB URL, Gemini API key)
│   ├── seed\
│   │   ├── seed.py                  (CLI entrypoint: python -m seed.seed)
│   │   ├── restaurants.json         (8-10 Shivamogga restaurant fixtures)
│   │   ├── menu_items.json          (menu items per restaurant)
│   │   ├── inventory_patterns.json  (day-of-week × time-of-day demand matrices)
│   │   ├── break_windows.json       (JNNCE official schedule)
│   │   ├── students.json            (5 demo student personas)
│   │   └── demo_scenarios.yaml      (3 scripted judge walkthrough scenarios)
│   ├── tests\
│   │   ├── test_surplus_engine.py   (unit tests for compute_surplus_score)
│   │   ├── test_reservations.py     (state machine transition tests)
│   │   └── test_gemini_client.py    (prompt structure tests with mock responses)
│   ├── requirements.txt
│   └── .env.example
│
└── docs\
    └── designs\
        └── swiggy-campus-rescue.md  (this design document, final destination)
```

### Hosting

| Component | Service | Tier |
|---|---|---|
| Frontend | Vercel | Free |
| Backend | Railway | Free (\$5 credits) |
| Database | Supabase (PostgreSQL) | Free (500 MB) |
| Gemini Flash | Google AI Studio | Free (1M tokens/month) |

Railway chosen over Render: Render's 15-minute inactivity spin-down causes cold-start failures during judge demos.

### Non-Functional Requirements

**Performance**: Gemini Flash calls are async and non-blocking. The deal card can render with a "Calculating discount…" placeholder for <3 seconds while the Gemini call completes.

**Reliability**: all three demo scenarios are pre-seeded with cached Gemini responses. The prototype can run its full judge walkthrough with Gemini API access disabled.

**Observability**: FastAPI structured JSON logging to stdout on Railway. Every SurplusEvent creation, Gemini call, reservation state transition, and SSE dispatch is logged with timestamp and entity ID.

**Security**: no real user data. Gemini API key stored in Railway environment variable, never in source code. `.env.example` committed; `.env` gitignored.

**Rollback**: seed script is idempotent. Re-running `python -m seed.seed` after a schema change restores a clean demo state.

---

## 8. Alternatives Considered

### A8-1: Too Good To Go "Surprise Bag" Model

**What it is**: the restaurant packs whatever surplus items remain into a fixed-price bag. The customer does not know the contents until pickup.

**Why rejected**: Indian college students have strong cuisine preferences and food restrictions (vegetarian/non-vegetarian, allergies, regional taste). Surprise Bags generate high rejection rates and increase restaurant burden when students arrive and refuse the bag. The Break Bell model requires item-level transparency to close the motivation gap.

**What we kept**: the core unit economics insight (fixed-margin surplus clearance). Our model preserves item identity while applying a Gemini-recommended dynamic discount instead of a fixed bag price.

---

### A8-2: WebSockets for Real-Time Updates

**What it is**: bi-directional persistent connections between client and server, commonly used for chat and collaborative applications.

**Why rejected**: server-to-client push only. Bi-directional capability is unnecessary overhead. WebSockets require sticky sessions, which create load balancing complexity on Railway's free tier. SSE (`EventSource`) is stateless, reconnects automatically, and works identically from behind a reverse proxy.

**What we kept**: SSE with exponential backoff reconnection and a visible connection status indicator.

---

### A8-3: ML Prediction Pipeline (Trained Model)

**What it is**: a time-series demand forecasting model (e.g., Prophet, XGBoost) trained on historical sales data to predict surplus with higher accuracy.

**Why rejected**: requires 60–90 days of real historical data per restaurant to produce reliable predictions. Synthetic training data produces unverifiable accuracy claims. Building, training, and validating a model adds 10–14 days of work. At prototype scale on synthetic data, a deterministic rule engine is auditable, explainable, and equally persuasive to judges.

**What we kept**: the rule engine's three-component score is explicitly displayable per event. Judges can inspect why any deal was created. This is a stronger demo than a black-box model outputting a probability.

**Future path**: replace rule engine with a trained model after 60 days of real restaurant data from a pilot.

---

### A8-4: Campus Canteen Integration

**What it is**: extend the system to cover on-campus canteens in addition to off-campus Swiggy restaurant partners.

**Why rejected (deferred)**: campus canteens are not Swiggy partners. Integration requires a separate onboarding flow, different data models (canteen menu is fixed, pricing is institutionally controlled), and negotiation with college administration. This is a viable Phase 2 expansion but out of scope for the competition prototype, which must demonstrate Swiggy partner value.

---

### A8-5: Delivery-First Fulfillment

**What it is**: the standard Swiggy model — student orders and a delivery partner brings the food.

**Why rejected**: at a discounted price of ₹89–₹120, a ₹30–₹50 delivery fee reduces net savings to near zero. Delivery also increases time-to-food beyond the 30–45 minute break window. Students near JNNCE use two-wheelers and are willing to ride to a good deal. Self-pickup preserves the full discount and fits the break window constraint.

**What we kept**: the reservation hold (30 minutes) gives students time to ride to the restaurant without arriving to find the deal expired.

---

### A8-6: FCM Push Notifications

**What it is**: Firebase Cloud Messaging for native push notifications to mobile devices.

**Why rejected (deferred)**: requires a mobile app or PWA with service worker registration. The prototype is a web app. The browser `Notification` API covers the demo need: if the student has the tab open and grants notification permission, they receive the Break Bell alert. FCM is a production enhancement, not a prototype blocker.

---

## 9. Detailed Implementation Plan

> All commands assume the developer is in the specified directory. Backend commands use the system Python in a virtualenv. Frontend commands use pnpm.

### Phase 1: Backend Foundation (Days 1–4)

**Day 1 — Environment & Config**

1. `cd D:\RescueBite\backend`
2. Create virtualenv: `python -m venv .venv && .venv\Scripts\activate`
3. Install dependencies: `pip install fastapi uvicorn[standard] sqlalchemy pydantic-settings apscheduler google-generativeai psycopg2-binary python-dotenv httpx pytest ruff`
4. Write `requirements.txt` from `pip freeze`.
5. Create `app/config.py`:
   ```python
   from pydantic_settings import BaseSettings

   class Settings(BaseSettings):
       database_url: str
       gemini_api_key: str
       environment: str = "development"

       class Config:
           env_file = ".env"

   settings = Settings()
   ```
6. Create `.env.example` with placeholder values. Add `.env` to `.gitignore`.
7. Create `app/database.py` with SQLAlchemy async engine using `DATABASE_URL`.
8. Create `app/main.py` with lifespan context manager (scheduler start/stop) and CORS middleware.

**Verification**: `uvicorn app.main:app --reload` starts without errors. `GET /` returns `{"status": "ok"}`.

---

**Day 2 — Models & Schema**

1. Create `app/models.py` with all 8 SQLAlchemy ORM models (Restaurants, MenuItems, InventorySnapshots, SurplusEvents, FlashDeals, Reservations, Students, BreakWindows). All string enum fields use `CheckConstraint`.
2. Create `app/schemas.py` with Pydantic v2 models for all API request/response shapes. No `model_config` with `arbitrary_types_allowed` — use explicit type annotations only.
3. Run `alembic init alembic` and generate initial migration from models.
4. Apply migration to local Supabase instance (or SQLite for local dev).

**Key schema decisions**:
- `Reservations.status` transitions are enforced at the application layer, not via DB triggers, to keep the schema simple.
- `FlashDeals.discount_pct` is the final applied discount (may differ from `ai_recommended_discount` if bounded by business rules).
- `InventorySnapshots.confidence_score` is a seed-time field (0.0–1.0) used to weight the surplus ratio score. All seed data uses 0.7 as default.

**Verification**: `pytest tests/` passes with 0 errors (models import cleanly, schema validators reject invalid inputs).

---

**Day 3 — Surplus Engine & Gemini Client**

1. Create `app/services/surplus_engine.py`:
   - `break_proximity_score(now: datetime, windows: list[BreakWindow]) -> float`
   - `surplus_ratio_score(quantity: int, avg_daily: float) -> float`
   - `time_of_day_weight(now: datetime) -> float`
   - `compute_surplus_score(snapshot, now, windows) -> float`
   - `run_engine_tick(db: Session) -> list[SurplusEvent]` — queries latest snapshots, computes scores, creates events for score ≥ 0.65, deduplicates (no duplicate active events per restaurant/item pair).

2. Create `app/services/gemini_client.py`:
   - `build_prompt(restaurant, item, snapshot, deal_window_minutes) -> str`
   - `recommend_discount(prompt: str) -> dict[str, int | str]` — calls `gemini-1.5-flash`, parses JSON response, enforces 25–65% bounds, returns `{"discount_pct": int, "reasoning": str}`.
   - `recommend_discount_cached(surplus_event_id, db) -> dict` — checks DB for existing cached response first; only calls Gemini if not cached.

3. Write `tests/test_surplus_engine.py`:
   - `test_break_proximity_score_at_window_start`: expects 1.0.
   - `test_break_proximity_score_120min_before`: expects 0.0.
   - `test_surplus_ratio_score_normal_stock`: expects 0.0 (ratio < 0.3).
   - `test_surplus_ratio_score_high_surplus`: expects > 0.8 (ratio > 2.0).
   - `test_compute_surplus_score_triggers`: expects score ≥ 0.65 for a high-surplus, break-proximate snapshot.
   - `test_compute_surplus_score_no_trigger`: expects score < 0.65 for normal inventory mid-morning.

4. Write `tests/test_gemini_client.py`:
   - `test_build_prompt_contains_required_fields`: asserts prompt includes item name, price, quantity, minutes.
   - `test_recommend_discount_bounds`: mock Gemini returning 80% — verify it is clamped to 65%.
   - `test_recommend_discount_invalid_json`: mock Gemini returning malformed JSON — verify fallback to 40% discount with `"reasoning": "fallback"`.

**Verification**: `pytest tests/test_surplus_engine.py tests/test_gemini_client.py -v` — all tests pass.

---

**Day 4 — Routers & SSE Dispatcher**

1. Create `app/services/sse_dispatcher.py`:
   - `ConnectionRegistry`: dict mapping `student_id → asyncio.Queue` and `restaurant_id → asyncio.Queue`.
   - `register_student(student_id) -> asyncio.Queue`
   - `unregister_student(student_id)`
   - `fan_out_to_students(event: dict)` — iterates all student queues, puts event (non-blocking, drops if queue full at 50 items).
   - `notify_restaurant(restaurant_id, event: dict)` — puts event into single restaurant queue.

2. Create `app/routers/sse.py`:
   - `GET /sse/student/{student_id}`: registers connection, yields `data: {json}\n\n` from queue in an async generator, unregisters on disconnect.
   - `GET /sse/restaurant/{restaurant_id}`: same pattern for restaurant queue.
   - Both endpoints respond with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no` (required for Nginx/Railway proxy).

3. Create `app/routers/deals.py`:
   - `GET /deals`: returns active FlashDeals with joined restaurant/item data, ordered by `deal_window_end ASC`.
   - `GET /deals/{id}`: single deal with full detail including AI reasoning snippet.

4. Create `app/routers/reservations.py`:
   - `POST /reservations`: creates `Reservation` in `PENDING`, sets `pickup_deadline = now + 30 min`, fans out SSE notification to restaurant.
   - `PATCH /reservations/{id}/confirm`: transitions `PENDING → CONFIRMED`, fans out SSE to student.
   - `PATCH /reservations/{id}/reject`: transitions `PENDING → REJECTED`, requires `rejection_reason` body field, fans out SSE to student.
   - `PATCH /reservations/{id}/complete`: transitions `CONFIRMED → COMPLETED` (restaurant-side action).

5. Create `app/routers/restaurants.py`:
   - `GET /restaurants/{id}/dashboard`: returns active deals for the restaurant and all pending/confirmed reservations.

6. Write `tests/test_reservations.py`:
   - `test_create_reservation_valid_deal`: 201 response, `PENDING` status.
   - `test_confirm_reservation`: 200 response, `CONFIRMED` status, SSE event queued.
   - `test_reject_reservation_requires_reason`: 422 if `rejection_reason` missing.
   - `test_confirm_expired_reservation`: 409 if reservation `pickup_deadline` has passed.
   - `test_duplicate_reservation_blocked`: 409 if student already has an active reservation for the same deal.

**Verification**: `pytest tests/ -v` — all tests pass. `ruff check app/` — zero violations.

---

### Phase 2: Scheduler & Seed Data (Days 5–7)

**Day 5 — Scheduler**

1. Create `app/services/scheduler.py`:
   - `create_scheduler() -> AsyncIOScheduler`
   - `surplus_engine_job(db_factory)`: runs `run_engine_tick`, calls `recommend_discount_cached` per new event, fans out SSE, logs each event creation.
   - `break_bell_job(db_factory, dispatcher)`: queries active FlashDeals within 7 km of JNNCE centroid (`lat=13.9299, lng=75.5681`), if any exist, fans out `{"type": "break_bell", "deals": [...]}` SSE event.
   - `expiry_job(db_factory)`: sets `SurplusEvent.status = 'expired'` and `Reservation.status = 'no_show'` for all past-deadline records. Updates restaurant reliability scores.
   - Register: surplus engine every 30 min, break bell at `10:29`, `12:59`, `16:29` on weekdays, expiry every 5 min.

2. Mount scheduler in `app/main.py` lifespan context.

**Verification**: start the app, wait for the first scheduler tick, verify a log line `surplus_engine_tick: N events created`.

---

**Day 6 — Seed Data**

1. Write `seed/restaurants.json` — 8 Shivamogga restaurants with realistic names, coordinates near JNNCE (13.92–13.94°N, 75.56–75.58°E), cuisine types, avg prep times.

   Example restaurants (representative, not verified against real businesses):
   ```json
   [
     {"name": "Biryani House", "lat": 13.931, "lng": 75.572, "cuisine_type": "North Indian", "avg_prep_time_min": 10},
     {"name": "Sri Venkateshwara Meals", "lat": 13.928, "lng": 75.568, "cuisine_type": "South Indian", "avg_prep_time_min": 5},
     {"name": "City Darshini", "lat": 13.933, "lng": 75.574, "cuisine_type": "Darshini", "avg_prep_time_min": 3}
   ]
   ```

2. Write `seed/menu_items.json` — 3–5 items per restaurant covering common student meal categories: rice meals, biryani, dosa, parcel items.

3. Write `seed/inventory_patterns.json` — demand matrices per restaurant per item, keyed `{day_of_week: {hour: {avg_sold: N, std_dev: M}}}`. Use realistic patterns: lunch peak at 12:00–13:00 (avg 15 sold), evening peak at 18:00–19:30 (avg 10 sold), troughs at 14:00–17:00 (avg 2 sold).

4. Write `seed/break_windows.json`:
   ```json
   [
     {"label": "Morning Break", "start_time": "10:30", "end_time": "10:45", "days_of_week": [1,2,3,4,5]},
     {"label": "Lunch Break", "start_time": "13:00", "end_time": "14:00", "days_of_week": [1,2,3,4,5]},
     {"label": "Evening Break", "start_time": "16:30", "end_time": "16:45", "days_of_week": [1,2,3,4,5]}
   ]
   ```

5. Write `seed/students.json` — 5 personas: 2 vegetarian, 1 non-vegetarian, 1 Swiggy One member, 1 budget-first (max ₹80 per meal). These are used as demo actors.

6. Write `seed/demo_scenarios.yaml` — 3 scenarios:
   - **Scenario A (Lunch Rescue)**: Biryani House, 8 Chicken Biryani portions, 1:00 PM trigger, Gemini response pre-cached: `{"discount_pct": 51, "reasoning": "Post-lunch peak surplus of 8 portions with 60-min window. 51% discount maximises clearance probability."}`.
   - **Scenario B (Evening Snack)**: City Darshini, 15 Vada Sambar portions, 4:30 PM trigger, Gemini pre-cached: `{"discount_pct": 38, "reasoning": "Evening snack window. Moderate surplus. 38% discount competitive against full-price alternatives."}`.
   - **Scenario C (Rejection Flow)**: Sri Venkateshwara Meals, Meals sold out at counter mid-reservation — restaurant rejects with reason `item_unavailable`. Used to demo error handling.

7. Write `seed/seed.py`:
   - Loads all JSON/YAML files.
   - Inserts all records with `INSERT ... ON CONFLICT DO NOTHING`.
   - Also inserts pre-cached Gemini responses directly into `FlashDeals` for demo scenarios.
   - Entry point: `python -m seed.seed`.

**Verification**: `python -m seed.seed` exits with code 0. Query DB confirms all 8 restaurants, all menu items, all break windows present. No duplicate rows on re-run.

---

**Day 7 — DemoSwitcher Endpoint**

1. Add `POST /demo/trigger-scenario/{scenario_id}` endpoint (guarded by `settings.environment == "development"` check).
2. This endpoint loads the specified scenario from `demo_scenarios.yaml`, directly inserts a `SurplusEvent` and `FlashDeal` with pre-cached Gemini data, and immediately fans out the SSE event without waiting for the scheduler.
3. This is what the judge uses to trigger a deal in real time during the walkthrough.

**Verification**: `POST /demo/trigger-scenario/A` → SSE event appears on the student feed within 2 seconds.

---

### Phase 3: Frontend (Days 8–14)

**Day 8 — Project Setup**

1. `cd D:\RescueBite\frontend`
2. `pnpm create vite . --template react-ts` (requires BypassSandbox on D: drive).
3. `pnpm add tailwindcss @tailwindcss/vite lucide-react` (BypassSandbox).
4. `pnpm add @radix-ui/react-toast @radix-ui/react-badge` (BypassSandbox).
5. Configure Tailwind in `vite.config.ts`. Set up `src/index.css` with Tailwind directives.
6. Create `src/lib/constants.ts` — API base URL (`http://localhost:8000` for dev, Railway URL for prod).
7. Create `src/lib/api.ts` — typed fetch wrappers for all REST endpoints.
8. Create `src/lib/formatters.ts` — `formatPrice`, `formatCountdown`, `formatDistance`, `formatFuelMath`.

**Verification**: `pnpm run build` exits with 0 errors.

---

**Day 9 — SSE Hook & Deal Feed**

1. Create `src/hooks/useSSE.ts`:
   ```typescript
   export function useSSE(url: string): { events: SSEEvent[]; status: 'live' | 'reconnecting' }
   ```
   Uses native `EventSource`. Handles `open`, `message`, `error` events. Implements exponential backoff reconnect (max 30s).

2. Create `src/hooks/useDeals.ts`:
   - Fetches initial deals from `GET /deals` on mount.
   - Subscribes to SSE student channel.
   - On `new_deal` SSE event, prepends deal to list.
   - On `deal_expired` SSE event, removes deal from list.
   - Returns `{deals, loading, connectionStatus}`.

3. Create `src/components/DealCard.tsx`:
   - Props: `deal: FlashDeal`, `onReserve: (dealId) => void`.
   - Displays: restaurant name, item name, discounted price (large), original price (strikethrough), discount badge, quantity remaining, `CountdownTimer`, `FuelMath` widget, AI reasoning snippet (collapsed by default, expandable).
   - Reserve button: disabled if student already has an active reservation.
   - Prototype disclosure banner: "⚡ Prototype Mode — Inventory data is representative synthetic data."

4. Create `src/components/CountdownTimer.tsx`: accepts `expiresAt: string` (ISO timestamp), displays `MM:SS`, pulses red at <5 minutes.

5. Create `src/components/FuelMath.tsx`: accepts `savedAmount: number`, renders "Net save: ₹{savedAmount - 12} after ~₹12 fuel" (12 is a hardcoded estimate for a 5km round trip at Shivamogga petrol prices).

**Verification**: `pnpm run dev` renders a deal card with mock data. No TypeScript errors (`tsc --noEmit`).

---

**Day 10 — Break Bell Toast & Student Page**

1. Create `src/hooks/useBreakBell.ts`:
   - Listens for `{"type": "break_bell"}` SSE events.
   - Calls `Notification.requestPermission()` on first deal load.
   - On Break Bell event: triggers Radix `Toast` and, if permission granted, `new Notification("🔔 Break time! Flash deals nearby")`.

2. Create `src/components/BreakBellToast.tsx`: Radix Toast with orange accent, deal count, and a "View Deals" CTA that scrolls to the feed.

3. Create `src/pages/StudentFeed.tsx`:
   - Connection status bar (green "● Live" / orange "◌ Reconnecting…").
   - Break Bell toast host.
   - Deal list from `useDeals`.
   - Empty state: "No active deals near JNNCE right now. Check back at the next break."

4. Create `src/pages/DemoSwitcher.tsx`:
   - Three buttons: "Trigger Scenario A", "Trigger Scenario B", "Trigger Scenario C".
   - Each calls `POST /demo/trigger-scenario/{id}`.
   - Visible only in development mode (`import.meta.env.DEV`).

**Verification**: clicking "Trigger Scenario A" in DemoSwitcher causes a deal card to appear on the StudentFeed within 2 seconds.

---

**Day 11–12 — Restaurant Dashboard**

1. Create `src/hooks/useRestaurantDashboard.ts`:
   - Fetches `GET /restaurants/{id}/dashboard` on mount.
   - Subscribes to `GET /sse/restaurant/{id}`.
   - On `new_reservation` SSE event, appends to reservation list.
   - On `reservation_updated` SSE event, updates status in list.

2. Create `src/components/RestaurantDashboard.tsx`:
   - Active deals section: list of FlashDeals with quantity remaining and deal window countdown.
   - Reservations section: list of incoming reservations with student name (or "Student #N" in demo), quantity, timestamp.
   - Each reservation has two buttons: "Confirm" and "Reject."
   - Reject button opens an inline dropdown of reason codes: `item_unavailable`, `quantity_reduced`, `kitchen_closed`, `other`.
   - Restaurant reliability score badge (from `GET /restaurants/{id}/dashboard` response).

3. Create `src/pages/RestaurantView.tsx`:
   - Wraps `RestaurantDashboard`.
   - Restaurant selector dropdown (for demo: switches between the 8 seeded restaurants).

**Verification**: end-to-end test — trigger Scenario A from DemoSwitcher, reserve from StudentFeed, confirm from RestaurantView. StudentFeed shows `CONFIRMED` status within 2 seconds.

---

**Day 13 — Reservation Status & CO₂ Counter**

1. Create `src/components/ReservationStatus.tsx`:
   - Shows current reservation for the demo student.
   - States: `PENDING` (spinner + "Waiting for restaurant to confirm"), `CONFIRMED` (green + reservation ID + pickup deadline), `REJECTED` (red + reason), `COMPLETED` (Rescue Mission badge + CO₂ saved).

2. CO₂ calculation: 1 meal rescued = 2.5 kg CO₂ equivalent avoided (based on WRAP food waste figures — clearly labelled as an estimate in the UI).

3. Create `src/components/RescueMissionBadge.tsx`: displayed on COMPLETED reservations. Shows "🌱 Rescue Mission: 2.5 kg CO₂ saved."

**Verification**: complete a full E2E flow from trigger to COMPLETED. Badge appears on the student side.

---

**Day 14 — Integration, Polish, Build**

1. Compose the full layout in `App.tsx`: split-pane for demo (StudentFeed left, RestaurantView right), DemoSwitcher toolbar at top.
2. Run `ruff check app/` on backend. Fix all violations.
3. Run `tsc --noEmit` on frontend. Fix all type errors.
4. Run `pnpm run build`. Verify 0 errors, bundle size <500 KB.
5. Run `pytest tests/ -v`. All tests pass.
6. Manual walkthrough of all 3 demo scenarios. Time each one. Must complete in <4 minutes.

---

### Phase 4: Deployment & Demo Prep (Days 15–18)

**Day 15 — Supabase & Railway Setup**

1. Create Supabase project. Copy `DATABASE_URL` (pooler URL for Railway compatibility).
2. Run `alembic upgrade head` against Supabase.
3. Run `python -m seed.seed` against Supabase.
4. Create Railway project. Add backend as a service. Set environment variables: `DATABASE_URL`, `GEMINI_API_KEY`, `ENVIRONMENT=production`.
5. Deploy. Verify `GET /` returns `{"status": "ok"}`.
6. Verify Break Bell scheduler fires at the correct time (or trigger manually via `/demo/trigger-scenario/A`).

**Day 16 — Vercel Setup**

1. Push frontend to GitHub.
2. Connect GitHub repo to Vercel. Set `VITE_API_BASE_URL` to the Railway backend URL.
3. Deploy. Verify the student feed loads and SSE connects to Railway backend.
4. Test that CORS allows the Vercel domain.

**Day 17 — Demo Hardening**

1. Run all 3 demo scenarios against the production deployment (Railway + Vercel + Supabase).
2. Verify that pre-cached Gemini responses serve correctly when `GEMINI_API_KEY` is intentionally revoked.
3. Verify SSE reconnects correctly after a 30-second Railway sleep simulation.
4. Record fallback procedure if Railway cold-starts during demo: load the DemoSwitcher URL directly — the seed data ensures all scenarios are pre-loaded and functional without a live scheduler.

**Day 18 — Slide Deck**

Five slides:

1. **Cover**: Swiggy Campus Rescue — turning food waste into student value.
2. **Problem**: Split panel — restaurant surplus post-lunch peak vs. student affordability gap. Campus break schedules as the structural hook.
3. **Solution**: Break Bell flow diagram (scheduler → surplus event → SSE → student notification → reservation → pickup). Include the Gemini discount reasoning card.
4. **Business Case**: Three-column table: Student value (40–65% off, zero friction), Restaurant value (incremental revenue on food that would be discarded), Swiggy value (incremental GMV, partner retention, ESG narrative, Swiggy One upsell hook).
5. **Pilot Plan**: JNNCE pilot with 5 restaurants, 3 metrics: reservation conversion rate, restaurant deal completion rate, average discount applied.

---

### Phase 5: Campus Research (Concurrent — Days 1–14)

**Primary research at JNNCE — mandatory for the submission.**

This runs concurrently with development and must be completed before the submission.

**Survey (5 questions, WhatsApp or Google Form):**
1. How often do you eat at a restaurant (not college canteen) during the college week? (Never / 1–2x / 3–5x / Daily)
2. What is your typical per-meal budget for restaurant food? (< ₹80 / ₹80–₹120 / ₹120–₹200 / > ₹200)
3. If a Swiggy notification arrived during your lunch break saying "Chicken Biryani 50% off at [restaurant], 4 km away, 8 portions left, 30 min window" — would you go? (Definitely / Probably / Probably not / Definitely not)
4. What would stop you from going? (Too far / No vehicle / Don't trust the deal / Prefer to eat on campus / Other)
5. Would you use a vehicle to get a 40%+ discount on a restaurant meal? (Yes, always / Yes, if the saving is > ₹60 / No)

**Target**: 30+ responses from students across at least 3 departments.

**Restaurant interviews (semi-structured, 15 minutes each):**
1. How much food do you typically discard after the lunch service? (quantity estimate)
2. Do you currently offer any discounts on leftover food? If so, how?
3. Would you be willing to publish leftover portions on a Swiggy interface with a 40–60% discount, knowing you'd still recover some revenue?
4. What is the biggest concern about offering time-limited deals on surplus food?
5. How quickly can you confirm or reject a reservation on your phone?

**Target**: 3–5 restaurants within 7 km of JNNCE.

**WhatsApp experiment (qualitative):**
Post in a college WhatsApp group: "Hypothetical: 40% off Veg Thali at [restaurant name], 4 km from college, right now for 30 min. Would you go?" Record Yes/No/Maybe responses and any comments. This is a demand proxy — not a formal survey result, but useful as a qualitative signal.

**Research output for the submission:**
- Survey response summary (chart of Q3 and Q4 responses as the primary demand validation).
- 2–3 direct restaurant interview quotes (with consent, anonymised if preferred).
- WhatsApp experiment response rate.
- Key finding: state the minimum discount threshold that the data reveals.

---

## 10. Verification Plan

Before submission, the following must all pass:

| Check | Command | Expected |
|---|---|---|
| Backend unit tests | `pytest tests/ -v` | All pass, 0 failures |
| Backend linting | `ruff check app/` | 0 violations |
| Frontend type check | `tsc --noEmit` | 0 errors |
| Frontend build | `pnpm run build` | 0 errors, bundle < 500 KB |
| Demo Scenario A | Manual walkthrough | Completes in < 4 min |
| Demo Scenario B | Manual walkthrough | Completes in < 4 min |
| Demo Scenario C | Manual walkthrough (rejection flow) | Rejection reason displayed correctly |
| Offline fallback | Revoke Gemini key, run Demo A | Pre-cached discount served correctly |
| SSE reconnect | Kill backend for 10s, restart | Frontend reconnects automatically, no page refresh |
| Seed idempotency | Run `seed.py` twice | No duplicate rows, no errors |

---

*Design document complete. Copy to `D:\RescueBite\docs\designs\swiggy-campus-rescue.md` for final destination.*
