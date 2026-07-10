"""Unit tests for Qoves-calibrated symmetry scoring."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.cv_report import symmetry_explanation, symmetry_label, symmetry_score


def _symmetric_landmarks():
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    nose_x = 0.5
    pairs = [(33, 263), (133, 362), (61, 291), (105, 334), (159, 386), (145, 374), (234, 454), (127, 356)]
    for li, ri in pairs:
        lms[li] = {"x": nose_x - 0.1, "y": 0.4, "z": 0.02}
        lms[ri] = {"x": nose_x + 0.1, "y": 0.4, "z": 0.02}
    lms[1] = {"x": nose_x, "y": 0.45, "z": 0}
    lms[10] = {"x": nose_x, "y": 0.2, "z": 0}
    lms[152] = {"x": nose_x, "y": 0.8, "z": 0}
    return lms


def _asymmetric_landmarks():
    lms = _symmetric_landmarks()
    lms[33] = {"x": 0.35, "y": 0.38, "z": 0.05}
    lms[263] = {"x": 0.68, "y": 0.44, "z": 0.01}
    lms[234] = {"x": 0.28, "y": 0.35, "z": 0.08}
    lms[454] = {"x": 0.72, "y": 0.50, "z": 0.01}
    return lms


def test_symmetry_score_not_inflated_for_mild_asymmetry():
    score = symmetry_score(_asymmetric_landmarks(), {"symmetry": "94"})
    assert 70 <= score <= 85
    assert score < 90


def test_symmetry_label_quite_symmetric_band():
    assert symmetry_label(76) == "Quite Symmetric"
    assert "notably above average" in symmetry_explanation(76, "Quite Symmetric")


def test_symmetry_ignores_legacy_metrics_symmetry():
    inflated = symmetry_score(_asymmetric_landmarks(), {"symmetry": "97"})
    assert inflated < 90
