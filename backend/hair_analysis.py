"""Top-of-head hair analysis — hair-mask segmentation + Norwood estimate."""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

from .hair_segmentation import analyze_hair_segmentation


def _norwood_stage(density_pct: float, hairline: str, thinning: str) -> int:
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

        norwood = _norwood_stage(density_pct, hairline, thinning)
        score = min(99, max(40, 75 + (8 if density_estimate == "Thick" else 0) - (10 if norwood >= 5 else 0)))
        parting_visible = (gray[int(h * 0.2), int(w * 0.45) : int(w * 0.55)] > 120).mean() > 0.3

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
            "partingVisible": parting_visible,
            "segmentationMethod": method,
            "dataSource": "measured",
            "explanation": (
                f"Hair analysis from top-of-head photo: {density_estimate.lower()} hair with "
                f"{coverage_estimate.lower()}. Estimated Norwood stage {norwood} (not a clinical diagnosis). "
                f"Hairline is {hairline.lower()} with {forehead_exposure.lower()} forehead exposure."
            ),
        }
        if seg:
            result["crownCoverage"] = seg.get("crownCoverage")
            result["hairlineRecession"] = seg.get("hairlineRecession")
        return result
    except Exception:
        return {**fallback, "explanation": "Top-of-head hair analysis failed."}
