"""Top-of-head hair analysis — hair-mask segmentation + Norwood estimate.

Stages 1–3 use temple-triangle geometry (Hamilton–Norwood clinical definition).
Density / crown signal only escalates stage 4+. Geometric thresholds (0.03 / 0.07 /
0.13) are pre-calibration placeholders — calibrate via scripts/calibrate_norwood_temples.py
before treating 1–3 boundaries as production-ready. Not a clinical diagnosis.
"""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

from .hair_segmentation import analyze_hair_segmentation


def _norwood_stage(density_pct: float, hairline: str, thinning: str) -> int:
    """Density-first heuristic — fallback only when temple geometry is unavailable."""
    if density_pct > 45 and hairline == "Full" and thinning == "None detected":
        return 1
    if density_pct > 35 and hairline in ("Full", "Slight recession"):
        return 2
    if density_pct > 25:
        return 3
    if density_pct > 18:
        return 4
    if density_pct > 12:
        return 5
    return 6 if density_pct > 8 else 7


def _norwood_stage_geometric(temple_metrics: dict, density_pct: float, thinning: str) -> int:
    """Norwood 1–3 from temple-triangle geometry; 4+ from density/crown.

    Thresholds 0.03 / 0.07 / 0.13 are relative depth-fraction placeholders — calibrate
    against labeled top-of-head photos before production trust on the 1/2/3 boundary.
    """
    temple_recession = float(temple_metrics.get("templeRecession") or 0.0)
    mid_frac = float(temple_metrics.get("midFrontalFrac") or 0.0)

    if temple_recession < 0.03 and mid_frac <= 0.22:
        stage = 1
    elif temple_recession < 0.07 and mid_frac <= 0.22:
        stage = 2
    elif temple_recession < 0.13 or mid_frac > 0.22:
        stage = 3
    else:
        stage = 4

    if stage >= 3:
        if density_pct <= 25:
            stage = max(stage, 4)
        if density_pct <= 18:
            stage = max(stage, 5)
        if density_pct <= 12:
            stage = max(stage, 6)
        if density_pct <= 8:
            stage = 7
    if thinning == "Crown thinning" and stage < 4:
        stage = max(stage, 3)

    return stage


def analyze_hair_photo(
    top_head_bytes: bytes,
    front_landmarks: Optional[list] = None,
    front_bytes: Optional[bytes] = None,
) -> dict:
    """Analyze a top-of-head photo for density, hairline, and estimated Norwood stage.

    Always runs OpenCV hair-mask segmentation first; falls back to dark-pixel
    heuristics only when the mask path fails. Returns ``dataSource`` of
    ``measured`` on success or ``estimated`` on failure.
    """
    _ = front_landmarks
    fallback = {
        "score": 70,
        "scoreLabel": "Natural",
        "hairline": "Estimated",
        "densityEstimate": "Moderate",
        "coverageEstimate": "Good coverage",
        "foreheadExposure": "Moderate",
        "dataSource": "estimated",
        "explanation": "Upload a top-of-head photo for real hair density & coverage analysis.",
    }
    if not top_head_bytes:
        return fallback

    try:
        nparr = np.frombuffer(top_head_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return fallback

        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        y0, y1 = int(h * 0.15), int(h * 0.75)
        x0, x1 = int(w * 0.2), int(w * 0.8)
        crown_bgr = img[y0:y1, x0:x1]
        crown_gray = gray[y0:y1, x0:x1]
        dark_mask = crown_gray < 80

        # Prefer hair-mask segmentation (always in pipeline).
        seg = analyze_hair_segmentation(top_head_bytes, front_bytes)
        temple_metrics = None
        if seg:
            density_pct = float(seg["densityPct"])
            density_estimate = seg["densityEstimate"]
            coverage_estimate = seg["coverageEstimate"]
            hairline = seg["hairline"]
            thinning = seg["thinningArea"]
            crown_visibility = seg["crownVisibility"]
            recession = float(seg.get("hairlineRecession") or 0.2)
            forehead_exposure = "Low" if recession < 0.12 else "Moderate" if recession < 0.22 else "High"
            method = seg.get("segmentationMethod", "opencv_hsv")
            temple_metrics = seg.get("templeMetrics")
        else:
            dark_ratio = float(dark_mask.mean()) if dark_mask.size else 0.0
            density_pct = round(dark_ratio * 100, 1)
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
            hairline_row = 0
            for row in range(int(h * 0.05), int(h * 0.5)):
                if gray[row, w // 2] > 140:
                    hairline_row = row
                    break
            hairline = (
                "Full" if hairline_row < h * 0.15 else "Slight recession" if hairline_row < h * 0.25 else "Receding"
            )
            forehead_exposure = "Low" if hairline_row < h * 0.12 else "Moderate" if hairline_row < h * 0.22 else "High"
            crown_l = (gray[int(h * 0.3) : int(h * 0.5), int(w * 0.25) : int(w * 0.45)] < 90).mean()
            crown_r = (gray[int(h * 0.3) : int(h * 0.5), int(w * 0.55) : int(w * 0.75)] < 90).mean()
            thinning = "Crown thinning" if crown_l < 0.3 and crown_r < 0.3 else "None detected"
            crown_visibility = "Visible thinning" if thinning != "None detected" else "Normal coverage"
            method = "dark_pixel_heuristic"

        if dark_mask.any():
            mean_bgr = crown_bgr[dark_mask].mean(axis=0)
            b, g, r = (float(mean_bgr[0]), float(mean_bgr[1]), float(mean_bgr[2]))
            hair_color = "Black" if b < 50 else "Dark brown" if b < 90 else "Brown" if b < 130 else "Light"
            hair_color_hex = f"#{int(r):02x}{int(g):02x}{int(b):02x}"
        else:
            hair_color, hair_color_hex = "Brown", "#3d2b1f"

        if temple_metrics:
            norwood = _norwood_stage_geometric(temple_metrics, density_pct, thinning)
            staging_method = "temple_geometry"
        else:
            norwood = _norwood_stage(density_pct, hairline, thinning)
            staging_method = "density_heuristic_fallback"

        score = min(99, max(40, 75 + (8 if density_estimate == "Thick" else 0) - (10 if norwood >= 5 else 0)))
        parting_visible = (gray[int(h * 0.2), int(w * 0.45) : int(w * 0.55)] > 120).mean() > 0.3

        # Client-facing prose: depth as plain English, no internal key names.
        if temple_metrics:
            depth = float(temple_metrics.get("templeRecession") or 0.0)
            explanation = (
                f"Hair analysis from top-of-head photo: {density_estimate.lower()} hair with "
                f"{coverage_estimate.lower()}. Estimated Norwood stage {norwood} "
                f"(not a clinical diagnosis; stage 1–3 boundaries use temple recession geometry "
                f"and are pre-calibration estimates). Mean temple recession depth is about "
                f"{depth * 100:.1f}% of scalp height relative to the mid-frontal hairline — "
                f"not scalp coverage percentage. "
                f"Hairline is {hairline.lower()} with {forehead_exposure.lower()} forehead exposure."
            )
        else:
            explanation = (
                f"Hair analysis from top-of-head photo: {density_estimate.lower()} hair with "
                f"{coverage_estimate.lower()}. Estimated Norwood stage {norwood} (not a clinical diagnosis). "
                f"Hairline is {hairline.lower()} with {forehead_exposure.lower()} forehead exposure."
            )

        result = {
            "score": score,
            "scoreLabel": "Healthy" if score >= 85 else "Natural" if score >= 70 else "Monitor",
            "hairline": hairline,
            "densityEstimate": density_estimate,
            "coverageEstimate": coverage_estimate,
            "foreheadExposure": forehead_exposure,
            "hairColor": hair_color,
            "hairColorHex": hair_color_hex,
            "textureType": "Straight",
            "thinningArea": thinning,
            "crownVisibility": crown_visibility,
            "densityPct": density_pct,
            "norwoodStage": norwood,
            "norwoodStagingMethod": staging_method,
            "partingVisible": parting_visible,
            "segmentationMethod": method,
            "dataSource": "measured",
            "explanation": explanation,
        }
        if seg:
            result["crownCoverage"] = seg.get("crownCoverage")
            result["hairlineRecession"] = seg.get("hairlineRecession")
            if temple_metrics:
                result["templeMetrics"] = temple_metrics
        return result
    except Exception:
        return {**fallback, "explanation": "Top-of-head hair analysis failed."}
