"""Unit tests for calibration.py"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.calibration import (
    build_calibration,
    compute_scale_from_mouth,
    mouth_width_normalized,
)


def _mock_landmarks():
    return [
        {"x": 0.0, "y": 0.0, "z": 0.0} for _ in range(478)
    ]


def test_mouth_scale():
    lms = _mock_landmarks()
    lms[61] = {"x": 0.4, "y": 0.5, "z": 0}
    lms[291] = {"x": 0.6, "y": 0.5, "z": 0}
    w = mouth_width_normalized(lms)
    assert math.isclose(w, 0.2, rel_tol=1e-3)
    scale = compute_scale_from_mouth(lms, 50.0)
    assert scale is not None
    assert math.isclose(scale, 250.0, rel_tol=1e-3)


def test_build_calibration_warning():
    lms = _mock_landmarks()
    lms[61] = {"x": 0.4, "y": 0.5, "z": 0}
    lms[291] = {"x": 0.6, "y": 0.5, "z": 0}
    lms[13] = {"x": 0.5, "y": 0.55, "z": 0}
    lms[2] = {"x": 0.5, "y": 0.5, "z": 0}
    profile = list(lms)
    profile[13] = {"x": 0.5, "y": 0.56, "z": 0}
    profile[2] = {"x": 0.5, "y": 0.5, "z": 0}
    cal = build_calibration(
        {"mouthWidthMm": "50", "philtrumLengthMm": "5"},
        lms,
        profile,
    )
    assert cal["mmPerUnit"] is not None
    assert cal.get("warning") is not None
