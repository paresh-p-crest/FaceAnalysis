"""Unit tests for MediaPipe-calibrated prototypicality scoring."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.prototypicality import (
    _compute_score,
    _face_proportions,
    _measure_deviations,
    compute_prototypicality_report,
    get_prototypicality_norms,
    prototypicality_range_label,
)


def _demo_like_landmarks() -> list:
    """Landmarks approximating public/demo-photos/front.png ratios."""
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    lms[10] = {"x": 0.5, "y": 0.35, "z": 0}
    lms[152] = {"x": 0.5, "y": 0.75, "z": 0}
    lms[2] = {"x": 0.5, "y": 0.58, "z": 0}
    lms[1] = {"x": 0.5, "y": 0.54, "z": 0}
    lms[33] = {"x": 0.38, "y": 0.47, "z": 0}
    lms[263] = {"x": 0.62, "y": 0.47, "z": 0}
    lms[172] = {"x": 0.34, "y": 0.72, "z": 0}
    lms[397] = {"x": 0.66, "y": 0.72, "z": 0}
    lms[127] = {"x": 0.30, "y": 0.50, "z": 0}
    lms[356] = {"x": 0.70, "y": 0.50, "z": 0}
    lms[48] = {"x": 0.465, "y": 0.57, "z": 0}
    lms[278] = {"x": 0.535, "y": 0.57, "z": 0}
    # Balanced mirror pairs for symmetry
    for li, ri in [(133, 362), (61, 291), (105, 334), (159, 386), (145, 374), (234, 454), (127, 356)]:
        lms[li] = {"x": 0.40, "y": 0.48, "z": 0.02}
        lms[ri] = {"x": 0.60, "y": 0.48, "z": 0.02}
    return lms


def test_face_proportions_use_jaw_and_cheek_landmarks():
    props = _face_proportions(_demo_like_landmarks())
    assert 0.75 < props["face_ratio"] < 0.95
    assert 0.25 < props["nose_ratio"] < 0.42
    assert abs(props["upper_third"] + props["middle_third"] + props["lower_third"] - 1.0) < 0.05


def test_demo_like_face_scores_in_qoves_band():
    answers = {"ethnicity": "white", "genderPreference": "no-preference"}
    report = compute_prototypicality_report(_demo_like_landmarks(), {}, answers)
    assert 60 <= report["score"] <= 82
    assert "typical side overall" in report["explanation"].lower()


def test_narrow_jaw_direction_when_below_norm():
    answers = {"ethnicity": "white", "genderPreference": "no-preference"}
    norms = get_prototypicality_norms(answers)
    lms = _demo_like_landmarks()
    devs = _measure_deviations(lms, {}, norms)
    jaw = next(d for d in devs if d["feature"] == "jaw width")
    props = _face_proportions(lms)
    if props["face_ratio"] < norms["faceWidthHeight"]:
        assert jaw["direction"] == "narrower"


def test_score_not_collapsed_for_moderate_deviation():
    answers = {"ethnicity": "white"}
    norms = get_prototypicality_norms(answers)
    devs = _measure_deviations(_demo_like_landmarks(), {}, norms)
    assert _compute_score(devs) >= 60
