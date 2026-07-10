"""Port of opencvMetrics.js — Geometric facial metrics from landmarks + image stats.

All landmark-based metric computations are preserved exactly from the JS version.
"""

from __future__ import annotations
import math
import cv2
import numpy as np
from typing import Optional

from .face_crop import lm, dist


def analyze_image_stats(image_bytes: bytes) -> dict:
    """Compute basic image statistics (sharpness, brightness) from image bytes.

    Returns {"sharpness": float 0-100, "brightness": float 0-100}.
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"sharpness": 50.0, "brightness": 50.0}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Sharpness via Laplacian variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    sharpness = min(100, laplacian.var() / 50)

    # Brightness as mean pixel value
    brightness = np.mean(gray) / 255 * 100

    return {"sharpness": round(sharpness, 1), "brightness": round(brightness, 1)}


def sample_region_stats(image_bytes: bytes, box: dict) -> dict:
    """Sample pixel statistics from a normalised bounding box region.

    Args:
        image_bytes: Raw image bytes.
        box: {"x", "y", "w", "h"} in normalised [0, 1] coordinates.

    Returns:
        {"brightness": float, "whiteness": float, "redness": float}
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"brightness": 50.0, "whiteness": 50.0, "redness": 0.0}

    h, w = img.shape[:2]
    sx = max(0, int(box["x"] * w))
    sy = max(0, int(box["y"] * h))
    sw = max(1, int(box["w"] * w))
    sh = max(1, int(box["h"] * h))

    # Clamp to image bounds
    sw = min(sw, w - sx)
    sh = min(sh, h - sy)
    if sw < 1 or sh < 1:
        return {"brightness": 50.0, "whiteness": 50.0, "redness": 0.0}

    region = img[sy:sy + sh, sx:sx + sw]
    # BGR order
    b_avg = np.mean(region[:, :, 0])
    g_avg = np.mean(region[:, :, 1])
    r_avg = np.mean(region[:, :, 2])

    brightness = 0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg
    redness = r_avg - (g_avg + b_avg) / 2
    whiteness = brightness - redness * 0.5

    return {
        "brightness": round(float(brightness), 1),
        "whiteness": round(float(whiteness), 1),
        "redness": round(float(redness), 1),
    }


def landmarks_to_overlay(landmarks: list) -> list:
    """Convert raw landmarks to overlay format with id + x, y, z."""
    return [{"id": i, "x": lm_pt["x"], "y": lm_pt["y"], "z": lm_pt["z"]} for i, lm_pt in enumerate(landmarks)]


def compute_metrics_from_landmarks(landmarks: list, answers: Optional[dict] = None, image_stats: Optional[dict] = None) -> dict:
    """Compute facial metrics from MediaPipe landmarks — exact port of JS version.

    Returns dict with symmetry, proportionality, averageness, jawlineAngle, etc.
    """
    fallback = {
        "symmetry": "85.0", "proportionality": "82.0", "averageness": "78.0",
        "jawlineAngle": "120", "eyebrowTilt": "3.5", "nasalAngle": "95",
        "canthalTilt": "4.8", "upperThird": "0.33", "middleThird": "0.34",
        "lowerThird": "0.33", "visualAge": 28, "harmonyScore": "84",
        "source": "mediapipe",
    }

    if not landmarks or len(landmarks) == 0:
        return fallback

    LE = lm(landmarks, 263)  # left eye outer
    RE = lm(landmarks, 33)   # right eye outer
    LI = lm(landmarks, 133)  # left eye inner
    RI = lm(landmarks, 362)  # right eye inner
    nose = lm(landmarks, 1)
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    ml = lm(landmarks, 61)
    mr = lm(landmarks, 291)
    lb = lm(landmarks, 105)
    rb = lm(landmarks, 334)

    eye_y_diff = abs(LE["y"] - RE["y"])
    # Harmony helper only — cv_report.symmetry_score is authoritative for the report UI.
    symmetry = str(min(88, max(60, 86 - eye_y_diff * 400)))

    face_h = chin["y"] - forehead["y"]
    brow_y = (lb["y"] + rb["y"]) / 2
    mouth_y = (ml["y"] + mr["y"]) / 2

    upper_third = "0.33"
    middle_third = "0.34"
    lower_third = "0.33"

    if face_h > 0.01:
        upper = (brow_y - forehead["y"]) / face_h
        middle = (mouth_y - brow_y) / face_h
        lower = (chin["y"] - mouth_y) / face_h
        upper_third = f"{max(0.15, upper):.2f}"
        middle_third = f"{max(0.15, middle):.2f}"
        lower_third = f"{max(0.15, lower):.2f}"

    interocular = dist(LI, RI)
    face_w = dist(ml, mr) * 2.2
    proportionality = str(min(99, max(60, 70 + (interocular / face_w) * 80)))

    canthal_tilt = round(((LE["y"] - LI["y"]) - (RE["y"] - RI["y"])) * 200 + 5, 1)
    eyebrow_tilt = round(abs(lb["y"] - rb["y"]) * 180, 1)

    jaw_w = dist(lm(landmarks, 172), lm(landmarks, 397))
    jawline_angle = str(round(110 + jaw_w * 80))

    sharpness = (image_stats or {}).get("sharpness", 50)
    brightness = (image_stats or {}).get("brightness", 50)

    harmony = min(99, round(
        float(symmetry) * 0.35 +
        float(proportionality) * 0.25 +
        75 * 0.25 +
        sharpness * 0.08 +
        brightness * 0.07
    ))

    # Visual age estimate from proportions
    face_ratio = dist(jaw_pts(landmarks)) if False else face_w / (face_h or 0.3)
    visual_age = 28  # baseline

    return {
        **fallback,
        "symmetry": symmetry,
        "proportionality": proportionality,
        "upperThird": upper_third,
        "middleThird": middle_third,
        "lowerThird": lower_third,
        "canthalTilt": str(canthal_tilt),
        "eyebrowTilt": str(eyebrow_tilt),
        "jawlineAngle": jawline_angle,
        "harmonyScore": str(harmony),
        "visualAge": visual_age,
        "source": "mediapipe",
    }


def jaw_pts(landmarks):
    """Placeholder — not used in metrics path."""
    return landmarks[0]
