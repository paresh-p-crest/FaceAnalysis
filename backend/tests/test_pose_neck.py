"""Tests for MediaPipe Pose neck integration."""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.cv_report import neck_metrics
from backend.pose_analysis import LEFT_EAR, LEFT_SHOULDER, RIGHT_EAR, RIGHT_SHOULDER


def _face_landmarks():
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    lms[152] = {"x": 0.5, "y": 0.72, "z": 0}  # chin
    lms[10] = {"x": 0.5, "y": 0.18, "z": 0}  # forehead
    lms[33] = {"x": 0.38, "y": 0.4, "z": 0}
    lms[263] = {"x": 0.62, "y": 0.4, "z": 0}
    lms[234] = {"x": 0.32, "y": 0.58, "z": 0}
    lms[454] = {"x": 0.68, "y": 0.58, "z": 0}
    lms[127] = {"x": 0.28, "y": 0.5, "z": 0}
    lms[356] = {"x": 0.72, "y": 0.5, "z": 0}
    return lms


def _pose_with_shoulders(forward: bool = False):
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.0} for _ in range(33)]
    # Shoulders below chin
    lms[LEFT_SHOULDER] = {"x": 0.35, "y": 0.88, "z": 0, "visibility": 0.9}
    lms[RIGHT_SHOULDER] = {"x": 0.65, "y": 0.88, "z": 0, "visibility": 0.9}
    ear_x = 0.58 if forward else 0.5
    lms[LEFT_EAR] = {"x": ear_x - 0.05, "y": 0.42, "z": 0, "visibility": 0.9}
    lms[RIGHT_EAR] = {"x": ear_x + 0.05, "y": 0.42, "z": 0, "visibility": 0.9}
    return {
        "landmarks": lms,
        "shouldersVisible": True,
        "earsVisible": True,
    }


def test_neck_metrics_approximate_without_pose():
    result = neck_metrics(_face_landmarks())
    assert result["dataSource"] == "approximate"
    assert "limitation" in result
    assert result["lengthBasis"] == "jaw-proxy"


def test_neck_metrics_measured_with_pose_shoulders():
    result = neck_metrics(_face_landmarks(), _pose_with_shoulders(forward=False))
    assert result["dataSource"] == "measured"
    assert result["lengthBasis"] == "jaw-to-shoulder"
    assert "limitation" not in result
    assert result.get("shoulderWidthPct") is not None
    assert result.get("headPostureAngleDeg") is not None
    assert result["headPosture"] == "Neutral"
    # Chin at y=0.72, shoulders at y=0.88 → positive length in Balanced band
    assert float(result["neckLength"]) > 20
    assert result["neckLengthClass"] == "Balanced"


def test_neck_metrics_forward_posture_angle():
    result = neck_metrics(_face_landmarks(), _pose_with_shoulders(forward=True))
    assert result["dataSource"] == "measured"
    assert result["headPosture"] == "Forward tilt"
    assert result["headPostureAngleDeg"] > 0
