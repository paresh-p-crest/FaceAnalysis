"""Oblique (45°) view analysis."""

from __future__ import annotations

import math
from typing import Optional

from .face_crop import lm


def _dist(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def analyze_quarter_view(landmarks: list, pose_id: str) -> Optional[dict]:
    if not landmarks:
        return None

    temple = lm(landmarks, 10)
    jaw = lm(landmarks, 152)
    cheek = lm(landmarks, 234)
    nose_tip = lm(landmarks, 1)
    brow = lm(landmarks, 105)

    jaw_angle_proxy = math.degrees(
        math.atan2(abs(jaw["y"] - cheek["y"]), abs(jaw["x"] - cheek["x"]) + 1e-6)
    )
    midface_depth = abs(nose_tip["x"] - cheek["x"])
    temple_recession = brow["y"] - temple["y"]
    cheek_prominence = abs(cheek["x"] - nose_tip["x"])

    return {
        "poseId": pose_id,
        "obliqueJawAngleDeg": round(jaw_angle_proxy, 1),
        "midfaceDepthRatio": round(midface_depth, 4),
        "templeRecessionScore": round(temple_recession * 100, 2),
        "cheekProjectionIndex": round(cheek_prominence, 4),
        "dataSource": "measured",
    }


def build_quarter_report(views: dict) -> dict:
    sides = {}
    for pose_id in ("left45", "right45"):
        view = views.get(pose_id, {})
        if view.get("success") and view.get("landmarks"):
            sides[pose_id] = analyze_quarter_view(view["landmarks"], pose_id)

    asymmetry = {}
    if "left45" in sides and "right45" in sides:
        asymmetry = {
            "cheekProjectionDelta": round(
                abs(sides["left45"]["cheekProjectionIndex"] - sides["right45"]["cheekProjectionIndex"]),
                4,
            ),
            "jawAngleDelta": round(
                abs(sides["left45"]["obliqueJawAngleDeg"] - sides["right45"]["obliqueJawAngleDeg"]),
                1,
            ),
        }

    return {
        "sides": sides,
        "asymmetry": asymmetry,
        "dataSource": "measured" if sides else "unavailable",
    }
