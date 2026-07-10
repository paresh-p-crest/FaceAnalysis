"""OpenCV hair-mask segmentation for top-of-head (and optional front) photos.

Always runs in the analysis pipeline — no env kill-switch. Produces crown coverage
and hairline recession inputs that override dark-pixel heuristics when available.
"""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np


def _hair_mask_bgr(img: np.ndarray) -> np.ndarray:
    """Binary hair mask via HSV darkness + low-saturation heuristics."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    # Dark / low-value pixels with modest saturation (typical hair vs bright scalp/skin)
    dark = (v < 110) & (s < 160)
    # Also catch very dark brown/black hair (low V regardless of S)
    very_dark = v < 55
    mask = (dark | very_dark).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask


def _crown_roi(mask: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    h, w = mask.shape[:2]
    y0, y1 = int(h * 0.12), int(h * 0.72)
    x0, x1 = int(w * 0.18), int(w * 0.82)
    return mask[y0:y1, x0:x1], (x0, y0, x1, y1)


def _hairline_recession(mask: np.ndarray) -> tuple[str, float]:
    """Estimate hairline recession from first dense hair row near the midline."""
    h, w = mask.shape[:2]
    mid_x0, mid_x1 = int(w * 0.4), int(w * 0.6)
    hairline_row = int(h * 0.5)
    for row in range(int(h * 0.02), int(h * 0.55)):
        band = mask[row, mid_x0:mid_x1]
        if band.size and (band > 0).mean() > 0.35:
            hairline_row = row
            break
    recession = hairline_row / max(h, 1)
    if recession < 0.14:
        label = "Full"
    elif recession < 0.24:
        label = "Slight recession"
    else:
        label = "Receding"
    return label, round(recession, 4)


def analyze_hair_segmentation(
    top_head_bytes: bytes,
    front_bytes: Optional[bytes] = None,
) -> Optional[dict]:
    """Return hair-mask metrics from the top-of-head photo.

    ``front_bytes`` is reserved for future frontal hairline fusion.
    """
    _ = front_bytes
    if not top_head_bytes:
        return None

    nparr = np.frombuffer(top_head_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    mask = _hair_mask_bgr(img)
    crown, _ = _crown_roi(mask)
    if crown.size == 0:
        return None

    coverage = float((crown > 0).mean())
    density_pct = round(coverage * 100, 1)
    hairline, recession = _hairline_recession(mask)

    # Left/right crown asymmetry for thinning signal
    ch, cw = crown.shape[:2]
    left = crown[:, : cw // 2]
    right = crown[:, cw // 2 :]
    left_cov = float((left > 0).mean()) if left.size else 0.0
    right_cov = float((right > 0).mean()) if right.size else 0.0
    thinning = (
        "Crown thinning"
        if coverage < 0.28 and abs(left_cov - right_cov) < 0.12
        else "None detected"
    )

    density_estimate = (
        "Thick" if density_pct > 45 else "Moderate" if density_pct > 25 else "Thin" if density_pct > 15 else "Sparse"
    )
    coverage_estimate = (
        "Full coverage"
        if density_pct > 45
        else "Good coverage"
        if density_pct > 25
        else "Moderate coverage"
        if density_pct > 15
        else "Sparse coverage"
    )

    return {
        "densityPct": density_pct,
        "densityEstimate": density_estimate,
        "coverageEstimate": coverage_estimate,
        "hairline": hairline,
        "hairlineRecession": recession,
        "thinningArea": thinning,
        "crownVisibility": "Visible thinning" if thinning != "None detected" else "Normal coverage",
        "crownCoverage": round(coverage, 4),
        "segmentationMethod": "opencv_hsv",
        "dataSource": "measured",
    }
