"""LAB + skin-mask skin analysis (notebook-aligned Qoves metrics).

Builds a face-oval mask minus eyes/lips/brows, then derives undertone, blemishing,
evenness, texture, roughness/homogeneity RIN, oiliness skew, and under-eye L*.
"""

from __future__ import annotations

import cv2
import numpy as np

from .face_crop import FACE_OVAL, LEFT_EYE, RIGHT_EYE, LEFT_BROW, RIGHT_BROW, lm

# Notebook lip outer contour (subset sufficient for convex exclusion hull)
LIPS = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
    308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
]
L_UNDER_EYE = [110, 205, 50, 207, 214, 192, 212]
R_UNDER_EYE = [339, 425, 280, 427, 434, 416, 432]


def _pts(landmarks: list, indices: list, w: int, h: int) -> np.ndarray:
    out = []
    for i in indices:
        p = lm(landmarks, i)
        out.append((int(float(p["x"]) * w), int(float(p["y"]) * h)))
    return np.array(out, dtype=np.int32)


def _skewness(values: np.ndarray) -> float:
    """Fisher–Pearson skewness without scipy."""
    if values.size < 3:
        return 0.0
    mean = float(np.mean(values))
    std = float(np.std(values))
    if std < 1e-9:
        return 0.0
    return float(np.mean(((values - mean) / std) ** 3))


def _build_skin_mask(landmarks: list, w: int, h: int) -> np.ndarray:
    face_pts = _pts(landmarks, FACE_OVAL, w, h)
    face_mask = np.zeros((h, w), dtype=np.uint8)
    if len(face_pts) >= 3:
        cv2.fillPoly(face_mask, [face_pts], 255)

    exclude = np.zeros((h, w), dtype=np.uint8)
    for indices in (LIPS, LEFT_EYE, RIGHT_EYE, LEFT_BROW[:10], RIGHT_BROW[:10]):
        pts = _pts(landmarks, indices, w, h)
        if len(pts) < 3:
            continue
        hull = cv2.convexHull(pts)
        cv2.fillConvexPoly(exclude, hull, 255)

    return cv2.bitwise_and(face_mask, cv2.bitwise_not(exclude))


def _under_eye_mask(landmarks: list, w: int, h: int) -> np.ndarray:
    mask = np.zeros((h, w), dtype=np.uint8)
    for indices in (L_UNDER_EYE, R_UNDER_EYE):
        pts = _pts(landmarks, indices, w, h)
        if len(pts) < 3:
            continue
        hull = cv2.convexHull(pts)
        cv2.fillConvexPoly(mask, hull, 255)
    return mask


def analyze_skin_lab(image_bytes: bytes, landmarks: list) -> dict:
    """Notebook-aligned skin metrics from LAB + Laplacian on a pure skin mask."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None or not landmarks:
        return _fallback()

    h, w = img.shape[:2]
    skin_mask = _build_skin_mask(landmarks, w, h)
    skin_pixels = skin_mask == 255
    if int(np.count_nonzero(skin_pixels)) < 100:
        return _fallback()

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_ch, a_ch, b_ch = cv2.split(lab)

    l_skin = l_ch[skin_pixels].astype(np.float64)
    a_skin = a_ch[skin_pixels].astype(np.float64)
    b_skin = b_ch[skin_pixels].astype(np.float64)

    mean_a = float(np.mean(a_skin))
    mean_b = float(np.mean(b_skin))
    mean_l_face = float(np.mean(l_skin))

    # --- Undertone ---
    a_offset = mean_a - 128.0
    b_offset = mean_b - 128.0
    if b_offset > 10 and a_offset < 10:
        undertone = "Warm"
    elif b_offset > 5 and a_offset < 5:
        undertone = "Neutral-Warm"
    elif a_offset > 10 and b_offset < 5:
        undertone = "Cool"
    elif a_offset > 5:
        undertone = "Neutral-Cool"
    else:
        undertone = "Neutral"

    # --- Roughness / texture (Laplacian variance → RIN) ---
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    laplacian_abs = np.abs(laplacian)
    variance = float(np.var(laplacian_abs[skin_pixels]))
    roughness_rin = float(np.clip(0.05 + (variance / 3000.0), 0.05, 0.30))
    if roughness_rin < 0.10:
        texture = "Smooth"
    elif roughness_rin < 0.14:
        texture = "Slightly Textured"
    else:
        texture = "Textured/Rough"

    # --- Oiliness (L* skewness) ---
    oiliness_skew = _skewness(l_skin)
    if oiliness_skew > 0.30:
        oiliness = "Oily/Shiny"
    elif oiliness_skew > 0.0:
        oiliness = "Normal/Combination"
    else:
        oiliness = "Matte / Dry"

    # --- Homogeneity / evenness ---
    std_l = float(np.std(l_skin))
    std_a = float(np.std(a_skin))
    std_b = float(np.std(b_skin))
    total_std = (std_l + std_a + std_b) / 3.0
    homogeneity_rin = float(np.clip(0.10 + (total_std / 50.0), 0.10, 0.45))
    if homogeneity_rin < 0.20:
        evenness = "Even"
    elif homogeneity_rin < 0.28:
        evenness = "Slightly Uneven"
    else:
        evenness = "Uneven"

    # --- Blemishing (a* hotspots) ---
    a_masked = cv2.bitwise_and(a_ch, a_ch, mask=skin_mask)
    _, red_mask = cv2.threshold(a_masked, mean_a + 15, 255, cv2.THRESH_BINARY)
    num_labels, _labels, stats, _centroids = cv2.connectedComponentsWithStats(red_mask, connectivity=8)
    blemish_count = 0
    for i in range(1, num_labels):
        area = int(stats[i, cv2.CC_STAT_AREA])
        if 5 < area < 500:
            blemish_count += 1
    if blemish_count < 3:
        blemishing = "Clear"
    elif blemish_count < 10:
        blemishing = "Mild"
    elif blemish_count < 25:
        blemishing = "Moderate"
    else:
        blemishing = "Severe"

    # --- Under-eye luminance ---
    ue_mask = _under_eye_mask(landmarks, w, h)
    ue_pixels = ue_mask == 255
    if int(np.count_nonzero(ue_pixels)) > 20:
        under_eye_l = float(np.mean(l_ch[ue_pixels].astype(np.float64)))
    else:
        under_eye_l = mean_l_face
    if under_eye_l < mean_l_face * 0.9:
        dark_circles = "Dark circles detected"
        under_eye_health = "Dark circles present"
    else:
        dark_circles = "Not Prominent"
        under_eye_health = "Good"

    # Fair→Deep from face L* (compat for visual_generation / narratives)
    if mean_l_face > 180:
        skin_tone = "Fair"
    elif mean_l_face > 150:
        skin_tone = "Light"
    elif mean_l_face > 120:
        skin_tone = "Medium"
    elif mean_l_face > 90:
        skin_tone = "Olive"
    elif mean_l_face > 60:
        skin_tone = "Tan"
    else:
        skin_tone = "Deep"

    return {
        "undertone": undertone,
        "blemishing": blemishing,
        "blemishCount": blemish_count,
        "evenness": evenness,
        "texture": texture,
        "oiliness": oiliness,
        "darkCircles": dark_circles,
        "roughnessRin": round(roughness_rin, 2),
        "homogeneityRin": round(homogeneity_rin, 2),
        "oilinessSkew": round(oiliness_skew, 2),
        "meanRednessA": round(mean_a, 1),
        "faceLuminance": round(mean_l_face, 1),
        "underEyeLuminance": round(under_eye_l, 1),
        "skinTone": skin_tone,
        "tone": evenness,
        "underEyeHealth": under_eye_health,
        "dataSource": "measured",
    }


def _fallback() -> dict:
    return {
        "undertone": "Neutral",
        "blemishing": "Clear",
        "blemishCount": 0,
        "evenness": "Even",
        "texture": "Smooth",
        "oiliness": "Normal/Combination",
        "darkCircles": "Not Prominent",
        "roughnessRin": 0.08,
        "homogeneityRin": 0.15,
        "oilinessSkew": 0.0,
        "meanRednessA": 128.0,
        "faceLuminance": 0.0,
        "underEyeLuminance": 0.0,
        "skinTone": "Medium",
        "tone": "Even",
        "underEyeHealth": "Good",
        "dataSource": "fallback",
    }


# Backward-compatible name for older callers that passed region boxes.
def analyze_skin_texture(image_bytes: bytes, region_boxes: dict | None = None, landmarks: list | None = None) -> dict:
    if landmarks:
        return analyze_skin_lab(image_bytes, landmarks)
    return _fallback()
