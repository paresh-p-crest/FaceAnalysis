"""Tests for sclera color sampling — iris/caruncle geometric exclusion.

Replaces the deleted debug_sclera.py harness: asserts that the exclusions do
not zero out sclera sampling and that the light-iris exclusion actually
removes iris influence.
"""

from __future__ import annotations

import math

import cv2
import numpy as np

from backend.eye_analysis import (
    LEFT_EYE,
    LEFT_INNER_CANTHUS,
    LEFT_IRIS,
    _classify_sclera,
    combine_sclera_stats,
    sample_sclera_stats,
)

W, H = 400, 200
CX, CY = 200, 100
RX, RY = 36, 26
BOX = {"x": 0.4, "y": 0.3, "w": 0.2, "h": 0.4}


def _build_eye(iris_bgr=(170, 170, 170), with_caruncle=True) -> tuple[bytes, list[dict]]:
    """Synthetic left eye: warm-white sclera inside an elliptical eye contour,
    a light-gray iris (passes the sclera color filter, so only the geometric
    exclusion keeps it out) and an optional pink caruncle at the inner canthus.
    """
    img = np.full((H, W, 3), 60, dtype=np.uint8)  # dark background
    yy, xx = np.ogrid[:H, :W]
    ellipse = ((xx - CX) / RX) ** 2 + ((yy - CY) / RY) ** 2 <= 1
    img[ellipse] = (240, 235, 235)  # warm white sclera (slightly red → hueWeight > 0)

    iris = (xx - CX) ** 2 + (yy - CY) ** 2 <= 10 ** 2
    img[iris] = iris_bgr

    if with_caruncle:
        caruncle = (xx - (CX - RX)) ** 2 + (yy - CY) ** 2 <= 5 ** 2
        img[caruncle] = (200, 120, 130)

    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    image_bytes = buf.tobytes()

    def lm_norm(px, py):
        return {"x": px / W, "y": py / H, "z": 0.0}

    landmarks = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    pts = [
        (CX + RX * math.cos(a), CY + RY * math.sin(a))
        for a in np.linspace(0, 2 * np.pi, len(LEFT_EYE), endpoint=False)
    ]
    # LEFT_EYE starts at the inner canthus (person's-left inner corner = left
    # of the ellipse), then wraps around the contour.
    start = len(LEFT_EYE) * 2 // 4  # angle π → leftmost point
    for idx, (px, py) in zip(LEFT_EYE, pts[start:] + pts[:start]):
        landmarks[idx] = lm_norm(px, py)

    for idx, a in zip(LEFT_IRIS, np.linspace(0, 2 * np.pi, len(LEFT_IRIS), endpoint=False)):
        landmarks[idx] = lm_norm(CX + 10 * math.cos(a), CY + 10 * math.sin(a))

    landmarks[LEFT_INNER_CANTHUS] = lm_norm(CX - RX, CY)
    return image_bytes, landmarks


def test_sclera_sampling_not_zeroed_by_exclusions():
    image_bytes, landmarks = _build_eye()
    stats = sample_sclera_stats(
        image_bytes, BOX,
        landmarks=landmarks,
        iris_indices=LEFT_IRIS,
        eye_indices=LEFT_EYE,
        inner_canthus_idx=LEFT_INNER_CANTHUS,
    )
    # Warm-white sclera should dominate the masked sample.
    assert stats["whiteness"] > 200
    assert stats["brightness"] > 200
    # Warm tint gives the masked pixels a tiny saturation → hue accumulates.
    assert stats["hueWeight"] > 0

    # With skin-relative redness near neutral this reads as Natural White.
    assert _classify_sclera(stats, skin_redness=5) == "Natural White"


def test_light_iris_excluded_geometrically():
    # Dark iris (v≈40) is removed by the color filter alone; light-gray iris
    # (v≈67, s≈0) passes the color filter and only the geometric exclusion
    # removes it. If the iris circle exclusion regresses, the light-iris
    # sample drags whiteness down.
    dark_bytes, dark_lm = _build_eye(iris_bgr=(40, 40, 40))
    light_bytes, light_lm = _build_eye(iris_bgr=(170, 170, 170))

    kwargs = dict(iris_indices=LEFT_IRIS, eye_indices=LEFT_EYE, inner_canthus_idx=LEFT_INNER_CANTHUS)
    dark = sample_sclera_stats(dark_bytes, BOX, landmarks=dark_lm, **kwargs)
    light = sample_sclera_stats(light_bytes, BOX, landmarks=light_lm, **kwargs)
    assert abs(dark["whiteness"] - light["whiteness"]) < 5


def test_fallback_path_without_landmarks():
    image_bytes, _ = _build_eye()
    stats = sample_sclera_stats(image_bytes, BOX)
    # No landmarks → fallback iris circle + plain box sampling; must still
    # return usable, non-zero stats (bright-quartile fallback path).
    assert stats["whiteness"] > 0
    assert stats["brightness"] > 0
    assert "hueWeight" in stats


def test_combine_sclera_stats_averages_and_hue():
    left = {"brightness": 200, "whiteness": 210, "redness": 2, "saturation": 5,
            "hueX": 10.0, "hueY": 0.0, "hueWeight": 1.0}
    right = {"brightness": 180, "whiteness": 190, "redness": 4, "saturation": 7,
             "hueX": -9.0, "hueY": 0.0, "hueWeight": 1.0}
    merged = combine_sclera_stats(left, right)
    assert merged["brightness"] == 190
    assert merged["whiteness"] == 200
    assert merged["redness"] == 3
    # Vector-summed hue 0° and 180° resolve to ~0° (not a raw 90° average).
    assert merged["hue"] is not None
    assert 0 <= merged["hue"] < 5 or merged["hue"] > 174
