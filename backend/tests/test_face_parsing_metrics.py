"""Tests for face parsing metrics (assumed-scale mm metadata)."""

from backend.face_parsing_metrics import SCALE_KEY, compute_parsing_metrics


def _sample_landmarks():
    ids = [
        0, 2, 4, 9, 10, 17, 33, 37, 55, 61, 70, 105, 127, 129, 133, 144, 145, 152, 153, 158, 159, 160,
        168, 172, 214, 234, 236, 263, 267, 285, 291, 300, 334, 356, 358, 362, 373, 374, 380, 385, 386, 387,
        397, 434, 456, 454,
    ]
    return [{"id": i, "x": 0.5, "y": 0.5, "z": 0.0} for i in ids]


def test_metrics_include_assumed_scale_on_mm():
    metrics = compute_parsing_metrics(_sample_landmarks(), 1000, 1200, labels=None)
    assert "nose" in metrics
    nasal = metrics["nose"].get("nasal_width_mm")
    assert nasal is not None
    assert nasal["unit"] == "mm"
    assert nasal["scale"] == SCALE_KEY


def test_empty_landmarks_returns_empty():
    assert compute_parsing_metrics([], 100, 100) == {}
