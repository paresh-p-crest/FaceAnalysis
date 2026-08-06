"""Tests for face parsing metrics (assumed-scale mm metadata)."""

from backend.face_parsing_metrics import SCALE_KEY, compute_parsing_metrics


def _sample_landmarks():
    # MediaPipe order: landmarks stored positionally, index == landmark id.
    ids = [
        0, 2, 4, 9, 10, 17, 33, 37, 55, 61, 70, 105, 127, 129, 133, 144, 145, 152, 153, 158, 159, 160,
        168, 172, 214, 234, 236, 263, 267, 285, 291, 300, 334, 356, 358, 362, 373, 374, 380, 385, 386, 387,
        397, 434, 456, 454,
    ]
    ys = {
        0: 0.62, 2: 0.55, 4: 0.53, 9: 0.42, 10: 0.12, 17: 0.65, 33: 0.40, 105: 0.33,
        152: 0.75, 263: 0.40, 334: 0.33,
    }
    arr = [None] * (max(ids) + 1)
    for i in ids:
        arr[i] = {"id": i, "x": 0.5, "y": ys.get(i, 0.5), "z": 0.0}
    return [d if d is not None else {"id": i, "x": 0.5, "y": 0.5, "z": 0.0} for i, d in enumerate(arr)]


def test_metrics_include_assumed_scale_on_mm():
    metrics = compute_parsing_metrics(_sample_landmarks(), 1000, 1200, labels=None)
    assert "nose" in metrics
    nasal = metrics["nose"].get("nasal_width_mm")
    assert nasal is not None
    assert nasal["unit"] == "mm"
    assert nasal["scale"] == SCALE_KEY


def test_empty_landmarks_returns_empty():
    assert compute_parsing_metrics([], 100, 100) == {}


def test_compute_facial_thirds_lines():
    import numpy as np
    from backend.face_parsing_metrics import compute_facial_thirds_lines
    from backend.cv_report import proportions_from_landmarks

    # Synthetic 100x100 label mask
    labels = np.zeros((100, 100), dtype=np.int32)
    labels[5:20, :] = 13  # Hair
    labels[25:35, 20:40] = 4  # Left eye
    labels[25:35, 60:80] = 5  # Right eye
    labels[30:35, 40:60] = 6  # Eyebrow
    labels[40:55, 45:55] = 2  # Nose
    labels[60:90, 30:70] = 1  # Skin / Chin

    landmarks = _sample_landmarks()
    result = compute_facial_thirds_lines(labels, landmarks, 100, 100)
    assert result is not None
    assert "hairlineY" in result
    assert "eyebrowY" in result
    assert "noseBaseY" in result
    assert "chinY" in result
    assert 0.0 <= result["hairlineY"] < result["eyebrowY"] < result["noseBaseY"] < result["chinY"] <= 1.0

    # Verify proportions_from_landmarks actually uses the SegFormer metrics,
    # not the MediaPipe fallback (synthetic thirds differ from _sample_landmarks).
    prop = proportions_from_landmarks(landmarks, {"facialThirds": result})
    assert prop.get("score") is not None
    u = float(prop["upperThird"])
    m = float(prop["middleThird"])
    l = float(prop["lowerThird"])
    assert abs(u + m + l - 1.0) < 0.01
    # Synthetic labels: hair 0.05-0.20, brow ~0.33, nose ~0.55, chin ~0.90
    assert abs(u - (0.33 - 0.20) / (0.90 - 0.20)) < 0.05  # upper ~0.19
    assert abs(m - (0.55 - 0.33) / (0.90 - 0.20)) < 0.05  # middle ~0.31
    assert abs(l - (0.90 - 0.55) / (0.90 - 0.20)) < 0.05  # lower ~0.50
    # MediaPipe path alone would give a different upper third (~0.30), so this
    # fails if the function regresses to ignoring the metrics argument.
    assert u < 0.26

