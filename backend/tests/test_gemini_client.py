from unittest.mock import MagicMock, patch
from app.services.gemini_client import (
    build_prompt,
    recommend_discount,
    recommend_discount_for_event,
    _FALLBACK,
)


def test_build_prompt_fields():
    prompt = build_prompt(
        restaurant_name="Biryani House",
        cuisine="North Indian",
        item_name="Chicken Biryani",
        base_price=180,
        quantity=8,
        window_minutes=30,
    )
    assert "Biryani House" in prompt
    assert "Chicken Biryani" in prompt
    assert "₹180" in prompt
    assert "8 portions" in prompt
    assert "30 minutes" in prompt
    assert "25–65" in prompt


def test_recommend_discount_clamped_high():
    # If LLM hallucinates 90% discount, it must be clamped to 65% max
    mock_resp = MagicMock()
    mock_resp.text = '{"discount_pct": 90, "reasoning": "Clear everything immediately."}'

    with patch("app.services.gemini_client._model") as mock_model:
        mock_model.generate_content.return_value = mock_resp
        result = recommend_discount("test prompt")
        assert result["discount_pct"] == 65
        assert "Clear everything" in result["reasoning"]


def test_recommend_discount_clamped_low():
    # If LLM hallucinates 10% discount, it must be raised to 25% min
    mock_resp = MagicMock()
    mock_resp.text = '{"discount_pct": 10, "reasoning": "Small discount."}'

    with patch("app.services.gemini_client._model") as mock_model:
        mock_model.generate_content.return_value = mock_resp
        result = recommend_discount("test prompt")
        assert result["discount_pct"] == 25


def test_recommend_discount_markdown_fence_parsing():
    # If Gemini returns markdown ```json { ... } ```
    mock_resp = MagicMock()
    mock_resp.text = '```json\n{"discount_pct": 45, "reasoning": "Optimal break window pricing."}\n```'

    with patch("app.services.gemini_client._model") as mock_model:
        mock_model.generate_content.return_value = mock_resp
        result = recommend_discount("test prompt")
        assert result["discount_pct"] == 45
        assert result["reasoning"] == "Optimal break window pricing."


def test_recommend_discount_exception_handling():
    # Network down or invalid JSON -> MUST return fallback without raising exception
    with patch("app.services.gemini_client._model") as mock_model:
        mock_model.generate_content.side_effect = RuntimeError("Network timeout")
        result = recommend_discount("test prompt")
        assert result["discount_pct"] == _FALLBACK["discount_pct"]
        assert "fallback" in result["reasoning"].lower() or "unavailable" in result["reasoning"].lower()


def test_recommend_discount_cached_bypass():
    # If cache exists, it shouldn't touch the Gemini API at all
    with patch("app.services.gemini_client.recommend_discount") as mock_call:
        result = recommend_discount_for_event(
            restaurant_name="Biryani House",
            cuisine="North Indian",
            item_name="Chicken Biryani",
            base_price=180,
            quantity=8,
            window_minutes=30,
            cached_discount=51,
            cached_reasoning="Pre-cached judge scenario discount.",
        )
        assert result["discount_pct"] == 51
        assert "Pre-cached" in result["reasoning"]
        mock_call.assert_not_called()
