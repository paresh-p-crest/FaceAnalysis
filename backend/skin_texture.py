"""Pixel-based skin texture analysis — Laplacian roughness, redness, oiliness."""

from __future__ import annotations

import cv2
import numpy as np

from .eye_analysis import sample_region_stats


def _laplacian_variance(image_bytes: bytes, box: dict) -> float:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return 0.0
    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, min(w - sx, round(box["w"] * w)))
    sh = max(1, min(h - sy, round(box["h"] * h)))
    region = img[sy : sy + sh, sx : sx + sw]
    if region.size == 0:
        return 0.0
    lap = cv2.Laplacian(region, cv2.CV_64F)
    return float(np.var(lap))


def _redness_index(image_bytes: bytes, box: dict) -> float:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return 0.0
    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, min(w - sx, round(box["w"] * w)))
    sh = max(1, min(h - sy, round(box["h"] * h)))
    region = img[sy : sy + sh, sx : sx + sw]
    if region.size == 0:
        return 0.0
    r = region[:, :, 2].astype(float)
    g = region[:, :, 1].astype(float)
    return float(np.mean(r - g))


def _oiliness_index(image_bytes: bytes, box: dict) -> float:
    """Specular highlight ratio as oiliness proxy."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return 0.0
    h, w = img.shape[:2]
    sx = max(0, round(box["x"] * w))
    sy = max(0, round(box["y"] * h))
    sw = max(1, min(w - sx, round(box["w"] * w)))
    sh = max(1, min(h - sy, round(box["h"] * h)))
    region = img[sy : sy + sh, sx : sx + sw]
    if region.size == 0:
        return 0.0
    bright = (region > 210).mean()
    return round(float(bright) * 100, 1)


def analyze_skin_texture(image_bytes: bytes, region_boxes: dict[str, dict]) -> dict:
    """Analyze texture metrics for named facial regions."""
    roughness_vals: list[float] = []
    redness_vals: list[float] = []
    oil_vals: list[float] = []
    per_region: dict[str, dict] = {}

    for name, box in region_boxes.items():
        rough = _laplacian_variance(image_bytes, box)
        red = _redness_index(image_bytes, box)
        oil = _oiliness_index(image_bytes, box)
        roughness_vals.append(rough)
        redness_vals.append(red)
        if name in ("Nose bridge", "Forehead"):
            oil_vals.append(oil)
        per_region[name] = {
            "roughness": round(rough, 1),
            "rednessIndex": round(red, 1),
            "oilinessIndex": oil,
        }

    avg_rough = sum(roughness_vals) / len(roughness_vals) if roughness_vals else 0
    avg_red = sum(redness_vals) / len(redness_vals) if redness_vals else 0
    avg_oil = sum(oil_vals) / len(oil_vals) if oil_vals else 0

    texture = "Smooth"
    if avg_rough > 180:
        texture = "Textured"
    elif avg_rough > 90:
        texture = "Moderate texture"
    elif avg_rough < 40:
        texture = "Very smooth"

    redness = "Normal"
    if avg_red > 12:
        redness = "Mild redness"
    if avg_red > 20:
        redness = "Moderate redness"

    oiliness = "Balanced"
    if avg_oil > 8:
        oiliness = "Oily T-zone"
    elif avg_oil < 2:
        oiliness = "Dry"

    return {
        "texture": texture,
        "redness": redness,
        "oiliness": oiliness,
        "roughnessIndex": round(avg_rough, 1),
        "rednessIndex": round(avg_red, 1),
        "oilinessIndex": round(avg_oil, 1),
        "regions": per_region,
        "dataSource": "measured",
    }
