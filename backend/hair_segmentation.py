"""OpenCV hair-mask segmentation for top-of-head (and optional front) photos.

Always runs in the analysis pipeline — no env kill-switch. Produces crown coverage,
temple-geometry (Norwood 1–3), and hairline recession inputs that override dark-pixel
heuristics when available.

Norwood stages 1–3 are hairline/temple-shape driven (clinical Hamilton–Norwood), not
scalp density-%. Density remains a secondary signal for stage 4+.
"""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np


def _hair_mask_bgr(img: np.ndarray) -> np.ndarray:
    """Binary hair mask via HSV darkness + low-saturation heuristics.

    Includes a highlight arm for glossy/lit hair that would otherwise be
    missed by ``v < 110`` alone (under-counting → false stage escalation).
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    _h, s, v = cv2.split(hsv)
    # Dark / low-value pixels with modest saturation (typical hair vs bright scalp/skin)
    dark = (v < 110) & (s < 160)
    # Also catch very dark brown/black hair (low V regardless of S)
    very_dark = v < 55
    # Bright/glossy hair highlights: low saturation, high value (near-desaturated
    # specular). Pale skin under flat light can false-positive — prefer dark|very_dark
    # seed; highlight is an additive arm for part/crown glare.
    highlight = (v >= 110) & (s < 60)
    mask = (dark | very_dark | highlight).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask


def _hairline_row_at_column(
    mask: np.ndarray,
    col_center: int,
    col_width: int,
    row_start: int,
    row_end: int,
    density_thresh: float = 0.35,
) -> int:
    """Scan down a vertical band; return first row where hair density crosses threshold.

    Returns ``row_end`` (no hair found = fully receded) if never crossed.
    """
    h, w = mask.shape[:2]
    x0 = max(0, col_center - col_width // 2)
    x1 = min(w, col_center + col_width // 2)
    for row in range(row_start, row_end):
        band = mask[row, x0:x1]
        if band.size and (band > 0).mean() > density_thresh:
            return row
    return row_end


def _temple_recession_metrics(mask: np.ndarray) -> dict:
    """Measure hairline position at midline vs both temples.

    Temple columns at ~27%/73% of width — standard zone where Norwood temple
    triangles form (bilateral, symmetric, distinct from mid-frontal line).
    """
    h, w = mask.shape[:2]
    row_start, row_end = int(h * 0.02), int(h * 0.55)
    col_width = max(int(w * 0.08), 10)

    mid_col = w // 2
    left_temple_col = int(w * 0.27)
    right_temple_col = int(w * 0.73)

    mid_row = _hairline_row_at_column(mask, mid_col, col_width, row_start, row_end)
    left_row = _hairline_row_at_column(mask, left_temple_col, col_width, row_start, row_end)
    right_row = _hairline_row_at_column(mask, right_temple_col, col_width, row_start, row_end)

    mid_frac = mid_row / h
    left_frac = left_row / h
    right_frac = right_row / h

    left_recession = max(0.0, left_frac - mid_frac)
    right_recession = max(0.0, right_frac - mid_frac)
    temple_recession = (left_recession + right_recession) / 2
    asymmetry = abs(left_frac - right_frac)

    return {
        "midHairlineFrac": round(mid_frac, 4),
        "leftTempleFrac": round(left_frac, 4),
        "rightTempleFrac": round(right_frac, 4),
        "templeRecession": round(temple_recession, 4),
        "temporalAsymmetry": round(asymmetry, 4),
        "midFrontalFrac": round(mid_frac, 4),
        "midHairlineRow": int(mid_row),
    }


def _density_roi_below_hairline(mask: np.ndarray, mid_hairline_row: int) -> np.ndarray:
    """Density ROI starts at the detected mid hairline (not a fixed forehead %)."""
    h, w = mask.shape[:2]
    # Clamp so empty / full extremes still yield a usable band
    y0 = int(np.clip(mid_hairline_row, int(h * 0.02), int(h * 0.50)))
    y1 = max(y0 + 1, int(h * 0.85))
    x0, x1 = int(w * 0.18), int(w * 0.82)
    if x1 <= x0 or y1 <= y0:
        return mask[0:0, 0:0]
    return mask[y0:y1, x0:x1]


def _crown_roi(mask: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Legacy fixed ROI — kept for fallback when temple/mid hairline is unavailable."""
    h, w = mask.shape[:2]
    y0, y1 = int(h * 0.12), int(h * 0.72)
    x0, x1 = int(w * 0.18), int(w * 0.82)
    return mask[y0:y1, x0:x1], (x0, y0, x1, y1)


def _hairline_recession(mask: np.ndarray, mid_hairline_row: Optional[int] = None) -> tuple[str, float]:
    """Estimate hairline recession from first dense hair row near the midline."""
    h, w = mask.shape[:2]
    if mid_hairline_row is None:
        mid_x0, mid_x1 = int(w * 0.4), int(w * 0.6)
        hairline_row = int(h * 0.5)
        for row in range(int(h * 0.02), int(h * 0.55)):
            band = mask[row, mid_x0:mid_x1]
            if band.size and (band > 0).mean() > 0.35:
                hairline_row = row
                break
    else:
        hairline_row = int(mid_hairline_row)
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
    temple_metrics = _temple_recession_metrics(mask)
    mid_row = int(temple_metrics.get("midHairlineRow") or 0)

    crown = _density_roi_below_hairline(mask, mid_row)
    if crown.size == 0:
        crown, _ = _crown_roi(mask)
    if crown.size == 0:
        return None

    coverage = float((crown > 0).mean())
    density_pct = round(coverage * 100, 1)
    hairline, recession = _hairline_recession(mask, mid_row)

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
        "templeMetrics": temple_metrics,
        "segmentationMethod": "opencv_hsv",
        "dataSource": "measured",
    }
