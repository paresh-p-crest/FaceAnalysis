"""Port of eyeAnalysis.js — Eye metrics, pixel analysis, and crop helpers.

All eye metric computations, canthal tilt, eyelid exposure, sclera color
classification, and under-eye analysis are preserved from the JS version.
"""

from __future__ import annotations
import math
from typing import Optional

import cv2
import numpy as np

from .face_crop import (
    lm, dist, bbox_from_indices, merge_bboxes, bbox_eyes_region,
    bbox_brows_region, RIGHT_EYE, LEFT_EYE,
)


# Landmark groups for under-eye regions
LEFT_LOWER_LID = [33, 133, 157, 158, 159, 160, 173]
RIGHT_LOWER_LID = [362, 263, 385, 386, 387, 388, 390]
LEFT_UNDER = [111, 117, 118, 119, 120, 121]
RIGHT_UNDER = [340, 346, 347, 348, 349, 350]
# Upper lash-line sampling (upper eyelid contour)
LEFT_LASH_LINE = [33, 246, 161, 160, 159, 158, 157, 173, 133]
RIGHT_LASH_LINE = [263, 466, 388, 387, 386, 385, 384, 398, 362]


# ── Helpers ──

def _canthal_tilt_deg(outer: dict, inner: dict) -> float:
    """Canthal tilt angle in degrees."""
    return math.atan2(outer["y"] - inner["y"], outer["x"] - inner["x"]) * (180 / math.pi)


def _classify_tilt(avg_tilt: float) -> str:
    if avg_tilt > 2.5:
        return "Positive (upturned)"
    if avg_tilt < -0.5:
        return "Negative (downturned)"
    return "Neutral"


def _classify_exposure(ratio: float) -> str:
    if ratio > 0.34:
        return "High"
    if ratio > 0.24:
        return "Moderate"
    return "Low"


def _classify_sclera(whiteness: float) -> str:
    if whiteness > 175:
        return "Natural White"
    if whiteness > 145:
        return "Slightly dull"
    return "Yellow-tinged"


def _classify_under_eye(brightness: float) -> str:
    if brightness > 140:
        return "Good"
    if brightness > 110:
        return "Moderate"
    return "Shadowed"


def _lower_lid_bending(landmarks: list, indices: list) -> float:
    """Compute lower eyelid curvature bending ratio."""
    pts = [lm(landmarks, i) for i in indices]
    inner_pt, outer_pt = pts[0], pts[-1]
    line_len = dist(inner_pt, outer_pt) or 0.001
    max_dev = 0.0
    for p in pts[1:-1]:
        cross = abs(
            (outer_pt["x"] - inner_pt["x"]) * (inner_pt["y"] - p["y"])
            - (inner_pt["x"] - p["x"]) * (outer_pt["y"] - inner_pt["y"])
        )
        max_dev = max(max_dev, cross / line_len)
    return min(0.95, 0.68 + max_dev * 8)


def _curvature_label(k: float) -> str:
    if k >= 0.84:
        return "Within the common curvature range"
    if k >= 0.76:
        return "Slightly flatter than the common curvature range"
    return "Noticeably flatter than typical"


def _build_explanation(metrics: dict) -> str:
    return (
        f"Your eyes show {metrics['eyeTilt'].lower()} canthal tilt with "
        f"{metrics['eyelidExposure'].lower()} eyelid exposure. "
        f"Sclera reads as {metrics['scleraColor'].lower()} with "
        f"{metrics['underEyeHealth'].lower()} under-eye appearance. "
        f"Lower eyelid curvature ({metrics['lowerLidCurvature']}) is "
        f"{metrics['curvatureDescription'].lower()} — typical bending range is 0.76–0.92."
    )


# ── Crop helpers (PIL-based, ported from JS canvas) ──

def crop_normalized(image_bytes: bytes, box: dict) -> bytes:
    """Crop a normalised bounding box region and return JPEG bytes."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return image_bytes

    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, min(w - sx, round(box["w"] * w)))
    sh = max(1, min(h - sy, round(box["h"] * h)))

    crop = img[sy:sy + sh, sx:sx + sw]
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return buf.tobytes()


def sample_region_stats(image_bytes: bytes, box: dict) -> dict:
    """Sample pixel statistics from a normalised bounding box region."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"brightness": 0, "whiteness": 0, "redness": 0}

    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, round(box["w"] * w))
    sh = max(1, round(box["h"] * h))
    sw = min(sw, w - sx)
    sh = min(sh, h - sy)
    if sw < 1 or sh < 1:
        return {"brightness": 0, "whiteness": 0, "redness": 0}

    region = img[sy:sy + sh, sx:sx + sw]
    b_avg = float(np.mean(region[:, :, 0]))
    g_avg = float(np.mean(region[:, :, 1]))
    r_avg = float(np.mean(region[:, :, 2]))

    bright_sum = 0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg
    redness = r_avg - (g_avg + b_avg) / 2
    whiteness = bright_sum - redness * 0.5

    return {"brightness": round(bright_sum, 1), "whiteness": round(whiteness, 1), "redness": round(redness, 1)}


# ── Core eye metrics ──

def compute_eye_metrics_from_landmarks(landmarks: list) -> dict:
    """Compute eye metrics from MediaPipe landmarks — pure math, no image."""
    re_o = lm(landmarks, 33)
    re_i = lm(landmarks, 133)
    le_o = lm(landmarks, 263)
    le_i = lm(landmarks, 362)
    le_top = lm(landmarks, 159)
    le_bot = lm(landmarks, 145)
    re_top = lm(landmarks, 386)
    re_bot = lm(landmarks, 374)

    left = {
        "tilt": _canthal_tilt_deg(le_o, le_i),
        "exposureRatio": dist(le_top, le_bot) / (dist(le_i, le_o) or 0.01),
        "lowerLidK": _lower_lid_bending(landmarks, LEFT_LOWER_LID),
    }
    right = {
        "tilt": _canthal_tilt_deg(re_o, re_i),
        "exposureRatio": dist(re_top, re_bot) / (dist(re_i, re_o) or 0.01),
        "lowerLidK": _lower_lid_bending(landmarks, RIGHT_LOWER_LID),
    }
    avg = {
        "tilt": (left["tilt"] + right["tilt"]) / 2,
        "exposureRatio": (left["exposureRatio"] + right["exposureRatio"]) / 2,
        "lowerLidK": (left["lowerLidK"] + right["lowerLidK"]) / 2,
    }

    return {
        "leftTilt": f"{left['tilt']:.1f}",
        "rightTilt": f"{right['tilt']:.1f}",
        "eyeTilt": _classify_tilt(avg["tilt"]),
        "eyelidExposure": _classify_exposure(avg["exposureRatio"]),
        "exposureRatio": f"{avg['exposureRatio']:.2f}",
        "lowerLidCurvature": f"{avg['lowerLidK']:.2f}",
        "curvatureDescription": _curvature_label(avg["lowerLidK"]),
        "curvatureMin": 0.76,
        "curvatureMax": 0.92,
        "scleraColor": "Natural White",
        "underEyeHealth": "Moderate",
    }


def eyelash_metrics(landmarks: list, image_bytes: bytes) -> dict:
    """Estimate lash-line density and darkness from upper-lid crop contrast."""
    left_box = bbox_from_indices(landmarks, LEFT_LASH_LINE, 0.02)
    right_box = bbox_from_indices(landmarks, RIGHT_LASH_LINE, 0.02)
    left_box["h"] *= 0.55
    right_box["h"] *= 0.55

    left_stats = sample_region_stats(image_bytes, left_box)
    right_stats = sample_region_stats(image_bytes, right_box)
    avg_bright = (left_stats["brightness"] + right_stats["brightness"]) / 2
    avg_redness = (left_stats["redness"] + right_stats["redness"]) / 2

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    edge_scores: list[float] = []
    if img is not None:
        h, w = img.shape[:2]
        for box in (left_box, right_box):
            sx = max(0, round(box["x"] * w))
            sy = max(0, round(box["y"] * h))
            sw = max(1, min(w - sx, round(box["w"] * w)))
            sh = max(1, min(h - sy, round(box["h"] * h)))
            region = img[sy : sy + sh, sx : sx + sw]
            if region.size > 0:
                lap = cv2.Laplacian(region, cv2.CV_64F)
                edge_scores.append(float(np.var(lap)))

    edge_var = sum(edge_scores) / len(edge_scores) if edge_scores else 0.0
    darkness = max(0, min(100, 100 - avg_bright * 0.45 + edge_var * 0.02))
    density = "Dense" if edge_var > 120 else ("Moderate" if edge_var > 60 else "Light")
    darkness_label = "Dark" if darkness > 55 else ("Medium" if darkness > 35 else "Light")

    return {
        "density": density,
        "darkness": darkness_label,
        "contrastIndex": round(edge_var, 1),
        "brightness": round(avg_bright, 1),
        "dataSource": "estimated",
        "explanation": (
            f"Lash-line contrast index {edge_var:.0f} suggests {density.lower()} apparent density "
            f"with {darkness_label.lower()} lash pigmentation on the frontal photo."
        ),
    }


def under_eye_metrics(landmarks: list, image_bytes: bytes) -> dict:
    """Under-eye hollowing and pigmentation from periorbital crops."""
    left_under = bbox_from_indices(landmarks, LEFT_UNDER, 0.015)
    right_under = bbox_from_indices(landmarks, RIGHT_UNDER, 0.015)
    left_under["h"] *= 1.3
    right_under["h"] *= 1.3
    left_stats = sample_region_stats(image_bytes, left_under)
    right_stats = sample_region_stats(image_bytes, right_under)
    avg_bright = (left_stats["brightness"] + right_stats["brightness"]) / 2
    avg_redness = (left_stats["redness"] + right_stats["redness"]) / 2
    hollowing = "Mild hollow" if avg_bright < 115 else ("Moderate hollow" if avg_bright < 95 else "Minimal hollow")
    pigmentation = "Noticeable" if avg_redness > 8 else ("Mild" if avg_redness > 4 else "Minimal")
    return {
        "hollowing": hollowing,
        "pigmentation": pigmentation,
        "brightness": round(avg_bright, 1),
        "rednessIndex": round(avg_redness, 1),
        "health": _classify_under_eye(avg_bright),
        "dataSource": "measured",
        "explanation": (
            f"Under-eye brightness {avg_bright:.0f} with {pigmentation.lower()} pigmentation signal; "
            f"hollowing reads as {hollowing.lower()} on the frontal photo."
        ),
    }


def assemble_eyes_region(
    landmarks: list,
    image_bytes: bytes,
    brow_metrics: dict,
    eye_analysis: Optional[dict] = None,
) -> dict:
    """Structured eyes region with four subsection metric slices."""
    metrics = (eye_analysis or {}).get("metrics") or compute_eye_metrics_from_landmarks(landmarks)
    lashes = eyelash_metrics(landmarks, image_bytes)
    under_eye = under_eye_metrics(landmarks, image_bytes)

    brow_score = brow_metrics.get("symmetryScore", 75) if isinstance(brow_metrics, dict) else 75
    ocular_score = 78
    if "Positive" in metrics.get("eyeTilt", ""):
        ocular_score += 4
    if metrics.get("underEyeHealth") == "Good":
        ocular_score += 4
    ocular_score = min(99, max(55, ocular_score))

    overall = round((brow_score + ocular_score + (85 if lashes["density"] == "Dense" else 75)) / 3)

    return {
        "score": overall,
        "scoreLabel": "Balanced" if overall >= 75 else "Soft",
        "eyebrows": {
            "score": brow_score,
            "shape": brow_metrics.get("shape"),
            "position": brow_metrics.get("position"),
            "thickness": brow_metrics.get("thickness"),
            "peakHeight": brow_metrics.get("peakHeight"),
            "symmetryScore": brow_metrics.get("symmetryScore"),
            "explanation": brow_metrics.get("explanation"),
            "dataSource": "measured",
        },
        "eyelashes": lashes,
        "ocular": {
            "score": ocular_score,
            "eyeTilt": metrics.get("eyeTilt"),
            "eyelidExposure": metrics.get("eyelidExposure"),
            "scleraColor": metrics.get("scleraColor"),
            "lowerLidCurvature": metrics.get("lowerLidCurvature"),
            "curvatureDescription": metrics.get("curvatureDescription"),
            "explanation": metrics.get("explanation"),
            "dataSource": "measured",
        },
        "underEye": under_eye,
    }


def analyze_eyes(landmarks: list, image_bytes: bytes) -> dict:
    """Full eye analysis — landmarks + pixel data from image.

    Returns:
        {"eyesCrop": bytes, "eyesBox": dict, "metrics": dict}
    """
    eyes_box = bbox_eyes_region(landmarks)
    left_box = bbox_from_indices(landmarks, LEFT_EYE, 0.03)
    right_box = bbox_from_indices(landmarks, RIGHT_EYE, 0.03)

    left_under = bbox_from_indices(landmarks, LEFT_UNDER, 0.015)
    right_under = bbox_from_indices(landmarks, RIGHT_UNDER, 0.015)
    left_under["h"] *= 1.3
    right_under["h"] *= 1.3

    eyes_crop = crop_normalized(image_bytes, eyes_box)
    left_sclera = sample_region_stats(image_bytes, left_box)
    right_sclera = sample_region_stats(image_bytes, right_box)
    left_under_stats = sample_region_stats(image_bytes, left_under)
    right_under_stats = sample_region_stats(image_bytes, right_under)

    metrics = compute_eye_metrics_from_landmarks(landmarks)
    metrics["scleraColor"] = _classify_sclera(
        (left_sclera["whiteness"] + right_sclera["whiteness"]) / 2
    )
    metrics["underEyeHealth"] = _classify_under_eye(
        (left_under_stats["brightness"] + right_under_stats["brightness"]) / 2
    )
    metrics["explanation"] = _build_explanation(metrics)

    return {"eyesCrop": eyes_crop, "eyesBox": eyes_box, "metrics": metrics}


def analyze_brows_crop(landmarks: list, image_bytes: bytes) -> dict:
    """Crop and return brow region."""
    box = bbox_brows_region(landmarks)
    crop = crop_normalized(image_bytes, box)
    return {"crop": crop, "box": box}
