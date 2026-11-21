"""
Gemini Flash discount recommendation client.

Design rules:
- ONE call per SurplusEvent, response cached in FlashDeals table.
- Never called per page view or per SSE event.
- ALL exceptions are caught — a Gemini failure must NEVER crash the app.
- Fallback: 40% discount with reasoning = "fallback" (pre-cached demo responses
  are stored in the DB, so the judge demo works fully offline).
"""

import json
import logging
from typing import Any

import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError

from app.config import settings

logger = logging.getLogger(__name__)

# Configure once at import time
try:
    genai.configure(api_key=settings.gemini_api_key)
    _model = genai.GenerativeModel("gemini-1.5-flash")
    logger.info("Gemini Flash client initialised")
except Exception as exc:  # broad — SDK init must not crash startup
    _model = None
    logger.warning("Gemini client init failed: %s — fallback mode active", exc)


# ── Fallback constant ─────────────────────────────────────────────────────────

_FALLBACK: dict[str, Any] = {
    "discount_pct": 40,
    "reasoning": "AI recommendation unavailable — default 40% applied.",
}


# ── Prompt builder ────────────────────────────────────────────────────────────

def build_prompt(
    restaurant_name: str,
    cuisine: str,
    item_name: str,
    base_price: int,
    quantity: int,
    window_minutes: int,
) -> str:
    return (
        f"You are a restaurant surplus pricing assistant.\n"
        f"Restaurant: {restaurant_name} ({cuisine})\n"
        f"Surplus item: {item_name}, base price ₹{base_price}\n"
        f"Surplus quantity: {quantity} portions\n"
        f"Deal window closes in: {window_minutes} minutes\n\n"
        f"Recommend a discount percentage (integer, 25–65 inclusive) to maximise "
        f"clearance probability while recovering revenue. "
        f"Respond ONLY with valid JSON on a single line:\n"
        f'{{ "discount_pct": <int>, "reasoning": "<one concise sentence>" }}'
    )


# ── Core call with full error isolation ───────────────────────────────────────

def recommend_discount(prompt: str) -> dict[str, Any]:
    """
    Call Gemini Flash and return a discount recommendation.

    Returns _FALLBACK on ANY failure — network error, quota exhaustion,
    malformed JSON, missing fields, out-of-range values. The app never crashes.
    """
    if _model is None:
        logger.warning("Gemini model not initialised — returning fallback")
        return _FALLBACK.copy()

    try:
        response = _model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.2,       # low variance — we want consistent discounts
                max_output_tokens=128, # plenty for {"discount_pct": 45, "reasoning": "..."}
            ),
        )

        raw = response.text.strip()
        logger.debug("Gemini raw response: %s", raw)

        # Strip markdown code fences if the model wraps in ```json ... ```
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data: dict[str, Any] = json.loads(raw)

        # Validate and clamp discount
        discount_pct = int(data["discount_pct"])
        discount_pct = max(settings.min_discount_pct,
                           min(settings.max_discount_pct, discount_pct))

        reasoning = str(data.get("reasoning", "")).strip()
        if not reasoning:
            reasoning = f"AI recommended {discount_pct}% discount."

        logger.info("Gemini recommended %d%% — %s", discount_pct, reasoning)
        return {"discount_pct": discount_pct, "reasoning": reasoning}

    except (GoogleAPIError, Exception) as exc:
        # Log but DO NOT re-raise — surplus event creation must succeed even if
        # Gemini is down
        logger.error("Gemini call failed: %s — returning fallback", exc)
        return _FALLBACK.copy()


# ── Cached wrapper (checks DB before calling Gemini) ─────────────────────────

def recommend_discount_for_event(
    restaurant_name: str,
    cuisine: str,
    item_name: str,
    base_price: int,
    quantity: int,
    window_minutes: int,
    cached_discount: int | None = None,
    cached_reasoning: str | None = None,
) -> dict[str, Any]:
    """
    Use this in the surplus engine. If a cached response already exists
    (from demo_scenarios seed data), return it without calling Gemini.
    """
    if cached_discount is not None and cached_reasoning:
        logger.info(
            "Using cached Gemini response: %d%% — %s",
            cached_discount, cached_reasoning,
        )
        return {"discount_pct": cached_discount, "reasoning": cached_reasoning}

    prompt = build_prompt(
        restaurant_name, cuisine, item_name, base_price, quantity, window_minutes
    )
    return recommend_discount(prompt)
