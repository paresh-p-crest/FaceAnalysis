"""Port of cvReport.js — All facial feature metric functions + build_cv_report().

This is the largest module in the backend.  Every metric function is a direct
1:1 port preserving formulas, thresholds, scores, and explanation text.
"""

from __future__ import annotations
import math
from typing import Optional

import cv2
import numpy as np

from .face_crop import (
    lm, dist, dist_landmarks, angle_between,
    bbox_from_indices, merge_bboxes, bbox_full_face,
    dots_in_image, point_in_image, proportion_lines_in_image, proportion_ratio_overlays,
    mouth_cheilions, nose_alae,
    FACE_OVAL, RIGHT_EYE, LEFT_EYE, RIGHT_BROW, LEFT_BROW,
    SYMMETRY_DOTS, NOSE_BRIDGE, NOSE_TIP, UPPER_LIP, LOWER_LIP,
    JAW_LEFT, JAW_RIGHT, CHIN, MOUTH, CHEEK_LEFT, CHEEK_RIGHT,
    APPLE_LEFT, APPLE_RIGHT,
)
from .eye_analysis import crop_normalized, sample_region_stats, analyze_brows_crop
from .skin_texture import analyze_skin_lab
from .opencv_metrics import analyze_image_stats
from .pose_analysis import (
    analyze_with_pose,
    pose_point,
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    LEFT_EAR,
    RIGHT_EAR,
)


# ══════════════════════════════════════════════════════════════════════════════
# Safe formatting helpers (port of safeFormat.js)
# ══════════════════════════════════════════════════════════════════════════════

def _safe_num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _safe_fixed(v, decimals=1) -> str:
    return f"{_safe_num(v):.{decimals}f}"


def _safe_round(v) -> int:
    return round(_safe_num(v))


# ══════════════════════════════════════════════════════════════════════════════
# Nose Metrics
# ══════════════════════════════════════════════════════════════════════════════

def nose_metrics(landmarks: list) -> dict:
    nose_tip = lm(landmarks, 1)
    nose_bridge = lm(landmarks, 6)
    nose_base_l = lm(landmarks, 48)
    nose_base_r = lm(landmarks, 278)
    nose_width = abs(nose_base_r["x"] - nose_base_l["x"])
    nose_length = abs(nose_tip["y"] - nose_bridge["y"])
    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    face_h = chin["y"] - forehead["y"] or 0.3
    nose_ratio = nose_length / face_h
    width_length_ratio = nose_width / (nose_length or 0.01)

    width_class = "Narrow"
    if width_length_ratio > 0.68:
        width_class = "Wide"
    elif width_length_ratio > 0.55:
        width_class = "Moderate"

    bridge_l = lm(landmarks, 168)
    bridge_r = lm(landmarks, 6)
    bridge_w = abs(bridge_l["x"] - bridge_r["x"])
    tip_proj = nose_tip.get("z", 0)

    score = 85
    if 0.28 < nose_ratio < 0.38:
        score += 5
    if 0.45 < width_length_ratio < 0.65:
        score += 5
    if nose_ratio < 0.24 or nose_ratio > 0.42:
        score -= 10
    score = min(99, max(55, score))

    return {
        "score": score,
        "scoreLabel": "Harmonious" if score >= 80 else ("Balanced" if score >= 70 else "Distinctive"),
        "width": width_class,
        "widthLengthRatio": f"{width_length_ratio:.2f}",
        "noseRatio": f"{nose_ratio:.2f}",
        "bridgeWidth": f"{bridge_w * 100:.1f}",
        "tipProjection": f"{tip_proj:.3f}",
        "explanation": (
            f"The subject's nose displays a {width_class.lower()} alar base with a nose-to-face ratio "
            f"of {nose_ratio:.2f}. The width-to-length ratio of {width_length_ratio:.2f} suggests "
            f"a {'harmonious' if score >= 80 else ('well-proportioned' if score >= 70 else 'distinctive')} "
            f"nasal structure relative to the subject's facial dimensions."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Lip Metrics
# ══════════════════════════════════════════════════════════════════════════════

def lip_metrics(landmarks: list) -> dict:
    upper_lip = lm(landmarks, 13)
    lower_lip = lm(landmarks, 14)
    philtrum_top = lm(landmarks, 168)
    lip_width_l = lm(landmarks, 61)
    lip_width_r = lm(landmarks, 291)

    mouth_width = abs(lip_width_r["x"] - lip_width_l["x"])
    upper_lip_h = abs(upper_lip["y"] - philtrum_top["y"])
    lower_lip_h = abs(lower_lip["y"] - upper_lip["y"])
    philtrum_to_lip_ratio = upper_lip_h / (lower_lip_h or 0.001)

    cupid_l = lm(landmarks, 37)
    cupid_r = lm(landmarks, 267)
    cupid_center = lm(landmarks, 13)
    bow_width = dist_landmarks(cupid_l, cupid_r) / (mouth_width or 0.001)
    peak_avg_y = (cupid_l["y"] + cupid_r["y"]) / 2
    bow_depth = abs(cupid_center["y"] - peak_avg_y) / (upper_lip_h or 0.001)
    cupids_bow = "Defined" if bow_depth > 0.25 and bow_width > 0.35 else ("Subtle" if bow_depth > 0.12 else "Flat")

    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    face_h = chin["y"] - forehead["y"] or 0.3

    lip_width_ratio = mouth_width / (face_h or 0.3)
    lip_fullness = (upper_lip_h + lower_lip_h) / (mouth_width or 0.001)

    fullness = "Balanced"
    if lip_fullness > 0.55:
        fullness = "Full"
    elif lip_fullness < 0.38:
        fullness = "Thin"

    philtrum_class = "Proportionate"
    if philtrum_to_lip_ratio > 1.4:
        philtrum_class = "Longer philtrum"
    elif philtrum_to_lip_ratio < 0.7:
        philtrum_class = "Shorter philtrum"

    score = 82
    if 0.42 < lip_fullness < 0.58:
        score += 6
    if 0.75 < philtrum_to_lip_ratio < 1.35:
        score += 4
    score = min(99, max(60, score))

    return {
        "score": score,
        "scoreLabel": "Harmonious" if score >= 82 else ("Balanced" if score >= 72 else "Distinctive"),
        "fullness": fullness,
        "philtrum": philtrum_class,
        "lipWidthRatio": f"{lip_width_ratio:.2f}",
        "philtrumToLipRatio": f"{philtrum_to_lip_ratio:.2f}",
        "lipFullness": f"{lip_fullness:.2f}",
        "cupidsBowDefinition": cupids_bow,
        "cupidsBowDepth": f"{bow_depth:.2f}",
        "explanation": (
            f"The subject's lips show {fullness.lower()} volume with a {philtrum_to_lip_ratio:.2f} "
            f"philtrum-to-lip ratio and {cupids_bow.lower()} cupid's bow definition. "
            f"The upper-to-lower lip proportion is "
            f"{philtrum_class.lower()}, contributing to a "
            f"{'harmonious' if score >= 82 else 'balanced'} perioral appearance."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Jaw-Chin Metrics (combined)
# ══════════════════════════════════════════════════════════════════════════════

def jaw_chin_metrics(landmarks: list) -> dict:
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    face_w = abs(jaw_r["x"] - jaw_l["x"])
    face_h = chin["y"] - forehead["y"] or 0.3
    face_ratio = face_w / face_h

    cheek_l = lm(landmarks, 127)
    cheek_r = lm(landmarks, 356)
    gonion_l = lm(landmarks, 172)
    gonion_r = lm(landmarks, 397)
    jaw_width_gonial = dist_landmarks(gonion_l, gonion_r)
    cheek_width = dist_landmarks(cheek_l, cheek_r) or jaw_width_gonial
    jaw_taper = jaw_width_gonial / (cheek_width or 0.001)

    jaw_angle_l = abs(math.atan2(chin["y"] - jaw_l["y"], chin["x"] - jaw_l["x"]) * 180 / math.pi)
    jaw_angle_r = abs(math.atan2(chin["y"] - jaw_r["y"], chin["x"] - jaw_r["x"]) * 180 / math.pi)
    avg_jaw_angle = (jaw_angle_l + jaw_angle_r) / 2

    chin_proj = chin.get("z", 0)
    lip_lower = lm(landmarks, 14)
    chin_depth = abs(chin["y"] - lip_lower["y"]) / face_h

    jaw_shape = "Oval"
    if face_ratio > 0.78 and jaw_taper > 0.88:
        jaw_shape = "Square"
    elif jaw_taper > 0.92 and avg_jaw_angle > 125:
        jaw_shape = "V-shape"
    elif jaw_taper < 0.78:
        jaw_shape = "U-shape"
    elif face_ratio > 0.72:
        jaw_shape = "Round"
    elif face_ratio < 0.62:
        jaw_shape = "Narrow"

    chin_type = "Balanced"
    if chin_depth > 0.12:
        chin_type = "Prominent"
    elif chin_depth < 0.07:
        chin_type = "Recessed"

    score = 78
    if 0.63 < face_ratio < 0.78:
        score += 8
    if 0.07 < chin_depth < 0.13:
        score += 5
    score = min(99, max(55, score))

    return {
        "score": score,
        "scoreLabel": "Strong" if score >= 80 else ("Defined" if score >= 70 else "Soft"),
        "jawShape": jaw_shape,
        "chinType": chin_type,
        "faceRatio": f"{face_ratio:.2f}",
        "jawAngle": f"{avg_jaw_angle:.1f}",
        "gonialAngleFront": f"{avg_jaw_angle:.1f}",
        "jawTaperRatio": f"{jaw_taper:.2f}",
        "chinDepth": f"{chin_depth:.2f}",
        "jawAngleDataSource": "front_estimate",
        "explanation": (
            f"The subject's jaw displays a {jaw_shape.lower()} contour with a face width-to-height "
            f"ratio of {face_ratio:.2f}. The chin appears {chin_type.lower()} with a jaw angle "
            f"of {avg_jaw_angle:.1f}° — "
            f"{'contributing to a strong, defined lower facial frame' if score >= 80 else 'creating a softer lower facial contour'}."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Jaw (standalone)
# ══════════════════════════════════════════════════════════════════════════════

def jaw_metrics(landmarks: list) -> dict:
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    cheek_l = lm(landmarks, 127)
    cheek_r = lm(landmarks, 356)
    lip_lower = lm(landmarks, 14)
    face_w = abs(jaw_r["x"] - jaw_l["x"])
    face_h = chin["y"] - forehead["y"] or 0.3
    ipd = dist_landmarks(lm(landmarks, 33), lm(landmarks, 263)) or 0.001

    jaw_width_pct = ((face_w / (dist_landmarks(cheek_l, cheek_r) or face_w)) * 100)
    jaw_width_class = (
        "Wide" if jaw_width_pct > 90 else ("Balanced" if jaw_width_pct > 75 else "Narrow")
    )

    angle_l = abs(math.atan2(chin["y"] - jaw_l["y"], chin["x"] - jaw_l["x"]) * 180 / math.pi)
    angle_r = abs(math.atan2(chin["y"] - jaw_r["y"], chin["x"] - jaw_r["x"]) * 180 / math.pi)
    avg_angle = (angle_l + angle_r) / 2
    mandibular_def = (
        "Soft" if avg_angle > 140 else ("Defined" if avg_angle > 120 else "Angular")
    )

    jaw_length_l = dist_landmarks(jaw_l, chin)
    jaw_length_r = dist_landmarks(jaw_r, chin)
    avg_jaw_length = ((jaw_length_l + jaw_length_r) / 2 / face_h * 100)
    jaw_length_class = (
        "Long" if avg_jaw_length > 55 else ("Balanced" if avg_jaw_length > 40 else "Short")
    )

    # Contour smoothness
    jaw_pts_list = [lm(landmarks, i) for i in [172, 136, 150, 149, 176, 148, 152]]
    smoothness_sum = 0.0
    for i in range(1, len(jaw_pts_list) - 1):
        angle = angle_between(jaw_pts_list[i - 1], jaw_pts_list[i], jaw_pts_list[i + 1])
        smoothness_sum += abs(angle - 180)
    avg_smoothness = smoothness_sum / max(1, len(jaw_pts_list) - 2)
    contour_smooth = "Smooth" if avg_smoothness < 15 else ("Moderate" if avg_smoothness < 30 else "Rough")

    jaw_z = abs(jaw_l.get("z", 0) - jaw_r.get("z", 0))
    jawline_def_label = "Moderate"
    if jaw_z > 0.05:
        jawline_def_label = "Well-defined"
    elif jaw_z < 0.02:
        jawline_def_label = "Soft"

    score = 72
    if jaw_width_class == "Balanced":
        score += 8
    if mandibular_def == "Defined":
        score += 6
    if jaw_length_class == "Balanced":
        score += 4
    if contour_smooth == "Smooth":
        score += 3
    if jawline_def_label == "Well-defined":
        score += 4
    if mandibular_def == "Soft":
        score -= 3
    score = min(99, max(50, score))

    return {
        "score": score,
        "scoreLabel": "Strong" if score >= 85 else ("Defined" if score >= 70 else "Soft"),
        "jawWidth": f"{jaw_width_pct:.1f}",
        "jawWidthClass": jaw_width_class,
        "jawAngle": f"{avg_angle:.1f}",
        "gonialAngleFront": f"{avg_angle:.1f}",
        "jawAngleDataSource": "front_estimate",
        "mandibularDefinition": mandibular_def,
        "jawLength": f"{avg_jaw_length:.1f}",
        "jawLengthClass": jaw_length_class,
        "contourSmoothness": contour_smooth,
        "jawlineDefinition": jawline_def_label,
        "explanation": (
            f"The subject's jaw spans {jaw_width_pct:.1f}% of facial width ({jaw_width_class}) with a "
            f"{mandibular_def.lower()} mandibular angle of {avg_angle:.1f}°. The jawline shows "
            f"{contour_smooth.lower()} contour smoothness and {jawline_def_label.lower()} definition. "
            f"Jaw length is {jaw_length_class.lower()} at {avg_jaw_length:.1f}% of face height."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Chin (standalone)
# ══════════════════════════════════════════════════════════════════════════════

def chin_metrics(landmarks: list) -> dict:
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    lip_lower = lm(landmarks, 14)
    lip_upper = lm(landmarks, 13)
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    nose_tip = lm(landmarks, 1)
    face_h = chin["y"] - forehead["y"] or 0.3
    face_w = abs(jaw_r["x"] - jaw_l["x"]) or 0.3
    ipd = dist_landmarks(lm(landmarks, 33), lm(landmarks, 263)) or 0.001

    chin_height = abs(chin["y"] - lip_lower["y"]) / face_h
    chin_height_pct = chin_height * 100
    chin_height_class = "Long" if chin_height > 0.12 else ("Balanced" if chin_height > 0.06 else "Short")

    chin_proj = chin.get("z", 0)
    nose_proj = nose_tip.get("z", 0)
    proj_diff = chin_proj - nose_proj
    projection = "Prominent" if proj_diff > -0.02 else ("Balanced" if proj_diff > -0.06 else "Recessed")

    chin_l = lm(landmarks, 148)
    chin_r = lm(landmarks, 377)
    chin_width = dist_landmarks(chin_l, chin_r) / face_w * 100
    chin_width_class = "Wide" if chin_width > 70 else ("Balanced" if chin_width > 50 else "Narrow")

    chin_mid = lm(landmarks, 152)
    chin_left = lm(landmarks, 149)
    chin_right = lm(landmarks, 378)
    angle = angle_between(chin_left, chin_mid, chin_right)
    chin_shape = "Round" if angle > 160 else ("Soft square" if angle > 120 else "Pointed")

    labiomental_angle = angle_between(lip_lower, lm(landmarks, 17), chin)
    labiomental_class = "Open" if labiomental_angle > 120 else ("Defined" if labiomental_angle > 90 else "Deep")

    score = 75
    if chin_height_class == "Balanced":
        score += 7
    if projection in ("Balanced", "Prominent"):
        score += 5
    if chin_width_class == "Balanced":
        score += 4
    if projection == "Recessed":
        score -= 5
    if chin_height_class == "Short":
        score -= 3
    score = min(99, max(50, score))

    return {
        "score": score,
        "scoreLabel": "Well-proportioned" if score >= 85 else ("Balanced" if score >= 70 else "Soft"),
        "chinHeight": f"{chin_height_pct:.1f}",
        "chinHeightClass": chin_height_class,
        "projection": projection,
        "chinWidth": f"{chin_width:.1f}",
        "chinWidthClass": chin_width_class,
        "chinShape": chin_shape,
        "labiomentalAngle": f"{labiomental_angle:.1f}",
        "labiomentalClassification": labiomental_class,
        "explanation": (
            f"The subject's chin is {chin_height_class.lower()} ({chin_height_pct:.1f}% of face height) "
            f"with {projection.lower()} projection. The chin is {chin_width_class.lower()} "
            f"({chin_width:.1f}% of face width) with a {chin_shape.lower()} shape. The labiomental "
            f"fold shows a {labiomental_class.lower()} angle of {labiomental_angle:.1f}°, contributing "
            f"to lower facial balance."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Smile Metrics
# ══════════════════════════════════════════════════════════════════════════════

def smile_metrics(landmarks: list) -> dict:
    mouth_l = lm(landmarks, 61)
    mouth_r = lm(landmarks, 291)
    upper_lip = lm(landmarks, 13)
    lower_lip = lm(landmarks, 14)
    nose_tip = lm(landmarks, 1)
    ipd = dist_landmarks(lm(landmarks, 33), lm(landmarks, 263)) or 0.001

    mouth_width = dist_landmarks(mouth_l, mouth_r)
    mouth_width_ratio = mouth_width / ipd
    mouth_width_class = "Wide" if mouth_width_ratio > 1.5 else ("Balanced" if mouth_width_ratio > 1.1 else "Narrow")

    lip_center = lm(landmarks, 0)
    corner_avg_y = (mouth_l["y"] + mouth_r["y"]) / 2
    curvature_pct = (lip_center["y"] - corner_avg_y) / ipd * 100
    curvature = "Upturned" if curvature_pct > 3 else ("Straight" if curvature_pct > -2 else "Downturned")

    nose_l = lm(landmarks, 48)
    nose_r = lm(landmarks, 278)
    nose_width = dist_landmarks(nose_l, nose_r)
    smile_width_ratio = mouth_width / nose_width
    smile_width_class = "Wide" if smile_width_ratio > 1.8 else ("Balanced" if smile_width_ratio > 1.3 else "Narrow")

    upper_thickness = dist_landmarks(upper_lip, lm(landmarks, 0))
    lower_thickness = dist_landmarks(lower_lip, lm(landmarks, 17))
    ul_ratio = upper_thickness / (lower_thickness or 0.001)
    lip_balance = "Upper-heavy" if ul_ratio > 1.3 else ("Lower-heavy" if ul_ratio < 0.7 else "Balanced")

    naso_fold_l = lm(landmarks, 50)
    naso_fold_r = lm(landmarks, 280)
    fold_depth = abs((naso_fold_l.get("z", 0) + naso_fold_r.get("z", 0)) / 2)
    fold_prominence = "Deep" if fold_depth > 0.03 else ("Moderate" if fold_depth > 0.01 else "Subtle")

    score = 78
    if mouth_width_class == "Balanced":
        score += 5
    if curvature == "Upturned":
        score += 4
    if smile_width_class == "Balanced":
        score += 3
    if lip_balance == "Balanced":
        score += 4
    if fold_prominence == "Subtle":
        score += 3
    if curvature == "Downturned":
        score -= 3
    score = min(99, max(50, score))

    return {
        "score": score,
        "scoreLabel": "Expressive" if score >= 85 else ("Balanced" if score >= 70 else "Subtle"),
        "mouthWidthRatio": f"{mouth_width_ratio:.2f}",
        "mouthWidthClass": mouth_width_class,
        "curvature": curvature,
        "curvaturePct": f"{curvature_pct:.1f}",
        "smileWidthRatio": f"{smile_width_ratio:.2f}",
        "smileWidthClass": smile_width_class,
        "lipBalance": lip_balance,
        "upperToLowerRatio": f"{ul_ratio:.2f}",
        "nasolabialFold": fold_prominence,
        "explanation": (
            f"The subject's smile spans {mouth_width_ratio:.2f}× interpupillary distance ({mouth_width_class}) "
            f"with a {curvature.lower()} curvature of {curvature_pct:.1f}%. The smile width is "
            f"{smile_width_class.lower()} relative to nose width ({smile_width_ratio:.2f}×). "
            f"Upper-to-lower lip ratio is {ul_ratio:.2f} ({lip_balance}). "
            f"Nasolabial folds show {fold_prominence.lower()} prominence."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Neck Metrics
# ══════════════════════════════════════════════════════════════════════════════

def neck_metrics(landmarks: list, pose: Optional[dict] = None) -> dict:
    """Neck proportions from FaceMesh jaw + optional MediaPipe Pose shoulders.

    When Pose shoulders are visible, neck length and head-forward posture use
    jaw→shoulder geometry (``dataSource: measured``). Otherwise falls back to
    jaw-only proxies (``dataSource: approximate``).
    """
    chin = lm(landmarks, 152)
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    forehead = lm(landmarks, 10)
    face_h = chin["y"] - forehead["y"] or 0.3
    ipd = dist_landmarks(lm(landmarks, 33), lm(landmarks, 263)) or 0.001

    jaw_width = dist_landmarks(jaw_l, jaw_r)
    neck_width_pct = (jaw_width / ipd) * 100
    neck_width_class = "Wide" if neck_width_pct > 120 else ("Balanced" if neck_width_pct > 95 else "Slender")

    angle_l = angle_between(lm(landmarks, 127), jaw_l, chin)
    angle_r = angle_between(lm(landmarks, 356), jaw_r, chin)
    avg_angle = (angle_l + angle_r) / 2
    jaw_neck_angle = "Smooth" if avg_angle > 150 else ("Defined" if avg_angle > 120 else "Angular")

    pose_ok = bool(pose and pose.get("shouldersVisible"))
    shoulder_width_pct = None
    posture_angle_deg = None

    if pose_ok:
        sh_l = pose_point(pose, LEFT_SHOULDER)
        sh_r = pose_point(pose, RIGHT_SHOULDER)
        shoulder_mid = {
            "x": (sh_l["x"] + sh_r["x"]) / 2,
            "y": (sh_l["y"] + sh_r["y"]) / 2,
        }
        shoulder_span = dist_landmarks(sh_l, sh_r)
        shoulder_width_pct = round((shoulder_span / ipd) * 100, 1)

        # Neck length: chin → shoulder midline, relative to face height
        neck_len_norm = dist_landmarks(chin, shoulder_mid)
        neck_length_pct = (neck_len_norm / face_h) * 100
        # Thresholds calibrated for jaw→shoulder span (smaller than jaw-proxy ratios)
        neck_length_class = (
            "Long" if neck_length_pct > 40 else ("Balanced" if neck_length_pct > 22 else "Short")
        )

        # Head-forward posture: ear midpoint horizontal offset vs shoulder midline
        # (positive = ears ahead of shoulders → forward head posture)
        if pose.get("earsVisible"):
            ear_l = pose_point(pose, LEFT_EAR)
            ear_r = pose_point(pose, RIGHT_EAR)
            ear_mid = {
                "x": (ear_l["x"] + ear_r["x"]) / 2,
                "y": (ear_l["y"] + ear_r["y"]) / 2,
            }
        else:
            # FaceMesh ear proxies when Pose ears are weak
            ear_mid = {
                "x": (jaw_l["x"] + jaw_r["x"]) / 2,
                "y": (jaw_l["y"] + jaw_r["y"]) / 2,
            }

        dx = ear_mid["x"] - shoulder_mid["x"]
        dy = shoulder_mid["y"] - ear_mid["y"]  # positive when shoulders below ears
        if abs(dy) < 1e-6:
            posture_angle_deg = 0.0
        else:
            posture_angle_deg = round(math.degrees(math.atan2(dx, dy)), 1)
        if abs(posture_angle_deg) < 8:
            posture = "Neutral"
        elif posture_angle_deg > 0:
            posture = "Forward tilt"
        else:
            posture = "Rear tilt"

        data_source = "measured"
        limitation = None
        length_basis = "jaw-to-shoulder"
    else:
        chin_to_jaw_l = dist_landmarks(chin, jaw_l)
        chin_to_jaw_r = dist_landmarks(chin, jaw_r)
        avg_chin_to_jaw = (chin_to_jaw_l + chin_to_jaw_r) / 2
        neck_length_pct = (avg_chin_to_jaw / face_h) * 100
        neck_length_class = (
            "Long" if neck_length_pct > 55 else ("Balanced" if neck_length_pct > 38 else "Short")
        )
        chin_z = chin.get("z", 0)
        fore_z = forehead.get("z", 0)
        tilt_diff = chin_z - fore_z
        posture = "Forward tilt" if tilt_diff > 0.02 else ("Rear tilt" if tilt_diff < -0.02 else "Neutral")
        data_source = "approximate"
        limitation = "Neck estimates are approximate from jaw proportions — shoulders were not visible in the front photo."
        length_basis = "jaw-proxy"

    score = 75
    if neck_width_class == "Balanced":
        score += 6
    if neck_length_class == "Balanced":
        score += 5
    if jaw_neck_angle == "Defined":
        score += 4
    if posture == "Neutral":
        score += 3
    if neck_width_class == "Wide":
        score -= 3
    if data_source == "measured":
        score += 2
    score = min(99, max(50, score))

    result = {
        "score": score,
        "scoreLabel": "Elegant" if score >= 85 else ("Balanced" if score >= 70 else "Compact"),
        "neckWidth": f"{neck_width_pct:.1f}",
        "neckWidthClass": neck_width_class,
        "neckLength": f"{neck_length_pct:.1f}",
        "neckLengthClass": neck_length_class,
        "jawNeckTransition": jaw_neck_angle,
        "jawNeckAngle": f"{avg_angle:.1f}",
        "headPosture": posture,
        "lengthBasis": length_basis,
        "dataSource": data_source,
        "explanation": (
            f"The subject's neck proportions show {neck_width_class.lower()} width ({neck_width_pct:.1f}% of IPD) "
            f"and {neck_length_class.lower()} length ({neck_length_pct:.1f}% of face height"
            f"{' from jaw to shoulder line' if data_source == 'measured' else ''}). "
            f"The jaw-to-neck transition is {jaw_neck_angle.lower()} at {avg_angle:.1f}°. "
            f"Head posture appears {posture.lower()}"
            f"{f' ({posture_angle_deg}° from vertical)' if posture_angle_deg is not None else ''}."
        ),
    }
    if limitation:
        result["limitation"] = limitation
    if shoulder_width_pct is not None:
        result["shoulderWidthPct"] = shoulder_width_pct
    if posture_angle_deg is not None:
        result["headPostureAngleDeg"] = posture_angle_deg
    return result


# ══════════════════════════════════════════════════════════════════════════════
# Ear Metrics
# ══════════════════════════════════════════════════════════════════════════════

def ear_metrics(landmarks: list) -> dict:
    ear_l = lm(landmarks, 234)
    ear_r = lm(landmarks, 454)
    eye_l = lm(landmarks, 33)
    eye_r = lm(landmarks, 263)
    nose_tip = lm(landmarks, 1)
    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    face_h = chin["y"] - forehead["y"] or 0.3
    ipd = dist_landmarks(eye_l, eye_r) or 0.001

    ear_size_l = dist_landmarks(ear_l, eye_l) / ipd
    ear_size_r = dist_landmarks(ear_r, eye_r) / ipd
    avg_ear_size = (ear_size_l + ear_size_r) / 2
    ear_size_class = "Prominent" if avg_ear_size > 1.3 else ("Balanced" if avg_ear_size > 0.9 else "Small")

    size_diff = abs(ear_size_l - ear_size_r) / ipd * 100
    ear_symmetry = "Symmetric" if size_diff < 5 else ("Mildly asymmetric" if size_diff < 12 else "Asymmetric")

    avg_ear_z = (abs(ear_l.get("z", 0)) + abs(ear_r.get("z", 0))) / 2
    protrusion = "Protruding" if avg_ear_z > 0.08 else ("Moderate" if avg_ear_z > 0.04 else "Close-set")

    ear_mid_y = (ear_l["y"] + ear_r["y"]) / 2
    face_mid_y = (chin["y"] + forehead["y"]) / 2
    ear_vert_pos = (
        "Low-set" if ear_mid_y > face_mid_y
        else ("High-set" if ear_mid_y < face_mid_y - 0.02 else "Mid-set")
    )

    score = 78
    if ear_size_class == "Balanced":
        score += 6
    if ear_symmetry == "Symmetric":
        score += 5
    if protrusion == "Moderate":
        score += 4
    if ear_vert_pos == "Mid-set":
        score += 3
    if ear_size_class == "Prominent":
        score -= 2
    if protrusion == "Protruding":
        score -= 3
    score = min(99, max(50, score))

    return {
        "score": score,
        "scoreLabel": "Proportioned" if score >= 85 else ("Balanced" if score >= 70 else "Distinctive"),
        "earSize": f"{avg_ear_size:.2f}",
        "earSizeClass": ear_size_class,
        "earSymmetry": ear_symmetry,
        "sizeDifference": f"{size_diff:.1f}",
        "protrusion": protrusion,
        "earProtrusion": f"{avg_ear_z:.3f}",
        "earPosition": ear_vert_pos,
        "explanation": (
            f"The subject's ears are {ear_size_class.lower()} ({avg_ear_size:.2f}× IPD) and "
            f"{ear_symmetry.lower()} (diff: {size_diff:.1f}%). Protrusion is {protrusion.lower()} "
            f"with {ear_vert_pos.lower()} positioning. "
            f"{'Ear proportions contribute to harmonious facial framing.' if ear_size_class == 'Balanced' else 'Ear prominence affects the overall silhouette.'}"
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Skin Quality Metrics (pixel-based)
# ══════════════════════════════════════════════════════════════════════════════

def skin_quality_metrics(landmarks: list, image_bytes: bytes, metrics: Optional[dict] = None) -> dict:
    """LAB + skin-mask Qoves metrics (notebook-aligned)."""
    analysis = analyze_skin_lab(image_bytes, landmarks)

    undertone = analysis.get("undertone") or "Neutral"
    blemishing = analysis.get("blemishing") or "Clear"
    evenness = analysis.get("evenness") or "Even"
    texture = analysis.get("texture") or "Smooth"
    oiliness = analysis.get("oiliness") or "Normal/Combination"
    dark_circles = analysis.get("darkCircles") or "Not Prominent"
    roughness_rin = float(analysis.get("roughnessRin") or 0.08)
    homogeneity_rin = float(analysis.get("homogeneityRin") or 0.15)
    oiliness_skew = float(analysis.get("oilinessSkew") or 0.0)
    mean_a = float(analysis.get("meanRednessA") or 128.0)
    face_l = float(analysis.get("faceLuminance") or 0.0)
    under_eye_l = float(analysis.get("underEyeLuminance") or 0.0)
    blemish_count = int(analysis.get("blemishCount") or 0)

    score = 70
    if blemishing == "Clear":
        score += 8
    elif blemishing == "Mild":
        score += 2
    elif blemishing == "Moderate":
        score -= 5
    else:
        score -= 10
    if evenness == "Even":
        score += 8
    elif evenness == "Slightly Uneven":
        score += 2
    else:
        score -= 5
    if texture == "Smooth":
        score += 5
    elif texture == "Textured/Rough":
        score -= 5
    if dark_circles == "Not Prominent":
        score += 3
    else:
        score -= 5
    if oiliness == "Oily/Shiny":
        score -= 2
    else:
        score += 2
    if metrics and metrics.get("quality"):
        q = _safe_num(metrics["quality"])
        if q > 0:
            score = round(score * 0.6 + q * 0.4)
    score = min(99, max(45, int(score)))

    return {
        "score": score,
        "scoreLabel": "Clear" if score >= 85 else ("Good condition" if score >= 70 else "Needs attention"),
        "undertone": undertone,
        "blemishing": blemishing,
        "blemishCount": blemish_count,
        "evenness": evenness,
        "texture": texture,
        "oiliness": oiliness,
        "darkCircles": dark_circles,
        "roughnessRin": roughness_rin,
        "homogeneityRin": homogeneity_rin,
        "oilinessSkew": oiliness_skew,
        "meanRednessA": mean_a,
        "faceLuminance": face_l,
        "underEyeLuminance": under_eye_l,
        # Compat aliases for narratives / visual generation / older UI
        "skinTone": analysis.get("skinTone") or "Medium",
        "tone": evenness,
        "clarity": "Good" if blemishing in ("Clear", "Mild") else "Needs attention",
        "redness": "Normal" if mean_a < 140 else ("Mild redness" if mean_a < 150 else "Moderate redness"),
        "brightness": _safe_fixed(face_l, 0),
        "underEyeHealth": analysis.get("underEyeHealth") or "Good",
        "underEyeBrightness": _safe_fixed(under_eye_l, 0),
        "poreEstimate": oiliness,
        "pigmentation": evenness,
        "regions": [],
        "explanation": (
            f"Undertone {undertone}; texture {texture} ({roughness_rin:.2f} RIN); "
            f"evenness {evenness} ({homogeneity_rin:.2f} RIN); "
            f"blemishing {blemishing} ({blemish_count} spots); "
            f"oiliness {oiliness} (skew {oiliness_skew:.2f}). "
            f"Dark circles: {dark_circles}."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Dimorphism Metrics
# ══════════════════════════════════════════════════════════════════════════════

def dimorphism_metrics(
    landmarks: list,
    metrics: Optional[dict] = None,
    answers: Optional[dict] = None,
) -> dict:
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    cheek_l = lm(landmarks, 127)
    cheek_r = lm(landmarks, 356)
    nose_tip = lm(landmarks, 1)
    nose_bridge = lm(landmarks, 6)
    mouth_l = lm(landmarks, 61)
    mouth_r = lm(landmarks, 291)
    upper_lip = lm(landmarks, 13)
    lower_lip = lm(landmarks, 14)
    lb = lm(landmarks, 105)
    rb = lm(landmarks, 334)
    r_inner = lm(landmarks, 70)
    l_inner = lm(landmarks, 300)
    eye_l = lm(landmarks, 33)
    eye_r = lm(landmarks, 263)
    ipd = dist_landmarks(eye_l, eye_r) or 0.001
    face_h = chin["y"] - forehead["y"] or 0.3
    face_w = abs(jaw_r["x"] - jaw_l["x"]) or 0.3
    cheek_w = abs(cheek_r["x"] - cheek_l["x"]) or 0.3

    def score_feature(masculine_score: int) -> tuple:
        clamped = max(0, min(100, masculine_score))
        label = (
            "Very Masculine" if clamped >= 80 else ("Masculine" if clamped >= 60
            else ("Moderate" if clamped >= 40 else ("Feminine" if clamped >= 20 else "Very Feminine")))
        )
        return clamped, label

    # Eyebrows
    brow_eye_gap = ((eye_l["y"] - lb["y"]) + (eye_r["y"] - rb["y"])) / 2 / face_h
    r_top = lm(landmarks, 107)
    r_bot = lm(landmarks, 52)
    l_top = lm(landmarks, 336)
    l_bot = lm(landmarks, 282)
    brow_thickness = ((dist_landmarks(r_top, r_bot) + dist_landmarks(l_top, l_bot)) / 2) / face_h
    brow_arch = ((r_top["y"] - lb["y"]) + (l_top["y"] - rb["y"])) / 2
    brow_score = 50
    brow_score += (15 if brow_thickness > 0.07 else (5 if brow_thickness > 0.045 else -10))
    brow_score += (12 if brow_eye_gap < 0.1 else (-10 if brow_eye_gap > 0.16 else 0))
    brow_score += (10 if abs(brow_arch) < 0.005 else -5)
    eyebrows_s, eyebrows_l = score_feature(brow_score)

    # Nose
    nose_w = dist_landmarks(lm(landmarks, 48), lm(landmarks, 278))
    nose_h = dist_landmarks(nose_bridge, nose_tip)
    nose_ratio = nose_w / (nose_h or 0.001)
    nose_face_ratio = nose_w / ipd
    nose_score = 50
    nose_score += (15 if nose_face_ratio > 0.45 else (5 if nose_face_ratio > 0.35 else -10))
    nose_score += (10 if nose_ratio > 0.8 else (0 if nose_ratio > 0.6 else -8))
    nose_s, nose_l = score_feature(nose_score)

    # Cheeks
    cheek_prominence = ((cheek_l.get("z", 0)) + (cheek_r.get("z", 0))) / 2
    cheek_width_ratio = cheek_w / face_w
    cheek_score = 50
    cheek_score += (8 if cheek_width_ratio > 0.85 else (-5 if cheek_width_ratio < 0.7 else 0))
    cheek_score += (-10 if cheek_prominence > 0.02 else (8 if cheek_prominence < -0.01 else 0))
    cheeks_s, cheeks_l = score_feature(cheek_score)

    # Lips
    lip_fullness = dist_landmarks(upper_lip, lm(landmarks, 0)) + dist_landmarks(lower_lip, lm(landmarks, 17))
    lip_fullness_ratio = lip_fullness / ipd
    philtrum_r = dist_landmarks(nose_tip, upper_lip)
    philtrum_ratio = philtrum_r / (lip_fullness or 0.001)
    lip_score = 50
    lip_score += (-12 if lip_fullness_ratio > 0.18 else (-4 if lip_fullness_ratio > 0.12 else 8))
    lip_score += (8 if philtrum_ratio > 1.5 else (-5 if philtrum_ratio < 1 else 0))
    lips_s, lips_l = score_feature(lip_score)

    # Jaw
    jaw_width = abs(jaw_r["x"] - jaw_l["x"])
    jaw_width_ratio = jaw_width / face_w
    angle_l = abs(math.atan2(chin["y"] - jaw_l["y"], chin["x"] - jaw_l["x"]) * 180 / math.pi)
    angle_r = abs(math.atan2(chin["y"] - jaw_r["y"], chin["x"] - jaw_r["x"]) * 180 / math.pi)
    jaw_angle = (angle_l + angle_r) / 2
    jaw_score = 50
    jaw_score += (15 if jaw_width_ratio > 0.92 else (5 if jaw_width_ratio > 0.8 else -8))
    jaw_score += (10 if jaw_angle < 130 else (-5 if jaw_angle > 150 else 0))
    jaw_s, jaw_l_label = score_feature(jaw_score)

    # Chin
    chin_w = dist_landmarks(lm(landmarks, 148), lm(landmarks, 377))
    chin_width_ratio = chin_w / face_w
    chin_height = dist_landmarks(chin, lower_lip)
    chin_height_ratio = chin_height / face_h
    chin_score = 50
    chin_score += (12 if chin_width_ratio > 0.55 else (-8 if chin_width_ratio < 0.35 else 0))
    chin_score += (8 if chin_height_ratio > 0.1 else (-5 if chin_height_ratio < 0.06 else 0))
    chin_feature_s, chin_feature_l = score_feature(chin_score)

    # Neck
    neck_width_ratio = dist_landmarks(jaw_l, jaw_r) / ipd
    neck_score = 50
    neck_score += (12 if neck_width_ratio > 3 else (4 if neck_width_ratio > 2.5 else -8))
    neck_s, neck_l = score_feature(neck_score)

    # Eyes
    eye_span = dist_landmarks(eye_l, eye_r) / face_w
    eye_open_l = dist_landmarks(lm(landmarks, 159), lm(landmarks, 145))
    eye_open_r = dist_landmarks(lm(landmarks, 386), lm(landmarks, 374))
    eye_open_ratio = ((eye_open_l + eye_open_r) / 2) / ipd
    eye_score = 50
    eye_score += (-12 if eye_open_ratio > 0.2 else (8 if eye_open_ratio < 0.12 else 0))
    eye_score += (-8 if eye_span > 0.42 else (6 if eye_span < 0.32 else 0))
    eyes_s, eyes_l = score_feature(eye_score)

    # Ears
    ear_lm_l = lm(landmarks, 234)
    ear_lm_r = lm(landmarks, 454)
    ear_size = ((dist_landmarks(ear_lm_l, eye_l) + dist_landmarks(ear_lm_r, eye_r)) / 2) / ipd
    ear_protrusion = (abs(ear_lm_l.get("z", 0)) + abs(ear_lm_r.get("z", 0))) / 2
    ear_score = 50
    ear_score += (10 if ear_size > 1.2 else (-8 if ear_size < 0.8 else 0))
    ear_score += (6 if ear_protrusion > 0.06 else -4)
    ears_s, ears_l = score_feature(ear_score)

    all_scores = [eyebrows_s, nose_s, cheeks_s, lips_s, jaw_s, chin_feature_s, neck_s, eyes_s, ears_s]
    weights = [1.2, 1.1, 0.8, 1.0, 1.3, 1.1, 0.7, 0.9, 0.6]
    weighted_sum = sum(s * w for s, w in zip(all_scores, weights))
    weight_total = sum(weights)
    overall_raw = round(weighted_sum / weight_total)

    from .visual_style_banks import resolve_style_preference
    preference = resolve_style_preference(answers)

    def display_for(raw: int) -> tuple[int, str, bool]:
        """Clamp display score/label to Moderate or preferred side."""
        if preference == "feminine":
            opposite = raw >= 60
            disp = min(raw, 59)
        elif preference == "masculine":
            opposite = raw < 40
            disp = max(raw, 40)
        else:
            disp, label = score_feature(raw)
            return disp, label, False
        disp, label = score_feature(disp)
        return disp, label, opposite

    def improve_note(feature_name: str, opposite: bool) -> str:
        if not opposite:
            return ""
        if preference == "feminine":
            return (
                f" Room for improvement toward a softer, more feminine "
                f"{feature_name.lower()} presentation."
            )
        return (
            f" Room for improvement toward a stronger, more masculine "
            f"{feature_name.lower()} presentation."
        )

    brow_set = "low-set" if brow_eye_gap < 0.1 else ("higher-set" if brow_eye_gap > 0.16 else "moderately set")
    brow_form = "straighter" if abs(brow_arch) < 0.005 else "more arched"
    cheek_note = (
        ", more projected cheekbones" if cheek_prominence > 0.02
        else (", flatter midface depth" if cheek_prominence < -0.01 else "")
    )
    ear_note = ", with more lateral protrusion" if ear_protrusion > 0.06 else ""

    eyebrows_d, eyebrows_l, eyebrows_opp = display_for(eyebrows_s)
    eyes_d, eyes_l, eyes_opp = display_for(eyes_s)
    nose_d, nose_l, nose_opp = display_for(nose_s)
    cheeks_d, cheeks_l, cheeks_opp = display_for(cheeks_s)
    lips_d, lips_l, lips_opp = display_for(lips_s)
    jaw_d, jaw_l_label, jaw_opp = display_for(jaw_s)
    chin_d, chin_feature_l, chin_opp = display_for(chin_feature_s)
    neck_d, neck_l, neck_opp = display_for(neck_s)
    ears_d, ears_l, ears_opp = display_for(ears_s)

    features = [
        {
            "name": "Eyebrows", "score": eyebrows_d, "label": eyebrows_l,
            "explanation": (
                f"Your brows score {eyebrows_d} ({eyebrows_l.lower()}): "
                f"{brow_set}, {brow_form}, relative thickness {brow_thickness * 100:.1f}% of face height."
                + improve_note("Eyebrows", eyebrows_opp)
            ),
        },
        {
            "name": "Eyes", "score": eyes_d, "label": eyes_l,
            "explanation": (
                f"Your eyes score {eyes_d} ({eyes_l.lower()}): "
                f"aperture {eye_open_ratio * 100:.1f}% of IPD, span {eye_span * 100:.1f}% of face width."
                + improve_note("Eyes", eyes_opp)
            ),
        },
        {
            "name": "Nose", "score": nose_d, "label": nose_l,
            "explanation": (
                f"Your nose scores {nose_d} ({nose_l.lower()}): "
                f"alar width {nose_face_ratio * 100:.1f}% of IPD, width-to-length {nose_ratio:.2f}."
                + improve_note("Nose", nose_opp)
            ),
        },
        {
            "name": "Cheeks", "score": cheeks_d, "label": cheeks_l,
            "explanation": (
                f"Your cheeks score {cheeks_d} ({cheeks_l.lower()}): "
                f"cheek width {cheek_width_ratio * 100:.1f}% of face width{cheek_note}."
                + improve_note("Cheeks", cheeks_opp)
            ),
        },
        {
            "name": "Lips", "score": lips_d, "label": lips_l,
            "explanation": (
                f"Your lips score {lips_d} ({lips_l.lower()}): "
                f"fullness {lip_fullness_ratio * 100:.1f}% of IPD, philtrum-to-lip {philtrum_ratio:.2f}."
                + improve_note("Lips", lips_opp)
            ),
        },
        {
            "name": "Jaw", "score": jaw_d, "label": jaw_l_label,
            "explanation": (
                f"Your jaw scores {jaw_d} ({jaw_l_label.lower()}): "
                f"width {jaw_width_ratio * 100:.1f}% of face width, mean mandibular angle {jaw_angle:.0f}°."
                + improve_note("Jaw", jaw_opp)
            ),
        },
        {
            "name": "Chin", "score": chin_d, "label": chin_feature_l,
            "explanation": (
                f"Your chin scores {chin_d} ({chin_feature_l.lower()}): "
                f"width {chin_width_ratio * 100:.1f}% of face width, "
                f"height {chin_height_ratio * 100:.1f}% of face height."
                + improve_note("Chin", chin_opp)
            ),
        },
        {
            "name": "Neck", "score": neck_d, "label": neck_l,
            "explanation": (
                f"Your neck scores {neck_d} ({neck_l.lower()}): "
                f"breadth {neck_width_ratio:.2f}× IPD from the jaw landmarks."
                + improve_note("Neck", neck_opp)
            ),
        },
        {
            "name": "Ears", "score": ears_d, "label": ears_l,
            "explanation": (
                f"Your ears score {ears_d} ({ears_l.lower()}): "
                f"relative size {ear_size:.2f}× IPD{ear_note}."
                + improve_note("Ears", ears_opp)
            ),
        },
    ]

    overall_score, overall_label, overall_opp = display_for(overall_raw)

    top_drivers = sorted(features, key=lambda f: abs(f["score"] - 50), reverse=True)[:3]
    top_clause = ", ".join(
        f"{f['name'].lower()} ({f['label'].lower()}, {f['score']})" for f in top_drivers
    )

    overall_explanation = (
        f"Your overall dimorphism reads as {overall_label.lower()} ({overall_score}/100). "
        f"The strongest measured drivers are {top_clause}."
    )
    if overall_opp:
        overall_explanation += improve_note("overall dimorphism", True)

    return {
        "overallScore": overall_score,
        "overallLabel": overall_label,
        "scaleLeft": "Hyper Feminine",
        "scaleRight": "Hyper Masculine",
        "explanation": overall_explanation,
        "features": features,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Averageness Metrics
# ══════════════════════════════════════════════════════════════════════════════

def averageness_metrics(landmarks: list, metrics: Optional[dict] = None, answers: Optional[dict] = None) -> dict:
    from .prototypicality import compute_prototypicality_report
    return compute_prototypicality_report(landmarks, metrics, answers)


# ══════════════════════════════════════════════════════════════════════════════
# Symmetry Score
# ══════════════════════════════════════════════════════════════════════════════

SYMMETRY_MIRROR_PAIRS = [
    (33, 263), (133, 362), (61, 291), (105, 334),
    (159, 386), (145, 374), (234, 454), (127, 356),
]

SYMMETRY_REGION_DEFS = [
    ("eyes", "Eyes", [(33, 263), (133, 362), (159, 386), (145, 374)]),
    ("brows", "Brows", [(105, 334)]),
    ("mouth", "Mouth", [(61, 291)]),
    ("jaw", "Jaw", [(234, 454), (127, 356)]),
]


def _pair_deviation_pct(landmarks: list, li: int, ri: int, nose: dict, face_h: float) -> float:
    l_pt = lm(landmarks, li)
    r_pt = lm(landmarks, ri)
    x_mir = abs(abs(l_pt["x"] - nose["x"]) - abs(r_pt["x"] - nose["x"])) / face_h * 100
    y_mir = abs(l_pt["y"] - r_pt["y"]) / face_h * 100
    z_mir = abs(abs(l_pt.get("z", 0)) - abs(r_pt.get("z", 0))) * 100
    return x_mir * 0.55 + y_mir * 0.30 + z_mir * 0.15


def _score_from_avg_dev(avg_dev: float) -> int:
    """Liberal mapping: typical faces a few points higher; still not inflated to 90+."""
    return max(55, min(97, round(92 - avg_dev * 7.5)))


def symmetry_score(landmarks: list, metrics: Optional[dict] = None) -> int:
    """Qoves-calibrated left–right balance (typical faces ~76–86, not inflated 90+)."""
    if not landmarks:
        return 70

    nose = lm(landmarks, 1)
    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    face_h = max(chin["y"] - forehead["y"], 0.2)

    deviations_pct = [
        _pair_deviation_pct(landmarks, li, ri, nose, face_h)
        for li, ri in SYMMETRY_MIRROR_PAIRS
    ]
    avg_dev = sum(deviations_pct) / len(deviations_pct)
    return _score_from_avg_dev(avg_dev)


def symmetry_regions(landmarks: list) -> list:
    """Per-region L/R imbalance from the same scoring pairs (Eyes/Brows/Mouth/Jaw)."""
    if not landmarks:
        return []

    nose = lm(landmarks, 1)
    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    face_h = max(chin["y"] - forehead["y"], 0.2)

    regions = []
    for region_id, label, pairs in SYMMETRY_REGION_DEFS:
        deviations = [
            _pair_deviation_pct(landmarks, li, ri, nose, face_h)
            for li, ri in pairs
        ]
        avg_dev = sum(deviations) / len(deviations)
        regions.append({
            "id": region_id,
            "label": label,
            "avgDev": round(avg_dev, 2),
            "score": _score_from_avg_dev(avg_dev),
        })
    return regions


def symmetry_label(score: int) -> str:
    if score >= 85:
        return "Highly Symmetric"
    if score >= 74:
        return "Quite Symmetric"
    if score >= 64:
        return "Balanced"
    return "Noticeable asymmetry"


def symmetry_explanation(score: int, label: str, regions: Optional[list] = None) -> str:
    regions = regions or []
    region_clause = ""
    if regions:
        sorted_regions = sorted(regions, key=lambda r: r.get("score", 0))
        weakest = sorted_regions[0]
        strongest = sorted_regions[-1]
        if weakest.get("score", 100) < 74:
            region_clause = (
                f" The largest measured left–right difference is in the {weakest['label'].lower()} "
                f"({weakest['score']}), while {strongest['label'].lower()} is more even ({strongest['score']})."
            )
        else:
            names = ", ".join(r["label"].lower() for r in regions)
            region_clause = (
                f" Regional balance is fairly even across {names} "
                f"(lowest {weakest['label'].lower()} at {weakest['score']})."
            )
    return (
        f"Your facial symmetry score is {score} ({label.lower()})."
        f"{region_clause} "
        "Natural faces almost always show some left–right variation."
    )


# ══════════════════════════════════════════════════════════════════════════════
# Proportions
# ══════════════════════════════════════════════════════════════════════════════

def proportions_from_landmarks(landmarks: list, metrics: Optional[dict] = None) -> dict:
    """Facial thirds from the same landmarks as the proportion overlay (not mouth-based metrics)."""
    if not landmarks:
        return {
            "score": None,
            "upperThird": None,
            "middleThird": None,
            "lowerThird": None,
            "label": None,
            "explanation": "Facial thirds could not be measured from landmarks.",
        }

    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    subnasale = lm(landmarks, 2)
    brow_y = (lm(landmarks, 105)["y"] + lm(landmarks, 334)["y"]) / 2
    face_h = chin["y"] - forehead["y"]
    if face_h <= 0.05:
        return {
            "score": None,
            "upperThird": None,
            "middleThird": None,
            "lowerThird": None,
            "label": None,
            "explanation": "Facial thirds could not be measured from landmarks.",
        }

    upper = (brow_y - forehead["y"]) / face_h
    middle = (subnasale["y"] - brow_y) / face_h
    lower = (chin["y"] - subnasale["y"]) / face_h
    total = upper + middle + lower
    if total > 0.01:
        upper /= total
        middle /= total
        lower /= total

    ideal_dev = abs(upper - 0.33) + abs(middle - 0.34) + abs(lower - 0.33)
    score = min(99, max(40, round(100 - ideal_dev * 120)))

    if upper < 0.28 and lower > 0.36:
        thirds_explanation = (
            f"Your shorter forehead with a taller midface and especially long mouth-to-chin area "
            f"(upper {upper:.2f}, middle {middle:.2f}, lower {lower:.2f}) shifts visual weight downward, "
            "which gives your features a strong central and lower focus compared with standard references "
            "for faces similar to yours."
        )
    elif upper > 0.36 and lower < 0.30:
        thirds_explanation = (
            f"Your taller forehead with a shorter lower third "
            f"(upper {upper:.2f}, middle {middle:.2f}, lower {lower:.2f}) shifts visual weight upward, "
            "so the upper face carries more presence than typical reference proportions."
        )
    elif abs(upper - middle) < 0.04 and abs(middle - lower) < 0.04:
        thirds_explanation = (
            f"Your facial thirds are closely balanced "
            f"(upper {upper:.2f}, middle {middle:.2f}, lower {lower:.2f}), "
            "so visual weight is distributed evenly from forehead through chin."
        )
    else:
        focus = "upper" if upper >= middle and upper >= lower else ("middle" if middle >= lower else "lower")
        thirds_explanation = (
            f"Your facial thirds measure upper {upper:.2f}, middle {middle:.2f}, and lower {lower:.2f}, "
            f"so visual weight leans toward the {focus} third compared with evenly split references."
        )

    return {
        "score": score,
        "upperThird": f"{upper:.2f}",
        "middleThird": f"{middle:.2f}",
        "lowerThird": f"{lower:.2f}",
        "label": "Well balanced" if score >= 80 else ("Good balance" if score >= 70 else "Slight variation"),
        "explanation": thirds_explanation,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Face Shape (8-point polygon + ellipse; notebook classification)
# ══════════════════════════════════════════════════════════════════════════════

# Right side = person's right (viewer left). Order for closed octagon.
_FACE_SHAPE_POINT_IDS = (
    10,   # Top (glabella / forehead)
    103,  # Right temple
    234,  # Right cheekbone / jaw front
    132,  # Right jaw
    152,  # Chin
    361,  # Left jaw
    454,  # Left cheekbone
    332,  # Left temple
)


def _face_shape_pt_px(landmarks: list, idx: int, w: float, h: float) -> np.ndarray:
    p = lm(landmarks, idx)
    return np.array([float(p["x"]) * w, float(p["y"]) * h], dtype=np.float64)


def face_shape_from_landmarks(
    landmarks: list,
    image_size: Optional[tuple[int, int]] = None,
) -> dict:
    """Classify face shape from MediaPipe mesh using the 8-point facial polygon.

    Port of face_shape_analysis.ipynb: forehead expansion, length/forehead/jaw
    ratios vs midface (cheekbone) width, and Oval/Square/Heart/Round/Oblong tree.
    Overlay coords are full-image percentage space (0–100), same as symmetry dots.
    """
    if not landmarks:
        return {
            "shape": "Oval",
            "facialLength": "Average",
            "foreheadWidth": "Normal",
            "midfaceWidth": "Normal",
            "lowerThirdWidth": "Normal",
            "explanation": "Face shape could not be measured from landmarks.",
            "overlay": None,
            "overlaySpace": "image",
        }

    if image_size and image_size[0] > 0 and image_size[1] > 0:
        w, h = float(image_size[0]), float(image_size[1])
    else:
        # Aspect-neutral fallback (unit square) when pixel size unknown
        w, h = 1.0, 1.0

    p_top = _face_shape_pt_px(landmarks, 10, w, h)
    p_chin = _face_shape_pt_px(landmarks, 152, w, h)
    p_rt = _face_shape_pt_px(landmarks, 103, w, h)
    p_lt = _face_shape_pt_px(landmarks, 332, w, h)
    p_rc = _face_shape_pt_px(landmarks, 234, w, h)
    p_lc = _face_shape_pt_px(landmarks, 454, w, h)
    p_rj = _face_shape_pt_px(landmarks, 132, w, h)
    p_lj = _face_shape_pt_px(landmarks, 361, w, h)

    # Synthetic forehead expansion — mesh sits below the hairline
    nasion = _face_shape_pt_px(landmarks, 9, w, h)
    core_height = float(np.linalg.norm(p_chin - nasion)) or float(h * 0.35)
    p_top = p_top.copy()
    p_rt = p_rt.copy()
    p_lt = p_lt.copy()
    p_top[1] -= core_height * 0.15
    p_rt[1] -= core_height * 0.10
    p_rt[0] -= core_height * 0.015
    p_lt[1] -= core_height * 0.10
    p_lt[0] += core_height * 0.015

    facial_length = float(np.linalg.norm(p_top - p_chin))
    midface_width = float(np.linalg.norm(p_rc - p_lc)) or 1e-6
    forehead_width = float(np.linalg.norm(p_rt - p_lt))
    jaw_width = float(np.linalg.norm(p_rj - p_lj))

    ratio = facial_length / midface_width
    if ratio > 1.45:
        length = "Long"
    elif ratio < 1.25:
        length = "Short"
    else:
        length = "Average"

    fh_ratio = forehead_width / midface_width
    if fh_ratio > 0.85:
        forehead = "Wide"
    elif fh_ratio < 0.75:
        forehead = "Narrow"
    else:
        forehead = "Normal"

    jaw_ratio = jaw_width / midface_width
    if jaw_ratio > 0.85:
        lower_third = "Wide"
    elif jaw_ratio < 0.75:
        lower_third = "Narrow"
    else:
        lower_third = "Normal"

    mid_relative = midface_width / (((forehead_width + jaw_width) / 2) or 1e-6)
    if mid_relative > 1.1:
        midface = "Wide"
    elif mid_relative < 0.92:
        midface = "Narrow"
    else:
        midface = "Normal"

    shape = "Oval"
    if length == "Average":
        if lower_third == "Wide" and forehead == "Wide":
            shape = "Square"
        elif lower_third == "Narrow":
            shape = "Heart"
        elif forehead == "Narrow" and lower_third == "Normal":
            shape = "Round"
        else:
            shape = "Oval"
    elif length == "Short":
        shape = "Square" if lower_third == "Wide" else "Round"
    elif length == "Long":
        shape = "Oblong" if forehead == "Wide" and lower_third == "Wide" else "Oval"

    pts_px = [p_top, p_rt, p_rc, p_rj, p_chin, p_lj, p_lc, p_lt]
    box_w = float(np.linalg.norm(pts_px[2] - pts_px[6]))
    box_h = float(np.linalg.norm(pts_px[0] - pts_px[4]))
    center = (
        (pts_px[0][0] + pts_px[4][0]) / 2.0,
        (pts_px[0][1] + pts_px[4][1]) / 2.0,
    )

    def _to_pct(p: np.ndarray) -> dict:
        return {"x": round(float(p[0]) / w * 100, 2), "y": round(float(p[1]) / h * 100, 2)}

    polygon = [_to_pct(p) for p in pts_px]
    overlay = {
        "polygon": polygon,
        "ellipse": {
            "cx": round(center[0] / w * 100, 2),
            "cy": round(center[1] / h * 100, 2),
            "rx": round((box_w / 2.0) / w * 100, 2),
            "ry": round((box_h / 2.0) / h * 100, 2),
        },
        "crossV": [_to_pct(pts_px[0]), _to_pct(pts_px[4])],
        "crossH": [_to_pct(pts_px[2]), _to_pct(pts_px[6])],
    }

    # Legacy W/H ratio (kept for Face Shape cards)
    forehead_lm = lm(landmarks, 10)
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    chin_lm = lm(landmarks, 152)
    face_w = abs(jaw_r["x"] - jaw_l["x"])
    face_h = max(chin_lm["y"] - forehead_lm["y"], 1e-3)
    wh_ratio = face_w / face_h

    explanation = (
        f"Your face is classified as {shape.lower()} based on an 8-point facial outline "
        f"(facial length {length.lower()}, forehead {forehead.lower()}, "
        f"midface {midface.lower()} relative to brow/jaw width, "
        f"and lower third {lower_third.lower()}; length-to-midface ratio {ratio:.2f}). "
        f"The outline and ellipse show how temples, cheekbones, and jaw frame that shape."
    )

    return {
        "shape": shape,
        "facialLength": length,
        "foreheadWidth": forehead,
        "midfaceWidth": midface,
        "lowerThirdWidth": lower_third,
        "lengthToMidfaceRatio": f"{ratio:.2f}",
        "widthHeightRatio": f"{wh_ratio:.2f}",
        "explanation": explanation,
        "overlay": overlay,
        "overlaySpace": "image",
        "_ptsPx": [[float(p[0]), float(p[1])] for p in pts_px],
        "_imageSize": [int(w), int(h)],
    }


def _draw_dashed_line_cv(img: np.ndarray, pt1, pt2, color, thickness: int, gap: int = 10) -> None:
    p1 = np.array(pt1, dtype=np.float64)
    p2 = np.array(pt2, dtype=np.float64)
    dist = float(np.linalg.norm(p2 - p1))
    pts_n = int(dist / max(gap, 1))
    if pts_n < 2:
        cv2.line(
            img,
            (int(p1[0]), int(p1[1])),
            (int(p2[0]), int(p2[1])),
            color,
            thickness,
            cv2.LINE_AA,
        )
        return
    for i in range(pts_n):
        if i % 2 != 0:
            continue
        start = p1 + (p2 - p1) * (i / pts_n)
        end = p1 + (p2 - p1) * ((i + 1) / pts_n)
        cv2.line(
            img,
            (int(start[0]), int(start[1])),
            (int(end[0]), int(end[1])),
            color,
            thickness,
            cv2.LINE_AA,
        )


def render_face_shape_overlay_image(image_bytes: bytes, face_shape: dict) -> Optional[bytes]:
    """Bake notebook-style octagon + ellipse + dashed crosshairs onto the front photo."""
    pts = face_shape.get("_ptsPx")
    size = face_shape.get("_imageSize")
    if not pts or not size or len(pts) < 8:
        return None
    arr = np.frombuffer(image_bytes, np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        return None
    h, w = bgr.shape[:2]
    # Upscale for smooth AA (notebook approach)
    target_h = max(h, 1200)
    upscale = target_h / h if h else 1.0
    if upscale > 1.0:
        target_w = int(w * upscale)
        img = cv2.resize(bgr, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
    else:
        img = bgr.copy()
        upscale = 1.0
    scale = (img.shape[0] / 800.0) if img.shape[0] else 1.0
    pts_u = [np.array([p[0] * upscale, p[1] * upscale], dtype=np.float64) for p in pts]
    color = (255, 255, 255)
    thick = max(1, int(1.5 * scale))
    dash_thick = max(1, int(1.2 * scale))
    gap = max(4, int(10 * scale))

    cv_pts = np.array([[int(p[0]), int(p[1])] for p in pts_u], np.int32).reshape((-1, 1, 2))
    cv2.polylines(img, [cv_pts], isClosed=True, color=color, thickness=thick, lineType=cv2.LINE_AA)

    box_w = float(np.linalg.norm(pts_u[2] - pts_u[6]))
    box_h = float(np.linalg.norm(pts_u[0] - pts_u[4]))
    center = (
        int((pts_u[0][0] + pts_u[4][0]) / 2),
        int((pts_u[0][1] + pts_u[4][1]) / 2),
    )
    axes = (max(1, int(box_w / 2)), max(1, int(box_h / 2)))
    cv2.ellipse(img, center, axes, 0, 0, 360, color, thick, cv2.LINE_AA)

    _draw_dashed_line_cv(img, pts_u[0], pts_u[4], color, dash_thick, gap=gap)
    _draw_dashed_line_cv(img, pts_u[2], pts_u[6], color, dash_thick, gap=gap)

    # Downscale back to original size for storage
    if upscale > 1.0:
        img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    if not ok:
        return None
    return buf.tobytes()


def _strip_face_shape_private(face_shape: dict) -> dict:
    out = {k: v for k, v in face_shape.items() if not str(k).startswith("_")}
    return out


# ══════════════════════════════════════════════════════════════════════════════
# Proportion Ratios
# ══════════════════════════════════════════════════════════════════════════════

def proportion_ratios(landmarks: list) -> dict:
    nose_tip = lm(landmarks, 1)
    nose_base_l, nose_base_r = nose_alae(landmarks)
    # Correct canthi: 133/362 inner, 33/263 outer
    eye_inner_l = lm(landmarks, 133)
    eye_inner_r = lm(landmarks, 362)
    eye_outer_l = lm(landmarks, 33)
    eye_outer_r = lm(landmarks, 263)
    mouth_l, mouth_r = mouth_cheilions(landmarks)
    ear_top_l = lm(landmarks, 234)
    ear_bot_l = lm(landmarks, 127)

    # Front-view ear span is NOT valid for naso-aural — profile photo required (enriched later).
    ear_height = abs(ear_bot_l["y"] - ear_top_l["y"])
    nose_height = abs(nose_tip["y"] - lm(landmarks, 2)["y"])
    nose_width = abs(nose_base_r["x"] - nose_base_l["x"])
    eye_width_l = abs(eye_outer_l["x"] - eye_inner_l["x"])
    eye_width_r = abs(eye_outer_r["x"] - eye_inner_r["x"])
    eye_width = (eye_width_l + eye_width_r) / 2
    inner_eye_spacing = abs(eye_inner_r["x"] - eye_inner_l["x"])
    mouth_width = abs(mouth_r["x"] - mouth_l["x"])

    naso_aural_your = ear_height / (nose_height or 0.001)
    orbito_nasal_your = nose_width / (inner_eye_spacing or 0.001)
    naso_oral_your = mouth_width / (nose_width or 0.001)
    # Qoves orbital: inter-eye spacing vs single eye width (ideal ≈ 1.00)
    orbital_your = inner_eye_spacing / (eye_width or 0.001)

    return {
        "nasoAural": {
            "ratioLabel": "NASO-AURAL RATIO",
            "yourValue": round(naso_aural_your, 2),
            "idealValue": 1.0,
            "yourLabel": f"{'Ear > Nose' if naso_aural_your > 1.05 else ('Ear < Nose' if naso_aural_your < 0.95 else 'Ear ≈ Nose')}",
            "idealLabel": "Ear = Nose",
            "expectation": "Generally, the ears are expected to be roughly the same height as the nose.",
            "explanation": (
                "Upload a side-profile photo for an accurate naso-aural measurement. "
                "Front-facing estimates are not clinically meaningful for this ratio."
            ),
            "dataSource": "front_estimate",
            "requiresProfile": True,
        },
        "orbitoNasal": {
            "ratioLabel": "ORBITO-NASAL RATIO",
            "yourValue": round(orbito_nasal_your, 2),
            "idealValue": 1.0,
            "yourLabel": f"{'Nose > Eye' if orbito_nasal_your > 1.05 else ('Nose < Eye' if orbito_nasal_your < 0.95 else 'Nose ≈ Eye')}",
            "idealLabel": "Nose = Eye",
            "expectation": "Generally, the outer edges of the nostrils are expected to align with the inner corners of the eyes.",
            "explanation": (
                f"Your orbito-nasal ratio is {orbito_nasal_your:.2f} (reference ≈ 1.00). "
                + (
                    "The nasal base is wider than inner-eye spacing, so the central column reads broader."
                    if orbito_nasal_your > 1.1
                    else "The nasal base is narrower than inner-eye spacing, so the central column reads more refined."
                    if orbito_nasal_your < 0.9
                    else "Nose width aligns closely with inner-eye spacing."
                )
            ),
        },
        "nasoOral": {
            "ratioLabel": "NASO-ORAL PROPORTION",
            "yourValue": round(naso_oral_your, 2),
            "idealValue": 1.6,
            # Label = mouth vs nose (ratio vs 1), NOT vs the 1.6 ideal
            "yourLabel": f"{'Mouth > Nose' if naso_oral_your > 1.05 else ('Mouth < Nose' if naso_oral_your < 0.95 else 'Mouth ≈ Nose')}",
            "idealLabel": "Mouth > Nose",
            "expectation": "Generally, the width of the mouth is expected to be about 50–60% wider than the width of the nasal base.",
            "explanation": (
                f"Your mouth-to-nose ratio is {naso_oral_your:.2f} (reference ≈ 1.60). "
                + (
                    "Mouth width is relatively contained versus the nasal base, so emphasis stays on the nose."
                    if naso_oral_your < 1.3
                    else "Mouth width is relatively wide versus the nasal base, so the oral zone reads more prominent."
                    if naso_oral_your > 1.8
                    else "Mouth width sits near the expected range relative to the nasal base."
                )
            ),
        },
        "orbital": {
            "ratioLabel": "ORBITAL PROPORTION",
            "yourValue": round(orbital_your, 2),
            "idealValue": 1.0,
            "yourLabel": f"{'Spacing < Eye' if orbital_your < 0.95 else ('Spacing > Eye' if orbital_your > 1.05 else 'Spacing = Eye')}",
            "idealLabel": "Spacing = Eye",
            "expectation": "Generally, the space between the eyes is expected to be equal to the width of one eye.",
            "explanation": (
                f"Your inter-eye spacing to eye-width ratio is {orbital_your:.2f} (reference ≈ 1.00), "
                f"so the eyes read as "
                + (
                    "evenly spaced."
                    if 0.95 <= orbital_your <= 1.05
                    else "somewhat close-set."
                    if orbital_your < 0.95
                    else "somewhat wide-set."
                )
            ),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
# Eyebrow Metrics
# ══════════════════════════════════════════════════════════════════════════════

def _classify_brow_thickness(ratio: float) -> str:
    if ratio > 0.08: return "Thick"
    if ratio > 0.05: return "Medium"
    return "Thin"

def _classify_inner_angle(angle: float) -> str:
    if angle < 35: return "Converging"
    if angle < 50: return "Parallel"
    return "Diverging"

def _classify_tail_angle(angle: float) -> str:
    if angle > 140: return "Gentle taper"
    if angle > 120: return "Moderate taper"
    return "Sharp taper"


def eyebrow_metrics(landmarks: list) -> dict:
    lb = lm(landmarks, 105)
    rb = lm(landmarks, 334)
    le = lm(landmarks, 159)
    re = lm(landmarks, 386)
    forehead = lm(landmarks, 10)
    chin = lm(landmarks, 152)
    face_h = chin["y"] - forehead["y"] or 0.3
    face_w = dist_landmarks(lm(landmarks, 234), lm(landmarks, 454)) or 0.3

    brow_eye_gap = ((le["y"] - lb["y"]) + (re["y"] - rb["y"])) / 2 / face_h
    position = "High set" if brow_eye_gap < 0.1 else ("Mid set" if brow_eye_gap < 0.16 else "Low set")

    r_inner = lm(landmarks, 70)
    l_inner = lm(landmarks, 300)
    tilt = ((lb["y"] - r_inner["y"]) + (rb["y"] - l_inner["y"])) / 2
    tilt_label = "Upturned" if tilt < -0.008 else ("Downturned" if tilt > 0.008 else "Neutral")

    r_arch = lm(landmarks, 66)
    l_arch = lm(landmarks, 296)
    arch = ((r_arch["y"] - lb["y"]) + (l_arch["y"] - rb["y"])) / 2
    shape = "Arched" if arch < -0.012 else ("Straight" if arch > 0.005 else "Soft arch")
    peak_mm = (abs(arch) / face_h) * 120 + 18

    r_top = lm(landmarks, 107)
    r_bot = lm(landmarks, 52)
    l_top = lm(landmarks, 336)
    l_bot = lm(landmarks, 282)
    avg_thickness = (dist_landmarks(r_top, r_bot) + dist_landmarks(l_top, l_bot)) / 2 / face_h
    thickness_label = _classify_brow_thickness(avg_thickness)

    r_brow_mid = lm(landmarks, 63)
    l_brow_mid = lm(landmarks, 293)
    r_inner_angle = angle_between(r_brow_mid, r_inner, lm(landmarks, 9))
    l_inner_angle = angle_between(l_brow_mid, l_inner, lm(landmarks, 9))
    avg_inner_angle = (r_inner_angle + l_inner_angle) / 2
    inner_angle_label = _classify_inner_angle(avg_inner_angle)

    r_tail = lm(landmarks, 46)
    l_tail = lm(landmarks, 276)
    r_tail_angle = angle_between(lb, r_tail, lm(landmarks, 124))
    l_tail_angle = angle_between(rb, l_tail, lm(landmarks, 353))
    avg_tail_angle = (r_tail_angle + l_tail_angle) / 2
    tail_angle_label = _classify_tail_angle(avg_tail_angle)

    ipd = dist_landmarks(lm(landmarks, 33), lm(landmarks, 263)) or 0.001
    r_tail_len = dist_landmarks(lb, r_tail) / face_w
    l_tail_len = dist_landmarks(rb, l_tail) / face_w
    avg_tail_len = (r_tail_len + l_tail_len) / 2 * 100
    tail_length_label = "Long" if avg_tail_len > 18 else ("Moderate" if avg_tail_len > 13 else "Short")

    inner_set_dist = dist_landmarks(r_inner, l_inner) / ipd

    return {
        "position": position,
        "tilt": tilt_label,
        "shape": shape,
        "peakHeight": f"{peak_mm:.2f}",
        "thickness": thickness_label,
        "thicknessValue": f"{avg_thickness:.3f}",
        "innerBrowAngle": f"{avg_inner_angle:.1f}",
        "innerBrowAngleLabel": inner_angle_label,
        "tailAngle": f"{avg_tail_angle:.1f}",
        "tailAngleLabel": tail_angle_label,
        "tailLength": f"{avg_tail_len:.1f}",
        "tailLengthLabel": tail_length_label,
        "innerSet": f"{inner_set_dist:.2f}",
        "explanation": (
            f"The subject's brows sit in a {position.lower()} position with a {shape.lower()} form and "
            f"{tilt_label.lower()} tilt. The {thickness_label.lower()} brow structure with a "
            f"{tail_length_label.lower()} tail length contributes to a balanced periorbital frame. "
            f"Inner brows are {inner_angle_label.lower()} with a {tail_angle_label.lower()}."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Cheek Metrics
# ══════════════════════════════════════════════════════════════════════════════

def cheek_metrics(landmarks: list) -> dict:
    cheek_l = lm(landmarks, 127)
    cheek_r = lm(landmarks, 356)
    jaw_l = lm(landmarks, 234)
    jaw_r = lm(landmarks, 454)
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    nose = lm(landmarks, 2)
    ipd = dist_landmarks(lm(landmarks, 33), lm(landmarks, 263)) or 0.001
    face_h = chin["y"] - forehead["y"] or 0.3
    face_w = dist_landmarks(jaw_l, jaw_r) or 0.3

    cheek_width = dist_landmarks(cheek_l, cheek_r)
    cheek_width_pct = (cheek_width / face_w) * 100
    cheek_width_class = "Wide" if cheek_width_pct > 85 else ("Moderate" if cheek_width_pct > 72 else "Narrow")

    cheekbone_h_l = (nose["y"] - cheek_l["y"]) / face_h
    cheekbone_h_r = (nose["y"] - cheek_r["y"]) / face_h
    avg_cheekbone_height = (cheekbone_h_l + cheekbone_h_r) / 2 * 100
    cheekbone_h_class = "High" if avg_cheekbone_height > 12 else ("Medium" if avg_cheekbone_height > 6 else "Low")

    avg_z = ((cheek_l.get("z", 0)) + (cheek_r.get("z", 0))) / 2
    prominence = "Prominent" if avg_z > 0.02 else ("Moderate" if avg_z > -0.01 else "Flat")

    midface_length = ((nose["y"] - ((cheek_l["y"] + cheek_r["y"]) / 2)) / face_h * 100)
    midface_class = "Long" if midface_length > 25 else ("Balanced" if midface_length > 18 else "Short")

    cheek_height_diff = abs(cheek_l["y"] - cheek_r["y"]) / face_h * 100
    cheek_width_diff = abs(dist_landmarks(cheek_l, chin) - dist_landmarks(cheek_r, chin)) / face_w * 100
    asymmetry = (cheek_height_diff + cheek_width_diff) / 2
    sym_score = max(55, round(100 - asymmetry * 15))
    sym_label = "Highly symmetric" if asymmetry < 0.5 else ("Mildly asymmetric" if asymmetry < 1.5 else "Noticeably asymmetric")

    jaw_cheek_angle_l = angle_between(jaw_l, cheek_l, lm(landmarks, 116))
    jaw_cheek_angle_r = angle_between(jaw_r, cheek_r, lm(landmarks, 345))
    avg_jaw_cheek = (jaw_cheek_angle_l + jaw_cheek_angle_r) / 2
    jaw_cheek_class = "Smooth" if avg_jaw_cheek > 140 else ("Defined" if avg_jaw_cheek > 110 else "Angular")

    score = 72
    if cheekbone_h_class == "High": score += 8
    elif cheekbone_h_class == "Medium": score += 4
    if prominence == "Prominent": score += 5
    if sym_score > 85: score += 5
    if cheek_width_class == "Moderate": score += 3
    if midface_class == "Balanced": score += 4
    if cheek_width_class == "Narrow": score -= 3
    if sym_score < 70: score -= 5
    score = min(99, max(50, score))

    return {
        "score": score,
        "scoreLabel": "Strong" if score >= 85 else ("Defined" if score >= 70 else "Soft"),
        "cheekWidth": f"{cheek_width_pct:.1f}",
        "cheekWidthClass": cheek_width_class,
        "cheekboneHeight": f"{avg_cheekbone_height:.1f}",
        "cheekboneHeightClass": cheekbone_h_class,
        "prominence": prominence,
        "midfaceLength": f"{midface_length:.1f}",
        "midfaceClass": midface_class,
        "asymmetry": f"{asymmetry:.2f}",
        "symmetryScore": sym_score,
        "symmetryLabel": sym_label,
        "jawCheekTransition": jaw_cheek_class,
        "jawCheekAngle": f"{avg_jaw_cheek:.1f}",
        "explanation": (
            f"The subject's cheeks display {cheek_width_class.lower()} width with {cheekbone_h_class.lower()} "
            f"cheekbone placement. The cheekbones appear {prominence.lower()} with a "
            f"{jaw_cheek_class.lower()} jaw-to-cheek transition. Midface is {midface_class.lower()} "
            f"({midface_length:.1f}% of face height). Cheek symmetry is {sym_label.lower()} "
            f"(asymmetry: {asymmetry:.2f}%)."
        ),
    }


# ══════════════════════════════════════════════════════════════════════════════
# Overall Score & Label
# ══════════════════════════════════════════════════════════════════════════════

def overall_score(report_data: dict, eye_analysis: Optional[dict], metrics: Optional[dict]) -> int:
    weighted = []
    def add(score_val, weight=1):
        if score_val is not None:
            try:
                weighted.append({"score": float(score_val), "weight": weight})
            except (TypeError, ValueError):
                pass

    add(report_data.get("symmetry", {}).get("score"), 1.25)
    add(report_data.get("proportions", {}).get("score"), 1.25)
    add(int(metrics["harmonyScore"]) if metrics and metrics.get("harmonyScore") else None, 1.3)
    add(report_data.get("skin", {}).get("score"), 1.0)
    add(report_data.get("nose", {}).get("score"), 0.85)
    add(report_data.get("lips", {}).get("score"), 0.85)
    add(report_data.get("jawChin", {}).get("score"), 0.9)
    add(report_data.get("cheeks", {}).get("score"), 0.75)
    add(report_data.get("jaw", {}).get("score"), 0.75)
    add(report_data.get("chin", {}).get("score"), 0.75)
    add(report_data.get("smile", {}).get("score"), 0.7)
    add(report_data.get("neck", {}).get("score"), 0.65)
    add(report_data.get("ears", {}).get("score"), 0.6)
    add(report_data.get("hair", {}).get("score"), 0.7)
    add(eye_analysis.get("overallScore") if eye_analysis else None, 0.9)

    if not weighted:
        return 75
    total = sum(w["score"] * w["weight"] for w in weighted)
    total_w = sum(w["weight"] for w in weighted)
    return round(total / total_w)


def overall_label(score: int) -> str:
    if score >= 90: return "Exceptional"
    if score >= 82: return "Above Average"
    if score >= 74: return "Average"
    if score >= 65: return "Below Average"
    return "Needs Improvement"


# ══════════════════════════════════════════════════════════════════════════════
# Hair Pixel Analysis
# ══════════════════════════════════════════════════════════════════════════════

def hair_pixel_analysis(landmarks: list, top_head_src: Optional[bytes] = None) -> dict:
    """Hair analysis from top-of-head photo."""
    fallback = {
        "score": 78, "scoreLabel": "Natural", "hairline": "Average",
        "densityEstimate": "Moderate", "coverageEstimate": "Good",
        "foreheadExposure": "Moderate", "hairColor": "Dark",
        "hairColorHex": "#2a1a0a", "textureType": "Unknown",
        "thinningArea": "None detected", "crownVisibility": "N/A",
        "explanation": "Upload a top-of-head photo for real hair density & coverage analysis.",
    }
    if not top_head_src:
        return fallback

    try:
        nparr = np.frombuffer(top_head_src, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return fallback

        ch, cw = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Top 40% for hairline
        top_h = int(ch * 0.4)
        top_region = gray[:top_h, :]

        # Hair color from dark pixels
        dark_mask = gray < 100
        if dark_mask.any():
            dark_pixels = img[dark_mask]
            avg_bgr = dark_pixels.mean(axis=0)
            hair_color_hex = f"rgb({int(avg_bgr[2])},{int(avg_bgr[1])},{int(avg_bgr[0])})"
            avg_r, avg_g = float(avg_bgr[2]), float(avg_bgr[1])
        else:
            hair_color_hex = "#2a1a0a"
            avg_r, avg_g = 40.0, 25.0

        hair_color = "Black" if avg_r < 60 and avg_g < 40 else (
            "Dark Brown" if avg_r < 100 else (
            "Medium Brown" if avg_r < 150 else (
            "Blonde" if avg_r > 180 and avg_g > 150 else "Light Brown")))

        # Hair density
        hair_mask = gray < 110
        hair_ratio = hair_mask.sum() / (ch * cw)
        density_pct = round(hair_ratio * 100)
        density_estimate = "Thick" if density_pct > 55 else ("Moderate" if density_pct > 35 else ("Fine" if density_pct > 20 else "Thin"))

        # Hairline detection
        hairline_row = 0
        for y in range(top_h):
            bright_count = np.sum(top_region[y, ::3] > 140)
            if bright_count > cw * 0.15:
                hairline_row = y
                break
        hairline_pct = round((hairline_row / top_h) * 100)
        forehead_exposure = "High" if hairline_pct > 30 else ("Moderate" if hairline_pct > 15 else "Low")
        hairline = "Receding" if hairline_pct > 25 else ("Average" if hairline_pct > 12 else "Full")

        # Crown analysis
        half_w = cw // 2
        bottom_half = gray[top_h // 2:top_h, :]
        crown_l = np.sum(bottom_half[:, :half_w] < 100) / max(1, bottom_half[:, :half_w].size)
        crown_r = np.sum(bottom_half[:, half_w:] < 100) / max(1, bottom_half[:, half_w:].size)
        crown_diff = abs(crown_l - crown_r)
        thinning_area = "Crown asymmetry detected" if crown_diff > 0.15 else (
            "Crown thinning" if crown_l < 0.3 and crown_r < 0.3 else "None detected")
        crown_visibility = "Visible thinning" if crown_l < 0.3 and crown_r < 0.3 else "Normal coverage"

        coverage_estimate = "Full coverage" if density_pct > 45 else (
            "Good coverage" if density_pct > 25 else (
            "Moderate coverage" if density_pct > 15 else "Sparse coverage"))

        # Texture from edge analysis
        edges = cv2.Canny(gray, 50, 150)
        avg_edge = edges.mean()
        texture_type = "Curly/Wavy" if avg_edge > 35 else ("Wavy" if avg_edge > 20 else "Straight")

        score = 75
        if density_estimate == "Thick": score += 8
        elif density_estimate == "Moderate": score += 4
        elif density_estimate == "Thin": score -= 5
        if hairline == "Full": score += 6
        elif hairline == "Receding": score -= 4
        if thinning_area == "None detected": score += 4
        else: score -= 3
        if "Full" in coverage_estimate or "Good" in coverage_estimate: score += 3
        score = min(99, max(40, score))

        return {
            "score": score,
            "scoreLabel": "Healthy" if score >= 85 else ("Natural" if score >= 70 else "Monitor"),
            "hairline": hairline,
            "densityEstimate": density_estimate,
            "coverageEstimate": coverage_estimate,
            "foreheadExposure": forehead_exposure,
            "hairColor": hair_color,
            "hairColorHex": hair_color_hex,
            "textureType": texture_type,
            "thinningArea": thinning_area,
            "crownVisibility": crown_visibility,
            "densityPct": density_pct,
            "explanation": (
                f"Hair analysis from top-of-head photo: {density_estimate.lower()} hair with "
                f"{coverage_estimate.lower()}. Hairline is {hairline.lower()} with "
                f"{forehead_exposure.lower()} forehead exposure. "
                f"{'No significant thinning detected at the crown.' if thinning_area == 'None detected' else thinning_area + '.'}"
            ),
        }
    except Exception:
        return fallback


# ══════════════════════════════════════════════════════════════════════════════
# Smile Pixel Analysis
# ══════════════════════════════════════════════════════════════════════════════

def smile_pixel_analysis(landmarks: list, smile_src: Optional[bytes] = None) -> dict:
    fallback = {
        "teethVisibility": "N/A", "smileArc": "N/A", "gumExposure": "N/A",
        "teethWhiteness": "N/A", "smileWidthPx": "N/A",
        "explanation": "Upload a smile photo for enhanced teeth & smile analysis.",
    }
    if not smile_src:
        return fallback

    try:
        nparr = np.frombuffer(smile_src, np.uint8)
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
        mouth_w = abs(mouth_r["x"] - mouth_l["x"]) * 1.4
        mouth_h = abs(lower_lip["y"] - upper_lip["y"]) * 2.5

        sx = max(0, round((cx - mouth_w / 2) * w))
        sy = max(0, round((cy - mouth_h / 2) * h))
        sw = min(w - sx, round(mouth_w * w))
        sh = min(h - sy, round(mouth_h * h))
        if sw < 5 or sh < 5:
            return fallback

        crop = img[sy:sy + sh, sx:sx + sw]
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        lip_mid_y = round(sh * 0.35)
        lip_bot_y = round(sh * 0.65)

        # Teeth visibility
        mouth_region = gray[lip_mid_y:lip_bot_y, round(sw * 0.1):round(sw * 0.9)]
        teeth_mask = (mouth_region > 160)
        teeth_ratio = teeth_mask.sum() / max(1, mouth_region.size)
        teeth_visibility = "High" if teeth_ratio > 0.3 else ("Moderate" if teeth_ratio > 0.12 else ("Low" if teeth_ratio > 0.04 else "Minimal"))

        # Teeth whiteness
        color_crop = crop[lip_mid_y:lip_bot_y, round(sw * 0.1):round(sw * 0.9)]
        white_mask = (mouth_region > 160)
        if white_mask.any():
            white_pixels = color_crop[white_mask]
            whiteness_score = white_pixels.mean()
        else:
            whiteness_score = 200
        teeth_whiteness = "Very White" if whiteness_score > 220 else ("White" if whiteness_score > 190 else ("Natural" if whiteness_score > 160 else "Yellowish"))

        # Smile arc
        arc_y = lip_mid_y + 2
        left_bright = gray[arc_y, round(sw * 0.15)] if arc_y < sh else 128
        center_bright = gray[arc_y, round(sw * 0.5)] if arc_y < sh else 128
        right_bright = gray[arc_y, round(sw * 0.85)] if arc_y < sh else 128
        smile_arc = "Consonant (ideal U-shape)" if center_bright > left_bright and center_bright > right_bright else (
            "Slightly curved" if center_bright > (left_bright + right_bright) / 2 else "Flat")

        # Gum exposure
        gum_y = lip_mid_y - 3
        gum_exposure = "Minimal"
        if gum_y > 0 and gum_y < sh:
            gum_region = crop[gum_y, round(sw * 0.2):round(sw * 0.8)]
            if len(gum_region.shape) == 2:
                gum_exposure = "Minimal"
            else:
                pink_mask = (gum_region[:, 2] > 150) & (gum_region[:, 1] < 130) & (gum_region[:, 0] < 130)
                gum_ratio = pink_mask.sum() / max(1, pink_mask.size)
                gum_exposure = "Gummy smile" if gum_ratio > 0.2 else ("Slight gum show" if gum_ratio > 0.08 else "Minimal")

        smile_width_px = round(abs(mouth_r["x"] - mouth_l["x"]) * w)

        return {
            "teethVisibility": teeth_visibility,
            "smileArc": smile_arc,
            "gumExposure": gum_exposure,
            "teethWhiteness": teeth_whiteness,
            "smileWidthPx": smile_width_px,
            "explanation": (
                f"Smile analysis: {teeth_visibility.lower()} teeth visibility with {smile_arc.lower()}. "
                f"Gum exposure is {gum_exposure.lower()}. Teeth appear {teeth_whiteness.lower()}."
            ),
        }
    except Exception:
        return fallback


# ══════════════════════════════════════════════════════════════════════════════
# build_cv_report() — Main Orchestrator
# ══════════════════════════════════════════════════════════════════════════════

def build_cv_report(landmarks: list, image_bytes: bytes, metrics: Optional[dict] = None, photos: Optional[dict] = None, answers: Optional[dict] = None) -> dict:
    """Build the complete CV report from landmarks + image.

    Args:
        landmarks: List of 478 landmark dicts from MediaPipe.
        image_bytes: Raw image bytes (JPEG/PNG).
        metrics: Optional dict of pre-computed metrics from opencv_metrics.
        photos: Optional dict with keys like 'smile', 'topHead' (bytes).

    Returns:
        Complete CV report dict with all feature analyses.
    """
    if photos is None:
        photos = {}

    face_box = bbox_full_face(landmarks, 0.08)
    sym = symmetry_score(landmarks, metrics)
    sym_label = symmetry_label(sym)
    sym_regions = symmetry_regions(landmarks)
    prop = proportions_from_landmarks(landmarks, metrics)

    face_crop = crop_normalized(image_bytes, face_box)
    brows_data = analyze_brows_crop(landmarks, image_bytes)

    symmetry_dots = dots_in_image(landmarks, SYMMETRY_DOTS)
    symmetry_midline = {
        "top": point_in_image(landmarks, 10),
        "bot": point_in_image(landmarks, 152),
    }
    proportion_lines = proportion_lines_in_image(landmarks)

    ratios = proportion_ratios(landmarks)
    # Image-space overlays — paired with the front pose after ``apply_photo_urls_to_cv_report``.
    ratio_overlays = proportion_ratio_overlays(landmarks)
    for key in ratios:
        if key in ratio_overlays:
            ratios[key] = {**ratios[key], "overlay": ratio_overlays[key], "overlaySpace": "image"}

    brow = eyebrow_metrics(landmarks)

    # Feature crops
    nose_box = bbox_from_indices(landmarks, NOSE_BRIDGE, 0.035)
    mouth_box = bbox_from_indices(landmarks, MOUTH, 0.04)
    jaw_box = merge_bboxes(bbox_from_indices(landmarks, JAW_LEFT, 0.02), bbox_from_indices(landmarks, JAW_RIGHT, 0.02), 0.01)
    chin_box_data = bbox_from_indices(landmarks, CHIN, 0.03)
    cheek_l_box = bbox_from_indices(landmarks, CHEEK_LEFT, 0.02)
    cheek_r_box = bbox_from_indices(landmarks, CHEEK_RIGHT, 0.02)
    cheek_box = merge_bboxes(cheek_l_box, cheek_r_box, 0.015)
    # Frontal jaw BEFORE: mouth through jawline (matches protocol framing)
    jaw_front_box = merge_bboxes(mouth_box, jaw_box, 0.03)

    nose_crop = crop_normalized(image_bytes, nose_box)
    mouth_crop = crop_normalized(image_bytes, mouth_box)
    jaw_crop = crop_normalized(image_bytes, jaw_front_box)
    cheek_crop = crop_normalized(image_bytes, cheek_box)
    chin_front_box = merge_bboxes(mouth_box, chin_box_data, 0.02)
    chin_crop = crop_normalized(image_bytes, chin_front_box)

    nose = nose_metrics(landmarks)
    lips = lip_metrics(landmarks)
    jaw_chin = jaw_chin_metrics(landmarks)
    jaw_data = jaw_metrics(landmarks)
    chin_data = chin_metrics(landmarks)
    smile_data = smile_metrics(landmarks)
    pose_data = analyze_with_pose(image_bytes)
    neck_data = neck_metrics(landmarks, pose_data)
    ear_data = ear_metrics(landmarks)
    skin = skin_quality_metrics(landmarks, image_bytes, metrics)

    smile_pixels = smile_pixel_analysis(landmarks, photos.get("smile"))
    hair_data = hair_pixel_analysis(landmarks, photos.get("topHead"))
    img_arr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    img_size = (img_arr.shape[1], img_arr.shape[0]) if img_arr is not None else None
    face_shape_raw = face_shape_from_landmarks(landmarks, image_size=img_size)
    # Bake notebook-style overlay onto the full front photo (fallback when SVG not used)
    annotated = render_face_shape_overlay_image(image_bytes, face_shape_raw)
    face_shape = {
        **_strip_face_shape_private(face_shape_raw),
        "imageSrc": annotated or face_crop,
    }

    cheek = cheek_metrics(landmarks)

    # Frontal hairline + forehead + brows crop (protocol BEFORE; topHead stays for density)
    brow_y = max(lm(landmarks, 105)["y"], lm(landmarks, 334)["y"])
    hair_y0 = max(0.0, face_box["y"] - face_box["h"] * 0.22)
    forehead_box = {
        "x": max(0.0, face_box["x"] - face_box["w"] * 0.02),
        "y": hair_y0,
        "w": min(1.0, face_box["w"] * 1.04),
        "h": min(1.0 - hair_y0, brow_y + face_box["h"] * 0.06 - hair_y0),
    }
    forehead_crop = crop_normalized(image_bytes, forehead_box)

    # Neck crop: lower face (nostrils) through jaw and neck column — not a thin under-chin strip
    nose_y = lm(landmarks, 2)["y"]
    chin_y = lm(landmarks, 152)["y"]
    neck_top = max(0.0, min(nose_y - face_box["h"] * 0.04, face_box["y"] + face_box["h"] * 0.45))
    lower_span = max(chin_y - neck_top, face_box["h"] * 0.35)
    neck_x = max(0.0, face_box["x"] - face_box["w"] * 0.06)
    neck_box = {
        "x": neck_x,
        "y": neck_top,
        "w": min(1.0 - neck_x, face_box["w"] * 1.12),
        "h": min(1.0 - neck_top, chin_y + lower_span * 0.7 - neck_top),
    }
    neck_crop = crop_normalized(image_bytes, neck_box)

    report_data = {
        "faceShape": face_shape,
        "symmetry": {
            "score": sym, "scoreLabel": sym_label,
            "scaleLeft": "Asymmetric", "scaleRight": "Symmetric",
            "scaleMarkerPct": sym,
            "explanation": symmetry_explanation(sym, sym_label, sym_regions),
            "imageSrc": face_crop,
            "symmetryDots": symmetry_dots,
            "symmetryMidline": symmetry_midline,
            "regions": sym_regions,
            "overlaySpace": "image",
        },
        "proportions": {
            "score": prop["score"], "scoreLabel": prop["label"],
            "scaleLeft": "Imbalanced", "scaleRight": "Ideal balance",
            "scaleMarkerPct": prop["score"],
            "upperThird": prop["upperThird"], "middleThird": prop["middleThird"],
            "lowerThird": prop["lowerThird"],
            "explanation": prop.get("explanation") or (
                f"Your facial thirds measure upper {prop['upperThird']}, middle {prop['middleThird']}, "
                f"and lower {prop['lowerThird']}."
            ),
            "imageSrc": face_crop,
            "proportionLines": proportion_lines,
            "ratios": ratios,
            "faceBox": face_box,
            "overlaySpace": "image",
        },
        "nose": {**nose, "imageSrc": nose_crop},
        "eyes": {"score": 80, "scoreLabel": "Balanced", "dataSource": "pending"},
        "eyebrows": {
            "crop": brows_data["crop"], "metrics": brow,
        },
        "lips": {**lips, "imageSrc": mouth_crop},
        "jawChin": {**jaw_chin, "imageSrc": jaw_crop, "photoSource": "front"},
        "cheeks": {**cheek, "imageSrc": cheek_crop},
        "jaw": {**jaw_data, "imageSrc": jaw_crop, "photoSource": "front"},
        "chin": {**chin_data, "imageSrc": chin_crop, "photoSource": "front"},
        "smile": {**smile_data, **smile_pixels, "imageSrc": photos.get("smile", mouth_crop)},
        "neck": {**neck_data, "imageSrc": neck_crop},
        "ears": {**ear_data, "imageSrc": face_crop},
        "hair": {
            **hair_data,
            "imageSrc": forehead_crop,
            "imageSrcTopHead": photos.get("topHead"),
            "photoSource": "front",
        },
        "skin": skin,
        "dimorphism": dimorphism_metrics(landmarks, metrics, answers),
        "averageness": averageness_metrics(landmarks, metrics, answers),
    }

    ov = overall_score(report_data, None, metrics)
    report_data["overall"] = {"score": ov, "scoreLabel": overall_label(ov)}

    return report_data
