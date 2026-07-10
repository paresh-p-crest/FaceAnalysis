"""Port of faceCrop.js — MediaPipe Face Mesh landmark groups, bbox utilities, crop helpers.

All landmark index groups, bounding-box computations, and crop-space coordinate
transformations from the original JS codebase are preserved exactly.
"""

from __future__ import annotations
import math
from typing import List, Dict, Tuple, Optional

# ── MediaPipe Face Mesh landmark index groups (478-point model) ──

FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
    152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

# Person's right eye (viewer's left)
RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]

# Person's left eye (viewer's right)
LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

RIGHT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 124, 156, 221, 222, 223]
LEFT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276, 353, 383, 441, 442, 443]

# Curated symmetry overlay landmarks (paired + midline) — not full eye/brow contours.
# Dense mesh contours overlap visually; scoring still uses full MediaPipe mesh elsewhere.
SYMMETRY_DOTS = [
    # Right eye (person's right): outer, inner, top, bottom
    33, 133, 159, 145,
    # Left eye
    362, 263, 386, 374,
    # Right brow: outer, peak, inner
    70, 105, 107,
    # Left brow
    300, 334, 336,
    # Nose midline + alae
    1, 2, 4, 5, 6, 98, 327,
    # Mouth corners, chin, jaw
    61, 291, 152, 234, 454,
]

# Feature crop index groups (from cvReport.js)
NOSE_BRIDGE = [6, 197, 195, 5, 4, 1, 2, 98, 327]
NOSE_TIP = [1, 2, 98, 327, 48, 278, 44, 274]
UPPER_LIP = [13, 312, 311, 310, 411, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82]
LOWER_LIP = [14, 87, 178, 88, 95, 324, 308, 411, 310, 311, 312, 13, 82, 81, 80, 191, 78]
JAW_LEFT = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323]
JAW_RIGHT = [172, 136, 150, 149, 176, 148, 152, 145, 153, 154, 155, 133, 173, 157, 158, 159]
CHIN = [152, 148, 176, 149, 150, 136, 176, 377, 400, 378, 379, 365, 397, 288, 361, 323, 145, 153, 154, 155]
MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]

CHEEK_LEFT = [116, 117, 118, 119, 120, 121, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 213, 214, 215]
CHEEK_RIGHT = [345, 346, 347, 348, 349, 350, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 433, 434, 435]
APPLE_LEFT = [116, 117, 118, 119, 120, 121, 126, 127, 128]
APPLE_RIGHT = [345, 346, 347, 348, 349, 350, 355, 356, 357]


# ── Helper functions ──

def lm(landmarks: list, idx: int) -> dict:
    """Get landmark by index, fallback to center."""
    if idx < len(landmarks):
        return landmarks[idx]
    return {"x": 0.5, "y": 0.5, "z": 0}


def mouth_cheilions(landmarks: list) -> tuple:
    """Outer mouth corners (cheilion) from outer-lip contour extremes — not inset 61/291 alone."""
    pts = [lm(landmarks, i) for i in MOUTH]
    right = min(pts, key=lambda p: p["x"])  # person's right
    left = max(pts, key=lambda p: p["x"])   # person's left
    return right, left


def nose_alae(landmarks: list) -> tuple:
    """Widest nasal-base points among common alar landmarks."""
    pts = [lm(landmarks, i) for i in (48, 278, 64, 294, 98, 327)]
    right = min(pts, key=lambda p: p["x"])
    left = max(pts, key=lambda p: p["x"])
    return right, left


def dist(a: dict, b: dict) -> float:
    """Euclidean distance between two landmark dicts."""
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def dist_landmarks(a: dict, b: dict) -> float:
    """Alias for dist — Euclidean distance."""
    return dist(a, b)


def angle_between(a: dict, b: dict, c: dict) -> float:
    """Angle at vertex b formed by a-b-c, in degrees."""
    ab = {"x": a["x"] - b["x"], "y": a["y"] - b["y"]}
    cb = {"x": c["x"] - b["x"], "y": c["y"] - b["y"]}
    dot = ab["x"] * cb["x"] + ab["y"] * cb["y"]
    mag_ab = math.hypot(ab["x"], ab["y"]) or 0.001
    mag_cb = math.hypot(cb["x"], cb["y"]) or 0.001
    return math.acos(max(-1, min(1, dot / (mag_ab * mag_cb)))) * (180 / math.pi)


def bbox_from_indices(landmarks: list, indices: list, pad: float = 0.02) -> dict:
    """Compute bounding box from landmark indices with padding."""
    pts = [lm(landmarks, i) for i in indices]
    if not pts:
        return {"x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8}
    xs = [p["x"] for p in pts]
    ys = [p["y"] for p in pts]
    min_x = max(0, min(xs) - pad)
    min_y = max(0, min(ys) - pad)
    max_x = min(1, max(xs) + pad)
    max_y = min(1, max(ys) + pad)
    return {"x": min_x, "y": min_y, "w": max(0.05, max_x - min_x), "h": max(0.05, max_y - min_y)}


def merge_bboxes(a: dict, b: dict, pad: float = 0.015) -> dict:
    """Merge two bounding boxes."""
    min_x = max(0, min(a["x"], b["x"]) - pad)
    min_y = max(0, min(a["y"], b["y"]) - pad)
    max_x = min(1, max(a["x"] + a["w"], b["x"] + b["w"]) + pad)
    max_y = min(1, max(a["y"] + a["h"], b["y"] + b["h"]) + pad)
    return {"x": min_x, "y": min_y, "w": max_x - min_x, "h": max_y - min_y}


def bbox_full_face(landmarks: list, pad: float = 0.1) -> dict:
    """Bounding box for full face."""
    return bbox_from_indices(landmarks, FACE_OVAL, pad)


def bbox_eyes_region(landmarks: list) -> dict:
    """Bounding box for eyes region."""
    right = bbox_from_indices(landmarks, RIGHT_EYE, 0.028)
    left = bbox_from_indices(landmarks, LEFT_EYE, 0.028)
    merged = merge_bboxes(right, left, 0.018)

    pad_outer = 0.022
    x = max(0, merged["x"] - pad_outer)
    w = min(1 - x, merged["w"] + pad_outer * 2)

    upper_y = min(lm(landmarks, 159)["y"], lm(landmarks, 386)["y"])
    lower_y = max(lm(landmarks, 145)["y"], lm(landmarks, 374)["y"])
    y = max(0, upper_y - 0.01)
    h = min(1 - y, lower_y - upper_y + 0.028)

    return {"x": x, "y": y, "w": w, "h": h}


def bbox_brows_region(landmarks: list) -> dict:
    """Bounding box for brows region."""
    right = bbox_from_indices(landmarks, RIGHT_BROW, 0.018)
    left = bbox_from_indices(landmarks, LEFT_BROW, 0.018)
    merged = merge_bboxes(right, left, 0.01)

    eye_top_y = min(lm(landmarks, 159)["y"], lm(landmarks, 386)["y"])
    y = max(0, merged["y"] - 0.012)
    max_bottom = eye_top_y - 0.006
    h = max(0.035, min(merged["h"] + 0.012, max_bottom - y))

    return {"x": merged["x"], "y": y, "w": merged["w"], "h": h}


def point_in_crop(landmarks: list, idx: int, box: dict) -> dict:
    """Convert a landmark to crop-relative coordinates (0-100)."""
    p = lm(landmarks, idx)
    return {
        "x": ((p["x"] - box["x"]) / box["w"]) * 100,
        "y": ((p["y"] - box["y"]) / box["h"]) * 100,
    }


def dots_in_crop(landmarks: list, indices: list, box: dict) -> list:
    """Convert multiple landmarks to crop-relative coordinates."""
    return [{"id": i, **point_in_crop(landmarks, i, box)} for i in indices]


def proportion_lines_in_crop(landmarks: list, box: dict) -> dict:
    """Compute facial proportion lines in crop-relative percentage space."""
    brow_y = (lm(landmarks, 105)["y"] + lm(landmarks, 334)["y"]) / 2
    to_pct = lambda y: ((y - box["y"]) / box["h"]) * 100
    return {
        "hair": to_pct(lm(landmarks, 10)["y"]),
        "brow": to_pct(brow_y),
        "nose": to_pct(lm(landmarks, 2)["y"]),
        "chin": to_pct(lm(landmarks, 152)["y"]),
    }


def point_in_image(landmarks: list, idx: int) -> dict:
    """Landmark position in full-image percentage space (0–100)."""
    p = lm(landmarks, idx)
    return {"x": p["x"] * 100, "y": p["y"] * 100}


def dots_in_image(landmarks: list, indices: list) -> list:
    """Symmetry / overlay dots in full-image percentage space."""
    return [{"id": i, **point_in_image(landmarks, i)} for i in indices]


def proportion_lines_in_image(landmarks: list) -> dict:
    """Facial third guide lines in full-image percentage space."""
    brow_y = (lm(landmarks, 105)["y"] + lm(landmarks, 334)["y"]) / 2
    return {
        "hair": lm(landmarks, 10)["y"] * 100,
        "brow": brow_y * 100,
        "nose": lm(landmarks, 2)["y"] * 100,
        "chin": lm(landmarks, 152)["y"] * 100,
    }


def _overlay_y(landmarks: list, idx: int) -> float:
    return point_in_image(landmarks, idx)["y"]


def _overlay_x(landmarks: list, idx: int) -> float:
    return point_in_image(landmarks, idx)["x"]


def proportion_ratio_overlays(landmarks: list) -> dict:
    """Qoves-style dashed guides per proportion tab (full-image 0–100 coords).

    Canons (Farkas / Qoves):
    - orbito-nasal: intercanthal (en–en) vs nasal width (al–al)
    - orbital: intercanthal vs eye fissure (ex–en)
    - naso-oral: mouth width (ch–ch) vs nasal width
    - naso-aural: ear height vs nose height (profile preferred; front fallback)
    """
    # Person's right = viewer's left on a frontal facing camera.
    # 33/133 right eye outer/inner, 362/263 left eye inner/outer.
    r_out = point_in_image(landmarks, 33)
    r_in = point_in_image(landmarks, 133)
    l_in = point_in_image(landmarks, 362)
    l_out = point_in_image(landmarks, 263)
    al_r_raw, al_l_raw = nose_alae(landmarks)
    ch_r_raw, ch_l_raw = mouth_cheilions(landmarks)
    al_r = {"x": al_r_raw["x"] * 100, "y": al_r_raw["y"] * 100}
    al_l = {"x": al_l_raw["x"] * 100, "y": al_l_raw["y"] * 100}
    ch_r = {"x": ch_r_raw["x"] * 100, "y": ch_r_raw["y"] * 100}
    ch_l = {"x": ch_l_raw["x"] * 100, "y": ch_l_raw["y"] * 100}

    eye_line_y = (r_out["y"] + r_in["y"] + l_in["y"] + l_out["y"]) / 4
    nose_base_y = (al_r["y"] + al_l["y"]) / 2
    mouth_y = (ch_r["y"] + ch_l["y"]) / 2

    return {
        "nasoAural": {
            "horizontal": [
                {"y": _overlay_y(landmarks, 234)},
                {"y": _overlay_y(landmarks, 127)},
                {"y": _overlay_y(landmarks, 6)},
                {"y": _overlay_y(landmarks, 2)},
            ],
            "segments": [
                {"x1": _overlay_x(landmarks, 234), "y1": _overlay_y(landmarks, 234),
                 "x2": _overlay_x(landmarks, 234), "y2": _overlay_y(landmarks, 127)},
                {"x1": _overlay_x(landmarks, 2), "y1": _overlay_y(landmarks, 6),
                 "x2": _overlay_x(landmarks, 2), "y2": _overlay_y(landmarks, 2)},
            ],
        },
        "orbitoNasal": {
            # en–en (inner canthi) vs al–al (alae)
            "horizontal": [{"y": round(eye_line_y, 2)}],
            "vertical": [
                {"x": r_in["x"]},
                {"x": l_in["x"]},
                {"x": al_r["x"]},
                {"x": al_l["x"]},
            ],
            "dots": [
                {"x": r_in["x"], "y": r_in["y"]},
                {"x": l_in["x"], "y": l_in["y"]},
                {"x": al_r["x"], "y": al_r["y"]},
                {"x": al_l["x"], "y": al_l["y"]},
            ],
        },
        "nasoOral": {
            "horizontal": [
                {"y": round(nose_base_y, 2)},
                {"y": round(mouth_y, 2)},
            ],
            "vertical": [
                {"x": al_r["x"]},
                {"x": al_l["x"]},
                {"x": ch_r["x"]},
                {"x": ch_l["x"]},
            ],
            "dots": [
                {"x": al_r["x"], "y": al_r["y"]},
                {"x": al_l["x"], "y": al_l["y"]},
                {"x": ch_r["x"], "y": ch_r["y"]},
                {"x": ch_l["x"], "y": ch_l["y"]},
            ],
        },
        "orbital": {
            # en–en vs ex–en: all four canthi, L→R on screen = 33, 133, 362, 263
            "horizontal": [{"y": round(eye_line_y, 2)}],
            "vertical": [
                {"x": r_out["x"]},
                {"x": r_in["x"]},
                {"x": l_in["x"]},
                {"x": l_out["x"]},
            ],
            "dots": [
                {"x": r_out["x"], "y": r_out["y"]},
                {"x": r_in["x"], "y": r_in["y"]},
                {"x": l_in["x"], "y": l_in["y"]},
                {"x": l_out["x"], "y": l_out["y"]},
            ],
        },
    }
