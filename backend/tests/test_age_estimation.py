"""Tests for InsightFace age estimation and 5-year visual age range rounding."""

from backend.opencv_metrics import visual_age_range, visual_age_range_label, compute_metrics_from_landmarks
from backend.age_estimation import estimate_visual_age


def test_visual_age_range_rounding():
    assert visual_age_range(28) == (25, 30)
    assert visual_age_range_label(28) == "25-30"

    assert visual_age_range(23) == (20, 25)
    assert visual_age_range_label(23) == "20-25"

    assert visual_age_range(27) == (25, 30)
    assert visual_age_range_label(27) == "25-30"

    assert visual_age_range(20) == (20, 25)
    assert visual_age_range_label(20) == "20-25"

    assert visual_age_range(None) is None
    assert visual_age_range_label(None) is None


def test_estimate_visual_age_none_on_empty():
    assert estimate_visual_age(b"") is None
    assert estimate_visual_age(b"invalid_image_bytes") is None
    from backend.age_estimation import estimate_visual_age_and_gender
    assert estimate_visual_age_and_gender(b"") is None
    assert estimate_visual_age_and_gender(b"invalid_image_bytes") is None


def test_compute_metrics_from_landmarks_includes_age_range():
    landmarks = [{"id": i, "x": 0.5, "y": 0.5, "z": 0.0} for i in range(10)]
    metrics = compute_metrics_from_landmarks(landmarks)
    assert "visualAge" in metrics
    assert "visualAgeRange" in metrics
    assert "visualAgeRangeLabel" in metrics
    assert "visualGender" in metrics
    assert metrics["visualAgeRange"] == [25, 30]
    assert metrics["visualAgeRangeLabel"] == "25-30"
