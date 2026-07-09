"""Unit tests for profile_cephalometrics.py"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.profile_cephalometrics import analyze_profile


def _profile_landmarks():
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    lms[10] = {"x": 0.5, "y": 0.2, "z": 0}   # glabella
    lms[2] = {"x": 0.5, "y": 0.45, "z": 0}   # subnasale
    lms[1] = {"x": 0.55, "y": 0.42, "z": 0}  # pronasale
    lms[152] = {"x": 0.52, "y": 0.75, "z": 0}  # pogonion
    lms[13] = {"x": 0.53, "y": 0.48, "z": 0}
    lms[14] = {"x": 0.53, "y": 0.52, "z": 0}
    lms[234] = {"x": 0.3, "y": 0.35, "z": 0}
    lms[454] = {"x": 0.3, "y": 0.55, "z": 0}
    lms[98] = {"x": 0.52, "y": 0.48, "z": 0}
    return lms


def test_facial_convexity_near_orthognathic():
    result = analyze_profile(_profile_landmarks(), "rightProfile", mm_per_unit=100)
    assert result is not None
    angle = result["measurements"]["facialConvexityDeg"]
    assert 150 < angle < 190
    assert result["classification"]["convexity"] in ("orthognathic", "convex", "concave")
    assert result["measurements"]["nasoAuralRatio"] > 0
