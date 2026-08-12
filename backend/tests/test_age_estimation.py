"""Tests for MiVOLO age estimation and 5-year visual age range rounding."""

from backend.opencv_metrics import visual_age_range, visual_age_range_label, compute_metrics_from_landmarks
from backend.age_estimation import estimate_visual_age, reset_mivolo_cache


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


def test_mivolo_ensure_uses_hf_cache_dir(monkeypatch, tmp_path):
    from backend import age_estimation

    reset_mivolo_cache()
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    called = {}

    def _ensure():
        from backend.model_store import hf_cache_dir

        called["cache"] = str(hf_cache_dir())
        return False  # soft-fail load

    monkeypatch.setattr(age_estimation, "ensure_mivolo_weights", _ensure)
    model, proc = age_estimation._get_mivolo_app()
    assert model is None
    assert called["cache"] == str(tmp_path / "models" / "huggingface")
    reset_mivolo_cache()


def test_mivolo_failed_init_allows_retry(monkeypatch, tmp_path):
    from backend import age_estimation

    reset_mivolo_cache()
    state = {"n": 0}

    def _ensure():
        state["n"] += 1
        return False

    monkeypatch.setattr(age_estimation, "ensure_mivolo_weights", _ensure)
    assert age_estimation._get_mivolo_app() == (None, None)
    assert age_estimation._get_mivolo_app() == (None, None)
    assert state["n"] == 2  # not permanently latched
    reset_mivolo_cache()
