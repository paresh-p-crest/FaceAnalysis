"""Smile dentofacial analysis — dedicated landmark pass on smile photo."""

from __future__ import annotations

from typing import Optional

import cv2
import numpy as np

from .face_crop import lm
from .mediapipe_analysis import analyze_with_mediapipe


def analyze_smile_photo(smile_bytes: bytes, neutral_landmarks: Optional[list] = None) -> dict:
    fallback = {
        "teethVisibility": "N/A",
        "smileArc": "N/A",
        "gumExposure": "N/A",
        "teethWhiteness": "N/A",
        "smileWidthPx": "N/A",
        "dataSource": "unavailable",
        "explanation": "Upload a smile photo for enhanced teeth & smile analysis.",
    }
    if not smile_bytes:
        return fallback

    try:
        mp_result = analyze_with_mediapipe(smile_bytes)
        landmarks = mp_result.get("landmarks", [])
        if not landmarks:
            return fallback

        nparr = np.frombuffer(smile_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return fallback

        h, w = img.shape[:2]
        mouth_l = lm(landmarks, 61)
        mouth_r = lm(landmarks, 291)
        upper_lip = lm(landmarks, 13)
        lower_lip = lm(landmarks, 14)

        cx = (mouth_l["x"] + mouth_r["x"]) / 2
        cy = (upper_lip["y"] + lower_lip["y"]) / 2
        mouth_w = abs(mouth_r["x"] - mouth_l["x"]) * 1.5
        mouth_h = abs(lower_lip["y"] - upper_lip["y"]) * 3.0

        sx = max(0, round((cx - mouth_w / 2) * w))
        sy = max(0, round((cy - mouth_h / 2) * h))
        sw = min(w - sx, max(5, round(mouth_w * w)))
        sh = min(h - sy, max(5, round(mouth_h * h)))

        crop = img[sy : sy + sh, sx : sx + sw]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        lip_mid_y = max(1, round(sh * 0.35))
        lip_bot_y = min(sh - 1, round(sh * 0.65))

        mouth_region = gray[lip_mid_y:lip_bot_y, max(0, round(sw * 0.1)) : min(sw, round(sw * 0.9))]
        teeth_ratio = (mouth_region > 160).sum() / max(1, mouth_region.size)
        teeth_visibility = (
            "High" if teeth_ratio > 0.3 else "Moderate" if teeth_ratio > 0.12 else "Low" if teeth_ratio > 0.04 else "Minimal"
        )

        color_crop = crop[lip_mid_y:lip_bot_y, max(0, round(sw * 0.1)) : min(sw, round(sw * 0.9))]
        white_mask = mouth_region > 160
        whiteness_score = color_crop[white_mask].mean() if white_mask.any() else 200
        teeth_whiteness = (
            "Very White" if whiteness_score > 220 else "White" if whiteness_score > 190 else "Natural" if whiteness_score > 160 else "Yellowish"
        )

        arc_y = min(sh - 1, lip_mid_y + 2)
        left_b = int(gray[arc_y, max(0, round(sw * 0.15))])
        center_b = int(gray[arc_y, round(sw * 0.5)])
        right_b = int(gray[arc_y, min(sw - 1, round(sw * 0.85))])
        smile_arc = (
            "Consonant (ideal U-shape)" if center_b > left_b and center_b > right_b
            else "Slightly curved" if center_b > (left_b + right_b) / 2
            else "Flat"
        )

        gum_y = max(0, lip_mid_y - 3)
        gum_ratio = 0.0
        if gum_y < sh:
            gum_region = crop[gum_y, round(sw * 0.2) : round(sw * 0.8)]
            if gum_region.size:
                gum_ratio = (cv2.cvtColor(gum_region.reshape(-1, 1, 3), cv2.COLOR_BGR2GRAY) < 120).mean()
        gum_exposure = "Gummy smile" if gum_ratio > 0.2 else "Slight gum show" if gum_ratio > 0.08 else "Minimal"

        smile_width_px = round(abs(mouth_r["x"] - mouth_l["x"]) * w)
        mouth_width_ratio = round(smile_width_px / max(1, w), 3)

        nasolabial_delta = None
        if neutral_landmarks:
            n_fold_neutral = abs(lm(neutral_landmarks, 61)["y"] - lm(neutral_landmarks, 13)["y"])
            n_fold_smile = abs(mouth_l["y"] - upper_lip["y"])
            nasolabial_delta = round(n_fold_smile - n_fold_neutral, 4)

        return {
            "teethVisibility": teeth_visibility,
            "smileArc": smile_arc,
            "gumExposure": gum_exposure,
            "teethWhiteness": teeth_whiteness,
            "smileWidthPx": smile_width_px,
            "smileWidthRatio": mouth_width_ratio,
            "nasolabialFoldDelta": nasolabial_delta,
            "dataSource": "measured",
            "explanation": (
                f"Smile analysis: {teeth_visibility.lower()} teeth visibility with {smile_arc.lower()}. "
                f"Gum exposure is {gum_exposure.lower()}. Teeth appear {teeth_whiteness.lower()}."
            ),
        }
    except Exception:
        return {**fallback, "explanation": "Smile photo analysis failed."}
