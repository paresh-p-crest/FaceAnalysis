"""Physical scale calibration — pixels to mm via ruler measurements (Qoves-style)."""

from __future__ import annotations

import math
from typing import Optional

from .face_crop import lm


def _dist(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _parse_mm(value) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        v = float(value)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def mouth_width_normalized(landmarks: list) -> float:
    """Commissure-to-commissure distance in normalized coords."""
    left = lm(landmarks, 61)
    right = lm(landmarks, 291)
    return _dist(left, right)


def philtrum_length_normalized(landmarks: list) -> float:
    """Upper lip to subnasale proxy in normalized coords."""
    upper_lip = lm(landmarks, 13)
    subnasale = lm(landmarks, 2)
    return abs(upper_lip["y"] - subnasale["y"])


def compute_scale_from_mouth(landmarks: list, mouth_width_mm: float) -> Optional[float]:
    """Returns mm per normalized unit."""
    w = mouth_width_normalized(landmarks)
    if w < 0.001 or mouth_width_mm <= 0:
        return None
    return mouth_width_mm / w


def compute_scale_from_philtrum(landmarks: list, philtrum_mm: float) -> Optional[float]:
    p = philtrum_length_normalized(landmarks)
    if p < 0.001 or philtrum_mm <= 0:
        return None
    return philtrum_mm / p


def build_calibration(answers: dict, front_landmarks: list, profile_landmarks: Optional[list] = None) -> dict:
    mouth_mm = _parse_mm(answers.get("mouthWidthMm"))
    philtrum_mm = _parse_mm(answers.get("philtrumLengthMm"))
    method = answers.get("scalingMethod") or "ruler_measurement"

    scale_mouth = compute_scale_from_mouth(front_landmarks, mouth_mm) if mouth_mm else None
    scale_philtrum = None
    if philtrum_mm and profile_landmarks:
        scale_philtrum = compute_scale_from_philtrum(profile_landmarks, philtrum_mm)

    primary_scale = scale_mouth or scale_philtrum
    warning = None
    if scale_mouth and scale_philtrum:
        divergence = abs(scale_mouth - scale_philtrum) / max(scale_mouth, scale_philtrum)
        if divergence > 0.10:
            warning = (
                f"Mouth and philtrum scales diverge by {divergence * 100:.1f}% — "
                "check ruler measurements or photo distance."
            )
        primary_scale = (scale_mouth + scale_philtrum) / 2

    return {
        "method": method,
        "mmPerUnit": round(primary_scale, 4) if primary_scale else None,
        "scaleFromMouth": round(scale_mouth, 4) if scale_mouth else None,
        "scaleFromPhiltrum": round(scale_philtrum, 4) if scale_philtrum else None,
        "mouthWidthMm": mouth_mm,
        "philtrumLengthMm": philtrum_mm,
        "warning": warning,
        "dataSource": "measured" if primary_scale else "unavailable",
    }


def norm_dist_to_mm(dist_norm: float, mm_per_unit: Optional[float]) -> Optional[float]:
    if mm_per_unit is None:
        return None
    return round(dist_norm * mm_per_unit, 2)
