"""Notebook-derived facial metrics from stored MediaPipe landmarks + parsing mask."""

from __future__ import annotations

from typing import Any, Optional

import numpy as np

ASSUMED_IPD_MM = 63.5
SCALE_KEY = "assumed_ipd_63.5"

FEATURE_METRIC_KEYS = {
    "eyebrows": "eyebrow",
    "eyes": "eye",
    "nose": "nose",
    "lips": "lips",
    "cheeks": "cheeks",
    "jaw": "jaw",
    "chin": "chin",
    "hair": "hair",
    "smile": "smile",
    "neck": "neck",
}


def _lm_dict(landmarks: list) -> dict[int, np.ndarray]:
    out: dict[int, np.ndarray] = {}
    for pt in landmarks or []:
        idx = pt.get("id")
        if idx is None:
            continue
        out[int(idx)] = np.array([float(pt["x"]), float(pt["y"])], dtype=np.float64)
    return out


def _lm_px(landmark_map: dict[int, np.ndarray], idx: int, w: int, h: int) -> np.ndarray:
    pt = landmark_map[idx]
    return np.array([pt[0] * w, pt[1] * h], dtype=np.float64)


def _dist_px(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(b - a))


def _angle_deg(v: np.ndarray, a: np.ndarray, b: np.ndarray) -> float:
    va, vb = a - v, b - v
    cos_a = np.dot(va, vb) / (np.linalg.norm(va) * np.linalg.norm(vb) + 1e-9)
    return float(np.degrees(np.arccos(np.clip(cos_a, -1, 1))))


def _angle_from_vertical(top: np.ndarray, bottom: np.ndarray) -> float:
    vec = bottom - top
    cos_a = np.dot(vec, [0, 1]) / (np.linalg.norm(vec) + 1e-9)
    return float(np.degrees(np.arccos(np.clip(cos_a, -1, 1))))


def _angle_from_horizontal(a: np.ndarray, b: np.ndarray) -> float:
    vec = b - a
    cos_a = np.dot(vec, [1, 0]) / (np.linalg.norm(vec) + 1e-9)
    return float(np.degrees(np.arccos(np.clip(cos_a, -1, 1))))


def _curvature_ratio(p1: np.ndarray, p2: np.ndarray, p3: np.ndarray) -> float:
    chord = p3 - p1
    chord_len = np.linalg.norm(chord)
    if chord_len < 1e-6:
        return 0.0
    t = np.dot(p2 - p1, chord) / (chord_len**2)
    proj = p1 + t * chord
    sagitta = np.linalg.norm(p2 - proj)
    return float(sagitta / chord_len)


def _eye_aspect_ratio(
    landmark_map: dict[int, np.ndarray],
    w: int,
    h: int,
    p1: int,
    p2: int,
    p3: int,
    p4: int,
    p5: int,
    p6: int,
) -> float:
    pts = [_lm_px(landmark_map, i, w, h) for i in (p1, p2, p3, p4, p5, p6)]
    vertical = np.linalg.norm(pts[1] - pts[5]) + np.linalg.norm(pts[2] - pts[4])
    horizontal = np.linalg.norm(pts[0] - pts[3])
    return float(vertical / (2 * horizontal + 1e-9))


def _point_line_deviation_px(point: np.ndarray, a: np.ndarray, b: np.ndarray) -> float:
    ab = b - a
    t = np.dot(point - a, ab) / (np.dot(ab, ab) + 1e-9)
    proj = a + t * ab
    return float(np.linalg.norm(point - proj))


def _metric(value: Any, unit: str, *, scale: Optional[str] = None) -> dict:
    out = {"value": value, "unit": unit}
    if scale:
        out["scale"] = scale
    return out


def compute_parsing_metrics(
    landmarks: list,
    image_width: int,
    image_height: int,
    labels: Optional[np.ndarray] = None,
) -> dict[str, dict[str, dict]]:
    """Return metrics keyed by FEATURE_SECTIONS id (eyebrows, eyes, ...)."""
    w, h = image_width, image_height
    lm = _lm_dict(landmarks)
    if len(lm) < 10:
        return {}

    def px(idx: int) -> np.ndarray:
        return _lm_px(lm, idx, w, h)

    FOREHEAD_TOP = 10
    GLABELLA = 9
    NOSE_TIP = 4
    NOSE_BRIDGE = 168
    SUBNASALE = 2
    MENTON = 152
    R_ZYGION = 234
    L_ZYGION = 454
    R_TEMPLE = 127
    L_TEMPLE = 356
    R_GONION = 172
    L_GONION = 397
    R_BROW_INNER, R_BROW_PEAK, R_BROW_OUTER = 55, 105, 70
    L_BROW_INNER, L_BROW_PEAK, L_BROW_OUTER = 285, 334, 300
    R_EYE_TOP, R_EYE_BOTTOM = 159, 145
    L_EYE_TOP, L_EYE_BOTTOM = 386, 374
    R_ALA, L_ALA = 129, 358
    R_BRIDGE_SIDE, L_BRIDGE_SIDE = 236, 456
    R_INNER_CANTHUS, L_INNER_CANTHUS = 133, 362
    MOUTH_R, MOUTH_L = 61, 291
    CUPID_DIP = 0
    CUPID_PEAK_R, CUPID_PEAK_L = 37, 267
    LOWER_LIP_BOTTOM = 17
    CHIN_R, CHIN_L = 214, 434

    face_width_px = _dist_px(px(R_ZYGION), px(L_ZYGION))
    face_height_px = _dist_px(px(FOREHEAD_TOP), px(MENTON))
    ipd_px = _dist_px(px(33), px(263))
    mm_per_px = ASSUMED_IPD_MM / (ipd_px + 1e-9)
    nose_width_px = _dist_px(px(R_ALA), px(L_ALA))
    nose_height_px = _dist_px(px(NOSE_BRIDGE), px(SUBNASALE))
    intercanthal_px = _dist_px(px(R_INNER_CANTHUS), px(L_INNER_CANTHUS))
    mouth_width_px = _dist_px(px(MOUTH_R), px(MOUTH_L))
    jaw_width_px = _dist_px(px(R_GONION), px(L_GONION))

    raw: dict[str, dict] = {}

    raw["eyebrow"] = {
        "right_brow_peak_height_mm": _metric(
            abs(px(R_BROW_PEAK)[1] - px(R_EYE_TOP)[1]) * mm_per_px, "mm", scale=SCALE_KEY
        ),
        "left_brow_peak_height_mm": _metric(
            abs(px(L_BROW_PEAK)[1] - px(L_EYE_TOP)[1]) * mm_per_px, "mm", scale=SCALE_KEY
        ),
        "right_brow_elevation_ratio": _metric(
            abs(px(R_BROW_PEAK)[1] - px(R_EYE_TOP)[1]) / (ipd_px + 1e-9), "ratio"
        ),
        "left_brow_elevation_ratio": _metric(
            abs(px(L_BROW_PEAK)[1] - px(L_EYE_TOP)[1]) / (ipd_px + 1e-9), "ratio"
        ),
        "right_brow_apex_angle_deg": _metric(
            _angle_deg(px(R_BROW_PEAK), px(R_BROW_INNER), px(R_BROW_OUTER)), "deg"
        ),
        "left_brow_apex_angle_deg": _metric(
            _angle_deg(px(L_BROW_PEAK), px(L_BROW_INNER), px(L_BROW_OUTER)), "deg"
        ),
    }

    raw["eye"] = {
        "right_eye_aspect_ratio": _metric(_eye_aspect_ratio(lm, w, h, 33, 160, 158, 133, 153, 144), "ratio"),
        "left_eye_aspect_ratio": _metric(_eye_aspect_ratio(lm, w, h, 362, 385, 387, 263, 373, 380), "ratio"),
        "eye_spacing_ipd_over_face_width": _metric(ipd_px / (face_width_px + 1e-9), "ratio"),
        "right_lower_eyelid_curvature": _metric(_curvature_ratio(px(33), px(R_EYE_BOTTOM), px(133)), "ratio"),
        "left_lower_eyelid_curvature": _metric(_curvature_ratio(px(362), px(L_EYE_BOTTOM), px(263)), "ratio"),
    }

    raw["nose"] = {
        "nasal_width_mm": _metric(nose_width_px * mm_per_px, "mm", scale=SCALE_KEY),
        "nasal_height_mm": _metric(nose_height_px * mm_per_px, "mm", scale=SCALE_KEY),
        "nasal_aspect_ratio_width_over_height": _metric(nose_width_px / (nose_height_px + 1e-9), "ratio"),
        "naso_canthal_ratio_nose_width_over_intercanthal": _metric(
            nose_width_px / (intercanthal_px + 1e-9), "ratio"
        ),
        "pyramidal_width_mm": _metric(_dist_px(px(R_BRIDGE_SIDE), px(L_BRIDGE_SIDE)) * mm_per_px, "mm", scale=SCALE_KEY),
    }

    raw["lips"] = {
        "mouth_width_mm": _metric(mouth_width_px * mm_per_px, "mm", scale=SCALE_KEY),
        "philtrum_length_mm": _metric(_dist_px(px(SUBNASALE), px(CUPID_DIP)) * mm_per_px, "mm", scale=SCALE_KEY),
        "cupids_bow_angle_deg": _metric(_angle_deg(px(CUPID_DIP), px(CUPID_PEAK_R), px(CUPID_PEAK_L)), "deg"),
    }

    raw["cheeks"] = {
        "facial_width_mm": _metric(face_width_px * mm_per_px, "mm", scale=SCALE_KEY),
        "malar_width_ratio_powell": _metric(face_width_px / (face_height_px + 1e-9), "ratio"),
        "right_cheekbone_vertical_position_ratio": _metric(
            (px(R_ZYGION)[1] - px(FOREHEAD_TOP)[1]) / (face_height_px + 1e-9), "ratio"
        ),
        "left_cheekbone_vertical_position_ratio": _metric(
            (px(L_ZYGION)[1] - px(FOREHEAD_TOP)[1]) / (face_height_px + 1e-9), "ratio"
        ),
    }

    raw["jaw"] = {
        "frontal_jaw_rise_mm": _metric(abs(px(R_GONION)[1] - px(MENTON)[1]) * mm_per_px, "mm", scale=SCALE_KEY),
        "jaw_width_mm": _metric(jaw_width_px * mm_per_px, "mm", scale=SCALE_KEY),
        "right_jaw_inclination_angle_deg": _metric(_angle_from_horizontal(px(R_GONION), px(MENTON)), "deg"),
        "left_jaw_inclination_angle_deg": _metric(_angle_from_horizontal(px(L_GONION), px(MENTON)), "deg"),
        "face_width_mm": _metric(face_width_px * mm_per_px, "mm", scale=SCALE_KEY),
    }

    raw["chin"] = {
        "chin_width_mm": _metric(_dist_px(px(CHIN_R), px(CHIN_L)) * mm_per_px, "mm", scale=SCALE_KEY),
        "chin_vertical_height_mm": _metric(_dist_px(px(LOWER_LIP_BOTTOM), px(MENTON)) * mm_per_px, "mm", scale=SCALE_KEY),
        "chin_midline_deviation_mm": _metric(
            _point_line_deviation_px(px(MENTON), px(GLABELLA), px(NOSE_TIP)) * mm_per_px, "mm", scale=SCALE_KEY
        ),
    }

    raw["hair"] = {
        "forehead_width_mm": _metric(_dist_px(px(R_TEMPLE), px(L_TEMPLE)) * mm_per_px, "mm", scale=SCALE_KEY),
        "forehead_height_mm_mesh_approx": _metric(
            _dist_px(px(FOREHEAD_TOP), px(GLABELLA)) * mm_per_px, "mm", scale=SCALE_KEY
        ),
        "right_temple_inclination_angle_deg": _metric(_angle_from_vertical(px(R_TEMPLE), px(R_ZYGION)), "deg"),
        "left_temple_inclination_angle_deg": _metric(_angle_from_vertical(px(L_TEMPLE), px(L_ZYGION)), "deg"),
    }

    raw["smile"] = {
        "upper_smile_arc_curvature": _metric(_curvature_ratio(px(MOUTH_R), px(CUPID_DIP), px(MOUTH_L)), "ratio"),
        "lower_smile_arc_curvature": _metric(
            _curvature_ratio(px(MOUTH_R), px(LOWER_LIP_BOTTOM), px(MOUTH_L)), "ratio"
        ),
        "smile_width_mm": _metric(mouth_width_px * mm_per_px, "mm", scale=SCALE_KEY),
    }

    if labels is not None:
        neck_mask = labels == 17
        ys, xs = np.where(neck_mask)
        if len(xs) > 0:
            neck_width_px = float(xs.max() - xs.min())
            raw["neck"] = {
                "neck_width_mm": _metric(neck_width_px * mm_per_px, "mm", scale=SCALE_KEY),
                "neck_width_to_jaw_width_ratio": _metric(neck_width_px / (jaw_width_px + 1e-9), "ratio"),
            }
        else:
            raw["neck"] = {
                "neck_width_mm": _metric(None, "mm", scale=SCALE_KEY),
                "neck_width_to_jaw_width_ratio": _metric(None, "ratio"),
            }

    out: dict[str, dict[str, dict]] = {}
    for feature_id, raw_key in FEATURE_METRIC_KEYS.items():
        if raw_key in raw:
            out[feature_id] = raw[raw_key]
    return out
