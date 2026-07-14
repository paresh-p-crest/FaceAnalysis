"""Measurement-guided full-face projected AFTER generation (OpenCV).

Ports the intent of utils/aestheticProjection.js projectFullFaceAfter — not AI visuals.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

import cv2
import numpy as np

from .face_crop import (
    CHEEK_LEFT,
    CHEEK_RIGHT,
    FACE_OVAL,
    LEFT_BROW,
    LEFT_EYE,
    MOUTH,
    RIGHT_BROW,
    RIGHT_EYE,
    lm,
)

logger = logging.getLogger(__name__)


def projected_after_enabled() -> bool:
    return os.environ.get("PROJECTED_AFTER_ENABLED", "false").lower() in ("1", "true", "yes", "on")


def _clamp_strength(v: float) -> float:
    return min(0.22, max(0.12, v))


def _from_score(score: Optional[float]) -> float:
    if score is None:
        return _clamp_strength((88 - 72) / 100)
    try:
        return _clamp_strength((88 - float(score)) / 100)
    except (TypeError, ValueError):
        return _clamp_strength(0.16)


def _section_score(cv_report: dict, *keys: str) -> Optional[float]:
    for key in keys:
        section = cv_report.get(key) if isinstance(cv_report, dict) else None
        if isinstance(section, dict) and section.get("score") is not None:
            try:
                return float(section["score"])
            except (TypeError, ValueError):
                continue
    return None


def projection_strengths(cv_report: Optional[dict], metrics: Optional[dict]) -> dict[str, float]:
    """Mirror utils/anthropometrics.js projectionStrengths (simplified)."""
    cv = cv_report or {}
    dev = {}
    if isinstance(metrics, dict):
        anthro = metrics.get("anthropometrics") or {}
        if isinstance(anthro, dict):
            dev = anthro.get("deviations") or {}

    def dev_val(key: str, default: float = 10.0) -> float:
        try:
            return float(dev.get(key, default))
        except (TypeError, ValueError):
            return default

    dev_avg = 10.0
    if dev:
        nums = [float(v) for v in dev.values() if isinstance(v, (int, float))]
        if nums:
            dev_avg = sum(nums) / len(nums)

    return {
        "hair": _from_score(_section_score(cv, "hair")),
        "eyebrows": _clamp_strength(dev_val("symmetry") / 100 + _from_score(80)),
        "eyes": _clamp_strength(dev_val("canthal", 8) / 120 + _from_score(_section_score(cv, "eyes"))),
        "skin": _from_score(_section_score(cv, "skin")),
        "nose": _clamp_strength(dev_val("nose", 8) / 110),
        "jaw": _clamp_strength(dev_val("jaw", 8) / 100 + _from_score(_section_score(cv, "jaw", "jawChin"))),
        "lips": _from_score(_section_score(cv, "lips", "mouth")),
        "cheeks": _from_score(_section_score(cv, "cheeks")),
        "chin": _from_score(_section_score(cv, "chin", "jawChin")),
        "neck": _from_score(_section_score(cv, "neck")),
        "ears": _from_score(_section_score(cv, "ears")),
        "full": _clamp_strength(dev_avg / 80),
    }


def _landmarks_to_array(landmarks: list) -> list[dict]:
    if not landmarks:
        return []
    if landmarks and landmarks[0].get("id") is not None:
        arr: list[dict] = [{"x": 0.5, "y": 0.5, "z": 0}] * 478
        for pt in landmarks:
            idx = pt.get("id")
            if idx is not None and 0 <= int(idx) < 478:
                arr[int(idx)] = {
                    "x": float(pt.get("x", 0.5)),
                    "y": float(pt.get("y", 0.5)),
                    "z": float(pt.get("z", 0)),
                }
        return arr
    return landmarks


def _polygon_mask(h: int, w: int, landmarks: list, indices: list[int]) -> np.ndarray:
    pts = []
    for idx in indices:
        p = lm(landmarks, idx)
        pts.append([int(p["x"] * w), int(p["y"] * h)])
    mask = np.zeros((h, w), dtype=np.uint8)
    if len(pts) >= 3:
        cv2.fillPoly(mask, [np.array(pts, dtype=np.int32)], 255)
    return mask


def _rect_mask(h: int, w: int, x0: float, y0: float, x1: float, y1: float) -> np.ndarray:
    mask = np.zeros((h, w), dtype=np.uint8)
    xa = max(0, int(x0 * w))
    ya = max(0, int(y0 * h))
    xb = min(w, int(x1 * w))
    yb = min(h, int(y1 * h))
    if xb > xa and yb > ya:
        mask[ya:yb, xa:xb] = 255
    return mask


def _subtract_masks(*masks: np.ndarray) -> np.ndarray:
    out = masks[0].copy()
    for m in masks[1:]:
        out = cv2.bitwise_and(out, cv2.bitwise_not(m))
    return out


def _apply_masked_bilateral(img: np.ndarray, mask: np.ndarray, strength: float) -> None:
    if strength <= 0 or not np.any(mask):
        return
    d = int(5 + strength * 4)
    sigma = 20 + strength * 35
    blurred = cv2.bilateralFilter(img, d, sigma, sigma)
    m = (mask.astype(np.float32) / 255.0) * strength
    m3 = cv2.merge([m, m, m])
    np.copyto(img, (img.astype(np.float32) * (1 - m3) + blurred.astype(np.float32) * m3).astype(np.uint8))


def _apply_masked_lift(img: np.ndarray, mask: np.ndarray, strength: float, amount: float = 18.0) -> None:
    if strength <= 0 or not np.any(mask):
        return
    lift = amount * strength
    m = (mask.astype(np.float32) / 255.0)
    m3 = cv2.merge([m, m, m])
    boosted = img.astype(np.float32)
    boosted += lift
    np.copyto(img, np.clip(boosted, 0, 255).astype(np.uint8), where=(m3 > 0.01))


def _apply_skin_pass(img: np.ndarray, landmarks: list, strength: float) -> None:
    h, w = img.shape[:2]
    face = _polygon_mask(h, w, landmarks, FACE_OVAL)
    eyes = cv2.bitwise_or(
        _polygon_mask(h, w, landmarks, RIGHT_EYE),
        _polygon_mask(h, w, landmarks, LEFT_EYE),
    )
    mouth = _polygon_mask(h, w, landmarks, MOUTH)
    brows = cv2.bitwise_or(
        _polygon_mask(h, w, landmarks, RIGHT_BROW),
        _polygon_mask(h, w, landmarks, LEFT_BROW),
    )
    skin = _subtract_masks(face, eyes, mouth, brows)
    _apply_masked_bilateral(img, skin, min(1.0, strength * 1.4))
    _apply_masked_lift(img, skin, strength * 0.35, 6.0)


def _apply_eyes_pass(img: np.ndarray, landmarks: list, strength: float) -> None:
    h, w = img.shape[:2]
    eyes = cv2.bitwise_or(
        _polygon_mask(h, w, landmarks, RIGHT_EYE),
        _polygon_mask(h, w, landmarks, LEFT_EYE),
    )
    _apply_masked_lift(img, eyes, strength, 14.0)
    lb = lm(landmarks, 105)
    rb = lm(landmarks, 334)
    under = _rect_mask(
        h,
        w,
        min(lb["x"], rb["x"]) - 0.02,
        max(lb["y"], rb["y"]) + 0.01,
        max(lb["x"], rb["x"]) + 0.02,
        min(1.0, max(lb["y"], rb["y"]) + 0.08),
    )
    _apply_masked_bilateral(img, under, strength * 0.9)


def _apply_cheeks_pass(img: np.ndarray, landmarks: list, strength: float) -> None:
    h, w = img.shape[:2]
    cheek_l = _polygon_mask(h, w, landmarks, CHEEK_LEFT)
    cheek_r = _polygon_mask(h, w, landmarks, CHEEK_RIGHT)
    cheeks = cv2.bitwise_or(cheek_l, cheek_r)
    _apply_masked_lift(img, cheeks, strength * 0.5, 10.0)


def _apply_hair_pass(img: np.ndarray, landmarks: list, strength: float) -> None:
    h, w = img.shape[:2]
    brow_y = int(((lm(landmarks, 105)["y"] + lm(landmarks, 334)["y"]) / 2) * h)
    hair = np.zeros((h, w), dtype=np.uint8)
    if brow_y > 0:
        hair[:brow_y, :] = 255
    face = _polygon_mask(h, w, landmarks, FACE_OVAL)
    hair = cv2.bitwise_and(hair, cv2.bitwise_not(face))
    _apply_masked_lift(img, hair, strength * 0.4, 8.0)


def _apply_jaw_pass(img: np.ndarray, landmarks: list, strength: float) -> None:
    h, w = img.shape[:2]
    chin = lm(landmarks, 152)
    jaw = _rect_mask(
        h,
        w,
        chin["x"] - 0.18,
        chin["y"] - 0.06,
        chin["x"] + 0.18,
        min(1.0, chin["y"] + 0.22),
    )
    _apply_masked_bilateral(img, jaw, strength * 0.5)


def project_full_face_after(
    front_bytes: bytes,
    landmarks: list,
    cv_report: Optional[dict],
    metrics: Optional[dict],
) -> bytes:
    """Generate one full-face projected AFTER JPEG."""
    arr = np.frombuffer(front_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode front portrait for projected AFTER")

    lm_arr = _landmarks_to_array(landmarks)
    if len(lm_arr) < 10:
        raise ValueError("Landmarks required for projected AFTER")

    strengths = projection_strengths(cv_report, metrics)
    s_full = strengths["full"]

    _apply_skin_pass(img, lm_arr, max(strengths["skin"], s_full))
    _apply_hair_pass(img, lm_arr, strengths["hair"])
    _apply_eyes_pass(img, lm_arr, strengths["eyes"])
    _apply_cheeks_pass(img, lm_arr, strengths["cheeks"])
    _apply_jaw_pass(img, lm_arr, max(strengths["jaw"], strengths["chin"]))

    # Global subtle polish
    alpha = 1.0 + 0.04 * s_full
    beta = 3 * s_full
    img = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)

    ok, encoded = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise ValueError("Failed to encode projected AFTER JPEG")
    return encoded.tobytes()
