"""Lateral profile cephalometrics from profile photos."""

from __future__ import annotations

import math
from typing import Optional

from .calibration import norm_dist_to_mm
from .face_crop import lm


def _dist(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _angle_deg(a: dict, vertex: dict, c: dict) -> float:
    ab = (a["x"] - vertex["x"], a["y"] - vertex["y"])
    cb = (c["x"] - vertex["x"], c["y"] - vertex["y"])
    dot = ab[0] * cb[0] + ab[1] * cb[1]
    mag = math.hypot(*ab) * math.hypot(*cb)
    if mag < 1e-9:
        return 0.0
    return math.degrees(math.acos(max(-1.0, min(1.0, dot / mag))))


def _profile_landmarks(landmarks: list) -> dict:
    """Best-effort soft-tissue proxies from MediaPipe on profile."""
    return {
        "glabella": lm(landmarks, 10),
        "subnasale": lm(landmarks, 2),
        "pronasale": lm(landmarks, 1),
        "pogonion": lm(landmarks, 152),
        "upperLip": lm(landmarks, 13),
        "lowerLip": lm(landmarks, 14),
        "earTop": lm(landmarks, 234),
        "earBottom": lm(landmarks, 454),
        "noseBase": lm(landmarks, 98),
        "neck": lm(landmarks, 152),
    }


def _facial_convexity(pts: dict) -> float:
    return round(_angle_deg(pts["glabella"], pts["subnasale"], pts["pogonion"]), 1)


def _classify_convexity(angle: float) -> str:
    if angle < 165:
        return "convex"
    if angle > 175:
        return "concave"
    return "orthognathic"


def _e_line_lip_distances(pts: dict, mm_per_unit: Optional[float]) -> dict:
    """Signed perpendicular distance from lips to line pronasale→pogonion."""
    a, b = pts["pronasale"], pts["pogonion"]
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    line_len = math.hypot(dx, dy) or 1e-9

    def signed_dist(lip: dict) -> float:
        # Cross product gives signed area; divide by line length for distance
        cross = (lip["x"] - a["x"]) * dy - (lip["y"] - a["y"]) * dx
        d_norm = cross / line_len
        mm = norm_dist_to_mm(abs(d_norm), mm_per_unit)
        sign = -1 if cross < 0 else 1
        return round(sign * mm, 2) if mm is not None else round(sign * d_norm * 100, 2)

    return {
        "eLineUpperLipMm": signed_dist(pts["upperLip"]),
        "eLineLowerLipMm": signed_dist(pts["lowerLip"]),
    }


def _naso_aural_ratio(pts: dict) -> float:
    ear_h = abs(pts["earTop"]["y"] - pts["earBottom"]["y"])
    nose_h = abs(pts["pronasale"]["y"] - pts["noseBase"]["y"])
    if nose_h < 1e-6:
        return 1.0
    return round(ear_h / nose_h, 2)


def _nasolabial_angle(pts: dict) -> float:
    return round(_angle_deg(pts["pronasale"], pts["subnasale"], pts["upperLip"]), 1)


def _chin_projection_norm(pts: dict) -> float:
    """Horizontal chin vs subnasale vertical reference."""
    return round(pts["pogonion"]["x"] - pts["subnasale"]["x"], 4)


def analyze_profile(landmarks: list, pose_id: str = "rightProfile", mm_per_unit: Optional[float] = None) -> Optional[dict]:
    if not landmarks:
        return None
    pts = _profile_landmarks(landmarks)
    convexity = _facial_convexity(pts)
    e_line = _e_line_lip_distances(pts, mm_per_unit)
    naso_aural = _naso_aural_ratio(pts)
    nasolabial = _nasolabial_angle(pts)
    chin_proj = _chin_projection_norm(pts)
    chin_mm = norm_dist_to_mm(abs(chin_proj), mm_per_unit)

    ear_protrusion = round(abs(pts["earBottom"]["x"] - pts["pogonion"]["x"]), 4)

    return {
        "poseId": pose_id,
        "measurements": {
            "facialConvexityDeg": convexity,
            "nasolabialAngleDeg": nasolabial,
            "nasoAuralRatio": naso_aural,
            "chinProjectionNorm": chin_proj,
            "chinProjectionMm": chin_mm,
            "earProtrusionNorm": ear_protrusion,
            **e_line,
        },
        "classification": {
            "convexity": _classify_convexity(convexity),
            "chinProjection": "protruded" if chin_proj > 0.02 else ("recessed" if chin_proj < -0.02 else "balanced"),
            "nasoAural": "Ear > Nose" if naso_aural > 1.05 else ("Ear < Nose" if naso_aural < 0.95 else "Ear = Nose"),
        },
        "dataSource": "measured",
        "overlay": {
            "convexityPoints": [
                {"id": "G", "x": pts["glabella"]["x"], "y": pts["glabella"]["y"]},
                {"id": "Sn", "x": pts["subnasale"]["x"], "y": pts["subnasale"]["y"]},
                {"id": "Pog", "x": pts["pogonion"]["x"], "y": pts["pogonion"]["y"]},
            ],
            "eLine": [
                {"x": pts["pronasale"]["x"], "y": pts["pronasale"]["y"]},
                {"x": pts["pogonion"]["x"], "y": pts["pogonion"]["y"]},
            ],
            "nasoAural": {
                "earTop": pts["earTop"],
                "earBottom": pts["earBottom"],
                "noseTop": pts["pronasale"],
                "noseBottom": pts["noseBase"],
            },
        },
    }


def build_profile_report(views: dict, mm_per_unit: Optional[float] = None) -> dict:
    right = views.get("rightProfile", {})
    left = views.get("leftProfile", {})
    right_lm = right.get("landmarks", []) if right.get("success") else []
    left_lm = left.get("landmarks", []) if left.get("success") else []

    primary_pose = "rightProfile" if right_lm else ("leftProfile" if left_lm else None)
    primary_lm = right_lm or left_lm
    primary = analyze_profile(primary_lm, primary_pose or "rightProfile", mm_per_unit) if primary_lm else None

    left_analysis = analyze_profile(left_lm, "leftProfile", mm_per_unit) if left_lm else None
    right_analysis = analyze_profile(right_lm, "rightProfile", mm_per_unit) if right_lm else None

    asymmetry = {}
    if left_analysis and right_analysis:
        lc = left_analysis["measurements"]["facialConvexityDeg"]
        rc = right_analysis["measurements"]["facialConvexityDeg"]
        asymmetry = {
            "convexityDelta": round(abs(lc - rc), 1),
            "chinProjectionDelta": round(
                abs(
                    left_analysis["measurements"]["chinProjectionNorm"]
                    - right_analysis["measurements"]["chinProjectionNorm"]
                ),
                4,
            ),
        }

    return {
        "primaryView": primary_pose,
        "scaleMmPerUnit": mm_per_unit,
        "rightProfile": right_analysis,
        "leftProfile": left_analysis,
        "primary": primary,
        "asymmetry": asymmetry,
        "dataSource": "measured" if primary else "unavailable",
    }
