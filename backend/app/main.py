from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_all_tables
from app.routers import deals, reservations, restaurants, sse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    if settings.environment == "development":
        await create_all_tables()
    # Scheduler start will be added in Phase 2
    yield
    # Shutdown (scheduler stop will be added in Phase 2)


app = FastAPI(
    title="Swiggy Campus Rescue",
    description="Surplus food marketplace for college students",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten to Vercel URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.environment}


# Routers
app.include_router(deals.router, prefix="/deals", tags=["deals"])
app.include_router(reservations.router, prefix="/reservations", tags=["reservations"])
app.include_router(restaurants.router, prefix="/restaurants", tags=["restaurants"])
app.include_router(sse.router, prefix="/sse", tags=["sse"])
# demo router will be enabled in Step 8 (Demo Hardening)
