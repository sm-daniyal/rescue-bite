from datetime import datetime, time
import pytest

from app.models import BreakWindow, InventorySnapshot
from app.services.surplus_engine import (
    break_proximity_score,
    surplus_ratio_score,
    time_of_day_weight,
    compute_surplus_score,
)


def create_sample_windows() -> list[BreakWindow]:
    # Monday to Friday breaks:
    # 1. Morning break: 10:30 - 10:45
    # 2. Lunch break: 13:00 - 14:00
    # 3. Evening break: 16:30 - 16:45
    return [
        BreakWindow(id=1, label="Morning Break", start_time=time(10, 30), end_time=time(10, 45), days_of_week="1,2,3,4,5"),
        BreakWindow(id=2, label="Lunch Break", start_time=time(13, 0), end_time=time(14, 0), days_of_week="1,2,3,4,5"),
        BreakWindow(id=3, label="Evening Break", start_time=time(16, 30), end_time=time(16, 45), days_of_week="1,2,3,4,5"),
    ]


def test_break_proximity_inside_window():
    windows = create_sample_windows()
    # Wednesday at 13:15 (inside lunch break)
    test_time = datetime(2026, 11, 18, 13, 15)  # 2026-11-18 is a Wednesday
    assert test_time.isoweekday() == 3
    score = break_proximity_score(test_time, windows)
    assert score == 1.0


def test_break_proximity_before_window():
    windows = create_sample_windows()
    # Wednesday at 12:00 (60 minutes before 13:00 lunch break)
    test_time = datetime(2026, 11, 18, 12, 0)
    score = break_proximity_score(test_time, windows)
    # 1.0 - (60 / 120) = 0.5
    assert score == 0.5


def test_break_proximity_far_before_window():
    windows = create_sample_windows()
    # Wednesday at 08:00 (150 minutes before 10:30)
    test_time = datetime(2026, 11, 18, 8, 0)
    score = break_proximity_score(test_time, windows)
    assert score == 0.0


def test_surplus_ratio_low():
    # Normal operations: 2 available vs 10 avg daily sold -> ratio 0.2 < 0.3
    score = surplus_ratio_score(quantity_available=2, avg_daily_sold=10.0)
    assert score == 0.0


def test_surplus_ratio_extreme():
    # Heavy surplus: 25 available vs 10 avg daily sold -> ratio 2.5 >= 2.0
    score = surplus_ratio_score(quantity_available=25, avg_daily_sold=10.0)
    assert score == 1.0


def test_surplus_ratio_midpoint():
    # Midpoint: ratio = 1.15
    # (1.15 - 0.3) / (2.0 - 0.3) = 0.85 / 1.7 = 0.5
    score = surplus_ratio_score(quantity_available=23, avg_daily_sold=20.0)
    assert pytest.approx(score, 0.01) == 0.5


def test_time_of_day_weights():
    # Post-lunch trough (14:30)
    assert time_of_day_weight(datetime(2026, 11, 18, 14, 30)) == 0.90
    # Post-dinner wrap-up (21:00)
    assert time_of_day_weight(datetime(2026, 11, 18, 21, 0)) == 0.95
    # Active lunch (12:30)
    assert time_of_day_weight(datetime(2026, 11, 18, 12, 30)) == 0.65
    # Late night / early morning (03:00)
    assert time_of_day_weight(datetime(2026, 11, 18, 3, 0)) == 0.20


def test_composite_surplus_score_trigger():
    windows = create_sample_windows()
    # At 12:45 (15 min before lunch break -> proximity = 1 - 15/120 = 0.875)
    test_time = datetime(2026, 11, 18, 12, 45)
    # High surplus snapshot: 22 available vs 10 avg daily -> ratio 2.2 -> surplus_score = 1.0
    # time_of_day at 12:45 -> 0.65
    # Expected: 0.4 * 0.875 (0.35) + 0.4 * 1.0 (0.4) + 0.2 * 0.65 (0.13) = 0.88 >= 0.65
    snap = InventorySnapshot(
        restaurant_id=1,
        item_id=1,
        timestamp=test_time,
        quantity_available=22,
        avg_daily_sold=10.0,
    )
    score = compute_surplus_score(snap, test_time, windows)
    assert score >= 0.65
    assert pytest.approx(score, 0.02) == 0.88
