# Swiggy Campus Rescue — Design Document

*   **Author:** sm-daniyal
*   **Status:** Shipped Simulation (v1.0) — Ready for Cloud Deployment
*   **Date:** 2026-11-25 (Updated from 2026-11-19 Draft)
*   **Competition:** Swiggy Food for Thought 2.0 (2026–27)
*   **Campus Context:** JNNCE, Shivamogga, Karnataka

---

## 1. Overview

Swiggy Campus Rescue (project codename **RescueBite**) is a two-sided surplus food distress marketplace designed for the Swiggy ecosystem. It predicts which restaurant partners will accumulate unsold portions around campus break windows, computes dynamic clearance discounts via Google Gemini Flash (25–65%, default 40% fallback), and coordinates real-time time-locked self-pickup holds (`30` minutes) over Server-Sent Events (SSE).

The system separates consumer, merchant, and competition evaluator workflows across three isolated web routes:

1.  **Student Consumer App (`/` — Mobile-First PWA)**: Built primarily for smartphone viewports (`< 768px`) with a sticky bottom tab bar and `44px`+ touch targets, while scaling to a desktop sidebar + 3-column break layout on `>= 768px`.
2.  **Restaurant Partner Merchant POS (`/partner`)**: Full-width dark-theme kitchen terminal focused strictly on incoming reservation queues, `10`-minute confirmation SLAs, auditable rejection reason codes, pickup completion, and reliability scoring.
3.  **Judge Evaluation Console (`/demo`)**: Isolated control console allowing competition judges to trigger pre-cached Scenarios A, B, and C cleanly in separate tabs and inspect live SSE telemetry latency.

All UI surfaces follow a strict **zero-emoji policy**, relying exclusively on Lucide SVG iconography and clean typography. Simulated inventory fixtures are pre-seeded deterministically for Shivamogga eateries near JNNCE, while the surplus scoring engine, reservation state machine, and SSE push pipeline run live.

---

## 2. Problem

### Student Pain Point

Students near JNNCE face a narrow set of affordable meal options on campus. Sit-down restaurants `2–5 km` away are typically priced at `₹120–₹250` per meal — viable occasionally, not daily. Students have no real-time signal when nearby kitchens hold surplus food at steep discounts during short college break intervals.

### Restaurant Partner Pain Point

Campus-adjacent eateries experience sharp demand spikes during lunch (`12:00–13:30`) and evening service (`16:30–18:30`), leaving prepared portions unsold afterward. Unsold meals generate zero revenue and direct spoilage cost, yet Swiggy currently offers no surplus-triggered dynamic discounting workflow tied to break schedules.

### Market Gap

Existing Swiggy promotions (`Partner Offers`, `Swiggy One`) are static and manually configured rather than time-bounded clearance events. Meanwhile, delivery fees (`₹30–₹50`) destroy the unit economics of sub-`₹120` surplus meals, making **self-pickup** (`0` delivery fleet cost) the structurally viable fulfillment mode for students with two-wheelers.

---

## 3. Goals

### Primary Goals (Shipped in v1.0 Simulation)

1.  **Route Isolation**: Separate `/` (Student Consumer), `/partner` (Merchant POS), and `/demo` (Judge Console) cleanly via React Router.
2.  **Mobile-First PWA Consumer Experience**: Sticky mobile bottom navigation (`Flash Deals`, `Schedule`, `My Holds`, `Impact`), search toggle, veg-only and category filtering, `h-dvh` safe framing, `manifest.json`, and mobile home-screen icons.
3.  **Deterministic Surplus Rule Engine**: Auditable `3`-signal scoring engine (`0.40` break proximity + `0.40` surplus ratio + `0.20` time-of-day weight, threshold `>= 0.65`).
4.  **Cost-Safe Gemini Flash Pricing**: Single-shot discount recommendation (`25%–65%` bounds) at surplus event creation time with pre-cached demo bypass and guaranteed `40%` fallback on error or quota exhaustion.
5.  **Real-Time Dual-Sided SSE**: Live sub-2-second synchronization over native `EventSource` (`GET /sse/student/{id}` and `GET /sse/restaurant/{id}`) with exponential backoff auto-reconnect.
6.  **Time-Locked Self-Pickup Reservations**: Complete `pending -> confirmed / rejected -> completed / no_show` API state machine (`30`-min hold, duplicate hold prevention, auditable rejection codes).
7.  **Zero-Failure Judge Walkthrough**: `/demo` console invoking `POST /demo/trigger-scenario/{A|B|C}` with pre-cached scenarios in `demo_scenarios.yaml` plus live latency inspection.
8.  **Zero Emojis**: 100% verified absence of emojis across frontend source, HTML, and PWA manifest.

### Secondary / UX Goals Implemented

-   **Fuel Math Calculator (`DealCard.tsx`)**: Computes net savings after estimated `₹12` round-trip two-wheeler fuel expense.
-   **Campus Sustainability Ledger (`Impact` tab)**: Displays meals diverted, `~2.5 kg` CO2e per meal ratio, and student wallet savings.
-   **Restaurant Reliability Score**: Surfaced on merchant terminal (`PartnerTerminal.tsx`) alongside active discounted INR deal prices.

---

## 4. Non-Goals (Out of Scope for Simulation v1.0)

-   **No Live Swiggy / POS API Integration**: Proprietary Swiggy internal APIs and Petpooja/UrbanPiper kitchen webhooks are out of scope; synthetic Shivamogga fixtures stand in cleanly.
-   **No Live Payment Gateway KYC**: Students settle via Cash or UPI at counter pickup; prepaid UPI/escrow is scoped under Real-World Production Graduation (§9 Stage B).
-   **No Delivery Fleet Dispatch**: Self-pickup only during campus break windows.
-   **No ML Forecasting Pipeline**: Deterministic rule engine avoids unverifiable accuracy claims on synthetic data.
-   **No Multi-Campus Authentication**: Uses demo student (`id=1`, `Rahul Sharma`) and 8-partner switcher until OTP/JWT auth is added in Stage B.

---

## 5. Open Questions

| # | Question | Current Assumption | Validation Channel |
|---|---|---|---|
| OQ-1 | Minimum discount (%) motivating students to ride `2–5 km` during breaks? | `40%–50%` off (`> ₹60` net saving) | JNNCE Campus Survey ([survey_questions.md](file:///D:/RescueBite/docs/survey_questions.md)) |
| OQ-2 | Will merchants manually confirm reservations or require auto-confirm? | Manual counter confirm (`10`-min SLA) | Shivamogga merchant interviews |
| OQ-3 | Break Bell alert conversion vs. passive discovery feed? | Break Bell creates urgency at `T-1` min | Scenario B walkthrough + survey Q3/Q7 |
| OQ-4 | Daily post-peak surplus volume per campus-adjacent outlet? | `4–15` portions per service window | Merchant interviews (`3–5` outlets) |
| OQ-5 | Does single-worker FastAPI SSE stay stable for competition judging? | Yes (`≤ 50` queued events per client on Railway) | Cloud load check after Railway deploy |

---

## 6. Critical User Journeys

### CUJ-1: Student Discovers and Reserves a Flash Deal (`/`)

1.  **Trigger**: Scenario A or surplus event publishes `Hyderabadi Chicken Biryani` at `51%` off (`₹175 -> ₹86`).
2.  **Mobile Feed**: Student opens `/` on phone (or installed PWA), sees countdown timer (`45:00`), Fuel Math (`Net save: ₹77 (-₹12 fuel)`), Veg/Non-Veg indicator, and expandable Gemini rationale.
3.  **Reserve Hold**: Student taps `Reserve Hold` (`>= 44px` tap target). `POST /reservations` creates `pending` hold (`#RB-{id}`, `30`-min deadline) and notifies merchant over SSE.
4.  **Live Confirmation**: Merchant confirms on `/partner`. Student receives `reservation_update` SSE event (`pending -> confirmed`), shows `#RB-{id}` at counter, pays Cash/UPI on pickup.

### CUJ-2: Merchant Counter Fulfillment & Auditable Rejection (`/partner`)

1.  **Queue Arrival**: Counter tablet/desktop on `/partner` receives `new_reservation` SSE frame (deduplicated into Incoming Student Holds queue).
2.  **Confirmation / Rejection**:
    -   Confirm: `PATCH /reservations/{id}/confirm` moves ticket to `Confirmed — Awaiting Pickup` and notifies student immediately.
    -   Stockout Rejection (Scenario C): Selecting `Reject` reveals inline audit codes (`item_unavailable`, `quantity_reduced`, `kitchen_closed`, `other`), calling `PATCH /reservations/{id}/reject`.
3.  **Completion**: Selecting `Mark Picked Up` invokes `PATCH /reservations/{id}/complete`, transitioning status to `completed`.

### CUJ-3: Competition Judge Evaluation (`/demo`)

1.  Evaluator opens `/` in Tab 1 (or mobile viewport) and `/partner` in Tab 2, while keeping `/demo` open in Tab 3.
2.  Evaluator triggers **Scenario A** (`Biryani Paradise`, Outlet `#5`), **Scenario B** (`Meenakshi Bhavan Darshini`, Outlet `#3`, fires Break Bell banner/toast), or **Scenario C** (`Sri Venkateshwara Grand`, Outlet `#2`, rejection flow).
3.  `/demo` displays backend health (`GET /`), active deal count (`GET /deals`), Gemini reasoning output, and live `/sse/student/1` event arrival latency in milliseconds.

---

## 7. Implemented System Architecture

### Component Map

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    Frontend SPA — Vercel / Vite + React 19               │
│  Route "/" (StudentApp)     Route "/partner"        Route "/demo"         │
│  - Mobile bottom tab bar    - Dark merchant POS     - Scenario A/B/C      │
│  - Desktop sidebar + 3-col  - Confirm / Reject SLA  - Health & deal sync  │
│  - DealCard + Fuel Math     - Active INR prices     - Live SSE latency    │
│  - BreakBell Banner/Toast   - Reliability % card      telemetry log       │
│            │                         │                        │           │
│            └────────── EventSource ──┼──────── EventSource ───┘           │
└──────────────────────────────────────┼────────────────────────────────────┘
                                       │ REST + SSE (VITE_API_BASE_URL)
┌──────────────────────────────────────▼────────────────────────────────────┐
│                    Backend API — Railway / FastAPI + Python 3.12          │
│  SSE Dispatcher (app/services/sse_dispatcher.py):                         │
│  - In-memory sets of asyncio.Queue per student_id & restaurant_id        │
│  - GET /sse/student/{id}   |   GET /sse/restaurant/{id} (+20s keepalive)  │
│                                                                           │
│  REST Routers (app/routers/):                                             │
│  - deals.py: GET /deals, GET /deals/{id}                                  │
│  - reservations.py: POST, PATCH confirm / reject / complete               │
│  - restaurants.py: GET /restaurants/{id}/dashboard                        │
│  - demo.py: GET /demo/scenarios, POST /demo/trigger-scenario/{id}         │
│                                                                           │
│  Core Logic (app/services/):                                              │
│  - surplus_engine.py: 3-component scoring (>= 0.65 triggers deal)         │
│  - gemini_client.py: gemini-1.5-flash single-shot + 40% error fallback    │
│                                                                           │
│  Persistence (app/models.py, database.py):                                │
│  - SQLAlchemy 2.0 Async + aiosqlite locally (rescuebite_dev.db)           │
│  - Models: Restaurant, MenuItem, InventorySnapshot, SurplusEvent,         │
│            FlashDeal, Reservation, Student, BreakWindow                   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Key Codebase Contracts (Verified)

-   **Surplus Engine (`app/services/surplus_engine.py`)**:
    -   `compute_surplus_score = 0.40 * break_proximity_score + 0.40 * surplus_ratio_score + 0.20 * time_of_day_weight`
    -   `threshold = 0.65` (`settings.surplus_score_threshold`) creates a `45`-minute `SurplusEvent` + `FlashDeal`.
-   **Gemini Client (`app/services/gemini_client.py`)**:
    -   Uses `gemini-1.5-flash` (`temperature=0.2`, `max_output_tokens=128`), strips Markdown fences, clamps `discount_pct` to `[25, 65]`, and falls back cleanly to `40%` on exception/uninitialized key.
    -   `recommend_discount_for_event` bypasses API calls when cached demo response is supplied.
-   **Demo Router (`app/routers/demo.py`)**:
    -   Guarded by `if settings.environment != "development": raise HTTPException(403, ...)`.
    -   Scenario B emits `{"type": "break_bell", "deal_count": 1, "deals": [...]}`; Scenarios A & C emit `{"type": "new_deal", "deal": ...}`.
-   **Scheduler Status Note**:
    -   `app/services/scheduler.py` (APScheduler automated background loop) is intentionally **not yet mounted** in `app/main.py` (`lifespan` creates DB tables in `development` mode). Surplus deals currently come from idempotent seed fixtures (`python -m seed.seed`) and `/demo/trigger-scenario/{A|B|C}`. Automated background scheduling moves to **Next Stage** (§9 Stage B).

### Verified Directory Structure

```
D:\RescueBite\
├── frontend\                             (React 19 + TypeScript + Vite 8 + Tailwind v4)
│   ├── public\
│   │   ├── manifest.json                 (PWA standalone manifest)
│   │   ├── icon-192.png                  (192x192 PNG app icon)
│   │   ├── icon-512.png                  (512x512 maskable PNG app icon)
│   │   └── favicon.svg                   (Branded orange SR icon)
│   ├── src\
│   │   ├── main.tsx                      (BrowserRouter: /, /partner, /demo)
│   │   ├── index.css                     (Tailwind v4 + slideIn/hide toast keyframes)
│   │   ├── pages\
│   │   │   ├── StudentApp.tsx            (Mobile-first PWA + Desktop 3-col view)
│   │   │   ├── PartnerTerminal.tsx       (Dark-theme Merchant POS terminal)
│   │   │   └── DemoConsole.tsx           (Judge evaluation & SSE telemetry console)
│   │   ├── components\
│   │   │   ├── DealCard.tsx              (Countdown, ₹12 fuel math, Gemini rationale)
│   │   │   └── BreakBellToast.tsx        (Desktop Radix toast notification)
│   │   ├── hooks\
│   │   │   ├── useDeals.ts               (REST bootstrap + live SSE deal stream + expiry filter)
│   │   │   └── useSSE.ts                 (Typed EventSource wrapper with backoff reconnect)
│   │   └── lib\
│   │       ├── api.ts                    (Typed fetch client & contract interfaces)
│   │       ├── constants.ts              (VITE_API_BASE_URL configuration)
│   │       └── foodImages.ts             (Category-mapped Unsplash meal imagery)
│   ├── index.html                        (Mobile viewport-fit=cover, Apple/PWA meta tags)
│   ├── vercel.json                       (SPA rewrite for /partner and /demo)
│   ├── .env.example                      (VITE_API_BASE_URL template)
│   └── package.json
│
├── backend\                              (FastAPI + SQLAlchemy Async + Pydantic v2)
│   ├── app\
│   │   ├── main.py                       (FastAPI app, CORS, router mounts)
│   │   ├── config.py                     (Pydantic BaseSettings)
│   │   ├── database.py                   (Async SQLAlchemy engine & table bootstrap)
│   │   ├── models.py                     (8 ORM models + check constraints + indexes)
│   │   ├── schemas.py                    (Pydantic v2 API & SSE contracts)
│   │   ├── routers\                      (deals.py, reservations.py, restaurants.py, sse.py, demo.py)
│   │   └── services\                     (surplus_engine.py, gemini_client.py, sse_dispatcher.py)
│   ├── seed\
│   │   ├── seed.py                       (Idempotent CLI seeder: python -m seed.seed)
│   │   ├── restaurants.json              (8 Shivamogga partner outlets)
│   │   ├── menu_items.json               (32 menu items)
│   │   ├── break_windows.json            (JNNCE 10:30, 13:00, 16:30 break schedule)
│   │   ├── students.json                 (5 student personas)
│   │   └── demo_scenarios.yaml           (Scenarios A/B/C with pre-cached Gemini JSON)
│   ├── tests\                            (21 tests: demo, gemini_client, health, routers, surplus_engine)
│   ├── Procfile                          (web: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000})
│   ├── railway.toml                      (Nixpacks + healthcheckPath="/")
│   ├── requirements.txt
│   └── .env.example
│
├── docs\
│   ├── concepts_brief.md
│   ├── survey_questions.md               (7-question Google Form script)
│   └── designs\swiggy-campus-rescue.md   (Canonical repository design document)
└── NEXT_STEPS.md                         (Deployment & next-stage runbook)
```

---

## 8. Alternatives Considered

| Alternative | Decision & Rationale |
|---|---|
| **GitHub Pages (`github.io`) Hosting** | **Rejected**: Static file hosting only; cannot execute Python/FastAPI, SQLite/Postgres, or long-lived SSE streams. |
| **Render Free Tier Backend** | **Rejected**: Spins down after 15 minutes of inactivity, introducing `50–90s` cold-start hangs that break live judge demos and drop SSE streams. Approved stack: **Vercel (frontend) + Railway (backend)**. |
| **Monolithic Split-Screen (`App.tsx`)** | **Rejected (Replaced in v1.0)**: Putting student consumer browsing and restaurant POS actions on the same terminal broke real-world role separation and ruined smartphone ergonomics. Replaced by isolated routes `/`, `/partner`, `/demo`. |
| **Too Good To Go "Surprise Bag"** | **Rejected**: Dietary restrictions (veg vs. non-veg, allergies) in Indian college cohorts require explicit dish-level transparency instead of blind mystery bags. |
| **Delivery-First Fulfillment** | **Rejected**: Delivery fees wipe out savings on `₹50–₹110` clearance meals and exceed `15–60` minute campus break windows. Self-pickup preserves net student savings. |
| **WebSockets Instead of SSE** | **Rejected**: Push notifications and live ticker updates are server-to-client; `EventSource` works natively behind reverse proxies with automatic reconnection. |

---

## 9. Next Stage Implementation Roadmap

### Stage A — Competition Ship & Live Demo Launch (Immediate)

1.  **Git Commit & Push**: Commit isolated frontend routes, PWA assets, Vercel/Railway configs, and updated EGM docs to `origin/main`.
2.  **Deploy Backend to Railway** (`Root Directory = backend`):
    -   Configure `GEMINI_API_KEY` and `DATABASE_URL=sqlite+aiosqlite:///./rescuebite_dev.db`.
    -   Keep `ENVIRONMENT=development` for the competition/judge demo environment so startup `create_all_tables()` and `/demo/trigger-scenario/{A|B|C}` stay enabled (`ENVIRONMENT=production` intentionally returns `403` on `/demo`).
    -   Verify `PyYAML` availability (`PyYAML==6.0.3` is imported by `app/routers/demo.py` and `seed/seed.py`; add explicitly to `requirements.txt` if Railway image strips transitive dependencies).
    -   Run `python -m seed.seed` inside Railway shell to seed the 8 restaurants, 32 items, 3 break windows, and active deals.
3.  **Deploy Frontend to Vercel** (`Root Directory = frontend`):
    -   Set Vercel Environment Variable `VITE_API_BASE_URL` to the Railway HTTPS URL.
    -   Verify `vercel.json` SPA rewrites work when loading `/partner` and `/demo` directly.
4.  **End-to-End Demo & Mobile Verification**:
    -   Open `/` on smartphone Chrome/Safari -> test bottom tabs, filtering, and "Add to Home Screen" PWA installability.
    -   Execute Scenarios A, B, and C across `/` + `/partner` + `/demo` in `< 4` minutes and confirm `GEMINI_API_KEY` offline fallback works.
5.  **Primary Campus Research & Submission Package**:
    -   Circulate `docs/survey_questions.md` (`20–30+` student responses across JNNCE/Shivamogga region) and conduct `3–5` brief merchant interviews.
    -   Complete the 5-slide competition deck + `< 5` min screen-recorded demo walkthrough.

### Stage B — Real-World Production Graduation (Commercial Deployment Gap Plan)

Moving beyond a competition simulation into live Swiggy operations requires seven non-negotiable upgrades:

1.  **Authentication & Role-Based Access Control (RBAC)**:
    -   Replace hardcoded `STUDENT_ID = 1` and open `/partner` restaurant dropdown with OTP/JWT login (e.g., Supabase Auth or Firebase Auth) and server-side ownership enforcement on `/reservations/*` and `/restaurants/{id}/dashboard`.
2.  **Multi-Worker Real-Time & Persistent Scheduler**:
    -   Replace single-process in-memory `SSEDispatcher` (`asyncio.Queue` dicts in `sse_dispatcher.py`) with **Redis Pub/Sub** or **Supabase Realtime** so multiple Uvicorn workers fan out events reliably to `1,000+` students at break bell.
    -   Implement and mount persistent **APScheduler** (backed by PostgreSQL/Redis job store) in `app/main.py` lifespan to execute 30-min `run_engine_tick` sweeps, `T-1` min `break_bell` pushes, and `5`-min expiry/reliability jobs across container restarts.
3.  **Managed PostgreSQL, Migrations & Atomic Concurrency**:
    -   Migrate from local SQLite to Supabase/managed PostgreSQL (`asyncpg` driver + Alembic migrations).
    -   Enforce atomic portion decrement (`SELECT ... FOR UPDATE` or optimistic version lock) on `POST /reservations` so concurrent break-bell traffic never oversells limited portions.
    -   Add short-TTL caching (Redis / in-memory `3s`) on `GET /deals` for break-bell traffic spikes.
4.  **Live POS Inventory Synchronization**:
    -   Replace static seed snapshots with Swiggy internal partner inventory APIs / POS middleware webhooks (Petpooja, UrbanPiper).
5.  **Prepaid UPI Hold & Pickup Verification**:
    -   Integrate Razorpay / Juspay UPI pre-authorization or small commitment deposits to prevent student no-shows, paired with short counter pickup OTP/QR verification on `/partner`.
6.  **Background Web Push (FCM / Service Worker)**:
    -   Add a Service Worker + Firebase Cloud Messaging (FCM) so students receive Break Bell alerts when their phone screen is locked or browser tabs are backgrounded.
7.  **Production Security & Regulatory Hardening**:
    -   Tighten FastAPI CORS `allow_origins` in `app/main.py` from `["*"]` to exact frontend origins.
    -   Set `ENVIRONMENT=production` to lock `/demo/*` endpoints (`403`).
    -   Surface partner FSSAI registration numbers, hygiene timestamps, and batch-prepared time windows per Indian food-safety compliance.

---

## 10. Verification Status (Observed Baseline)

| Check | Command | Observed Result (2026-11-25) |
|---|---|---|
| Backend Unit & Router Tests | `cd D:\RescueBite\backend; .\.venv\Scripts\pytest -v` | `21/21` passed (`5.29s`) |
| Backend Linter | `cd D:\RescueBite\backend; .\.venv\Scripts\ruff.exe check app tests` | `0` violations |
| Frontend TypeScript | `cd D:\RescueBite\frontend; pnpm exec tsc -b` | `0` errors |
| Frontend Linter | `cd D:\RescueBite\frontend; pnpm run lint` (`oxlint`) | `0` errors (`5` pre-existing hook/compiler warnings) |
| Frontend Production Build | `cd D:\RescueBite\frontend; pnpm run build` | Passed (`1.27s`; JS `373.46 kB`, CSS `41.35 kB`, PWA files in `dist/`) |
| Zero-Emoji Compliance | Python regex check across `src/`, `index.html`, `manifest.json` | `0` emojis |
| Cloud Live Smoke (A/B/C) | `/demo` + `/` + `/partner` on Vercel + Railway | **Pending Stage A deployment** |
| Campus Primary Research | Google Form (`docs/survey_questions.md`) | **Pending student response collection** |
