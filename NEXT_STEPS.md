# RescueBite — Ship & Next-Stage Runbook

Last Updated: 2026-11-25
Design Document: [docs/designs/swiggy-campus-rescue.md](docs/designs/swiggy-campus-rescue.md)

---

## 1. Current Verification Status

| Component | Status | Verified Result |
|---|---|---|
| Backend Core (`FastAPI + SQLAlchemy Async`) | COMPLETE | `21/21` pytest passing (`5.29s`), `ruff check app tests` 0 violations |
| Seed Fixtures & Demo Scenarios (`A/B/C`) | COMPLETE | `8` restaurants, `32` menu items, `3` break windows, cached Gemini responses |
| Route-Isolated Frontend (`/`, `/partner`, `/demo`) | COMPLETE | `pnpm exec tsc -b` 0 errors, `pnpm run lint` 0 errors, `pnpm run build` clean (`373.46 kB` JS) |
| Mobile-First PWA (`manifest.json` + PNG icons) | COMPLETE | `h-dvh` mobile bottom nav, `44px+` tap targets, `0` emojis across source |
| Deployment Configs (`vercel.json`, `railway.toml`, `Procfile`) | COMPLETE | Ready for Railway + Vercel setup |

---

## 2. Local Development Commands

### Backend (`D:\RescueBite\backend`)

```powershell
cd D:\RescueBite\backend
.\.venv\Scripts\activate
python -m seed.seed
python -m pytest tests/ -v
.\.venv\Scripts\ruff.exe check app tests
uvicorn app.main:app --reload --port 8000
```

### Frontend (`D:\RescueBite\frontend`)

```powershell
cd D:\RescueBite\frontend
pnpm exec tsc -b
pnpm run lint
pnpm run build
pnpm run dev
```

Open in separate browser tabs/devices:
- Student Consumer App: `http://localhost:5173/`
- Partner Merchant POS: `http://localhost:5173/partner`
- Judge Evaluation Console: `http://localhost:5173/demo`

---

## 3. Next Stage Part A — Cloud Competition Deployment

### Step 1: Commit and Push
```powershell
cd D:\RescueBite
git status
git add .
git commit -m "Complete route isolation, PWA manifest, deployment configs, and EGM doc sync"
git push origin main
```

### Step 2: Deploy Backend to Railway
1. Create Railway service pointing to GitHub repo with Root Directory = `backend`.
2. Railway automatically uses `backend/railway.toml` (`nixpacks`, `healthcheckPath = "/"`).
3. Configure environment variables:
   - `GEMINI_API_KEY=<your-google-ai-studio-key>`
   - `DATABASE_URL=sqlite+aiosqlite:///./rescuebite_dev.db`
   - `ENVIRONMENT=development` (Required for competition walkthroughs so `create_all_tables()` and `POST /demo/trigger-scenario/*` remain enabled; `ENVIRONMENT=production` locks `/demo/*` with `403`.)
   - Note: If Railway prunes transitive packages, add `PyYAML==6.0.3` to `backend/requirements.txt`.
4. Run initial seed via Railway CLI/shell:
   - `python -m seed.seed`
5. Verify `GET https://<railway-url>/` returns `{"status": "ok", "env": "development"}`.

### Step 3: Deploy Frontend to Vercel
1. Import GitHub repo in Vercel with Root Directory = `frontend`.
2. Set environment variable:
   - `VITE_API_BASE_URL=https://<your-railway-domain>`
3. Deploy. Verify `vercel.json` handles direct loads of `/partner` and `/demo`.

### Step 4: Competition Submission Checklist
- [ ] Mobile test on `/` (viewport `360–430px`, "Add to Home Screen" PWA check)
- [ ] Cross-tab live SSE verification: `/demo` -> `/` -> `/partner` across Scenarios A, B, C (`< 4` min)
- [ ] Offline Gemini key test: verify cached responses serve on Scenario A/B/C
- [ ] Campus Google Form (`docs/survey_questions.md`) distributed (`20–30+` student responses)
- [ ] `3–5` brief Shivamogga merchant validation conversations documented
- [ ] 5-slide competition deck + `< 5` min demo video recorded

---

## 4. Next Stage Part B — Real-World Production Requirements

To transition this simulation into a live Swiggy production launch:

1. **Authentication & RBAC**: Phone OTP / JWT login (`Supabase Auth` or `Firebase Auth`); remove hardcoded `STUDENT_ID = 1` and enforce merchant tenant ownership on `/partner` and reservation mutations.
2. **Multi-Worker Real-Time Fan-Out**: Replace in-memory `SSEDispatcher` (`asyncio.Queue` sets) with Redis Pub/Sub or Supabase Realtime so multiple Uvicorn workers broadcast Break Bell and reservation events consistently.
3. **Persistent Background Scheduler**: Implement and mount APScheduler in `app/main.py` lifespan backed by Redis/PostgreSQL job store (`30`-min `run_engine_tick`, `T-1` min `break_bell`, `5`-min expiry & reliability scoring).
4. **PostgreSQL + Atomic Portion Locking**: Switch `DATABASE_URL` to Supabase/managed PostgreSQL (`asyncpg`), add Alembic migrations, and wrap reservation creation in row-level locking (`SELECT ... FOR UPDATE`) to prevent overselling during break-bell traffic spikes.
5. **Live Partner POS Synchronization**: Replace static seed snapshots with live Petpooja / UrbanPiper / Swiggy merchant inventory webhooks.
6. **Prepaid UPI Commitment & Pickup QR/OTP**: Add Razorpay / Juspay UPI escrow or pre-auth + short pickup OTP/QR verification on `/partner` to prevent no-shows.
7. **Background Lock-Screen Push & Security Lockdown**: Add a Service Worker + FCM Web Push for background Break Bells, lock `allow_origins` in `app/main.py` to exact Vercel origin, switch `ENVIRONMENT=production` to disable `/demo/*`, and attach FSSAI license / batch-time hygiene disclosures.
