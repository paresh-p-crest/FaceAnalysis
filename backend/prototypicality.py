"""Proportion-conformity engine (client label: Prototypicality).

Compares 5 facial ratios against fixed ideal proportion targets (questionnaire-
adjusted constants). NOT a population database or live cohort morphospace.

See docs/architecture/prototypicality.md for methodology.
"""

from __future__ import annotations

import math
from typing import Any, Optional

from .face_crop import FACE_OVAL, RIGHT_EYE, LEFT_EYE, RIGHT_BROW, LEFT_BROW, lm

DEFAULT_NORMS = {
    # MediaPipe-calibrated: gonial jaw width / forehead–chin height
    "faceWidthHeight": 0.90,
    # Alar width / bizygomatic (cheek) width
    "noseRatio": 0.30,
    "upperThird": 0.31,
    "middleThird": 0.27,
    "lowerThird": 0.42,
}

ETHNICITY_NORMS = {
    "east-asian": {"faceWidthHeight": 0.88, "noseRatio": 0.28, "upperThird": 0.30, "middleThird": 0.28, "lowerThird": 0.42},
    "south-asian": {"faceWidthHeight": 0.89, "noseRatio": 0.30, "upperThird": 0.31, "middleThird": 0.27, "lowerThird": 0.42},
    "southeast-asian": {"faceWidthHeight": 0.88, "noseRatio": 0.28, "upperThird": 0.30, "middleThird": 0.28, "lowerThird": 0.42},
    "middle-eastern": {"faceWidthHeight": 0.91, "noseRatio": 0.31, "upperThird": 0.31, "middleThird": 0.27, "lowerThird": 0.41},
    "black": {"faceWidthHeight": 0.92, "noseRatio": 0.32, "upperThird": 0.32, "middleThird": 0.26, "lowerThird": 0.42},
    "white": {"faceWidthHeight": 0.90, "noseRatio": 0.30, "upperThird": 0.31, "middleThird": 0.27, "lowerThird": 0.42},
    "hispanic": {"faceWidthHeight": 0.90, "noseRatio": 0.30, "upperThird": 0.31, "middleThird": 0.27, "lowerThird": 0.42},
    "mixed": {"faceWidthHeight": 0.90, "noseRatio": 0.30, "upperThird": 0.31, "middleThird": 0.27, "lowerThird": 0.42},
}

GENDER_NORMS = {
    "masculine": {"faceWidthHeight": 0.03, "noseRatio": 0.015},
    "feminine": {"faceWidthHeight": -0.03, "noseRatio": -0.012},
    "no-preference": {"faceWidthHeight": 0.0, "noseRatio": 0.0},
}

# Weights for 5-ratio conformity (tuned heuristics — see prototypicality.md)
SCORE_WEIGHTS = {
    "jaw width": 0.24,
    "facial thirds": 0.22,
    "symmetry": 0.10,
    "nose": 0.22,
    "brows": 0.22,
}

# Maps typical MediaPipe faces to mid-70s (Qoves-calibrated).
SCORE_BASE = 84.0
SCORE_PENALTY_SCALE = 195.0
MAX_FEATURE_MAGNITUDE = 0.38

METHODOLOGY = "five_ratio_proportion_conformity"


def _subsample(indices: list, target: int) -> list:
    if len(indices) <= target:
        return list(indices)
    return [indices[round(i * (len(indices) - 1) / (target - 1))] for i in range(target)]


FEATURE_TOPOLOGY = [
    {"id": "jaw", "type": "polyline", "indices": FACE_OVAL, "strokeWidth": 1.1, "fill": False},
    {"id": "browR", "type": "polyline", "indices": _subsample(RIGHT_BROW, 11), "strokeWidth": 1.25, "fill": False},
    {"id": "browL", "type": "polyline", "indices": _subsample(LEFT_BROW, 11), "strokeWidth": 1.25, "fill": False},
    {"id": "eyeR", "type": "polyline", "indices": _subsample(RIGHT_EYE, 14), "strokeWidth": 1.0, "fill": False},
    {"id": "eyeL", "type": "polyline", "indices": _subsample(LEFT_EYE, 14), "strokeWidth": 1.0, "fill": False},
    {"id": "noseBridge", "type": "polyline", "indices": [168, 6, 197, 195, 5, 4, 1], "strokeWidth": 1.05, "fill": False},
    {"id": "noseWing", "type": "polyline", "indices": [98, 97, 2, 326, 327], "strokeWidth": 1.0, "fill": False},
    {"id": "lipUpper", "type": "polyline", "indices": [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], "strokeWidth": 1.05, "fill": False},
    {"id": "lipLower", "type": "polyline", "indices": [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], "strokeWidth": 1.05, "fill": False},
]


def get_prototypicality_norms(answers: Optional[dict] = None) -> dict:
    answers = answers or {}
    ethnicity = answers.get("ethnicity") or ""
    gender_pref = answers.get("genderPreference") or answers.get("gender") or "no-preference"
    ethnic = ETHNICITY_NORMS.get(ethnicity, {})
    gender = GENDER_NORMS.get(gender_pref, GENDER_NORMS["no-preference"])
    return {
        "faceWidthHeight": ethnic.get("faceWidthHeight", DEFAULT_NORMS["faceWidthHeight"]) + gender.get("faceWidthHeight", 0),
        "noseRatio": ethnic.get("noseRatio", DEFAULT_NORMS["noseRatio"]) + gender.get("noseRatio", 0),
        "upperThird": ethnic.get("upperThird", DEFAULT_NORMS["upperThird"]),
        "middleThird": ethnic.get("middleThird", DEFAULT_NORMS["middleThird"]),
        "lowerThird": ethnic.get("lowerThird", DEFAULT_NORMS["lowerThird"]),
        "cohortKey": f"{ethnicity or 'default'}:{gender_pref or 'default'}",
    }


def prototypicality_range_label(score: int) -> str:
    if score >= 82:
        return "Highly Typical"
    if score >= 70:
        return "Quite Typical"
    if score >= 55:
        return "Moderately Typical"
    if score >= 35:
        return "Somewhat Unique"
    return "Distinctive"


def _score_label(score: int) -> str:
    if score >= 85:
        return "Highly Average"
    if score >= 70:
        return "Above Average"
    if score >= 55:
        return "Average"
    return "Distinctive"


def _symmetry_score(landmarks: list, metrics: Optional[dict]) -> int:
    from .cv_report import symmetry_score
    return symmetry_score(landmarks, metrics)


def _dist(a: dict, b: dict) -> float:
    return ((a["x"] - b["x"]) ** 2 + (a["y"] - b["y"]) ** 2) ** 0.5


def _square_bounds(landmarks: list) -> dict:
    pts = [lm(landmarks, i) for i in FACE_OVAL]
    xs = [p["x"] for p in pts]
    ys = [p["y"] for p in pts]
    pad = 0.06
    min_x, max_x = min(xs) - pad, max(xs) + pad
    min_y, max_y = min(ys) - pad, max(ys) + pad
    cx, cy = (min_x + max_x) / 2, (min_y + max_y) / 2
    size = max(max_x - min_x, max_y - min_y) * 1.08
    return {"minX": cx - size / 2, "minY": cy - size / 2, "w": size, "h": size}


def _to_svg(landmarks: list, idx: int, bounds: dict) -> tuple[float, float]:
    p = lm(landmarks, idx)
    x = ((p["x"] - bounds["minX"]) / bounds["w"]) * 100
    y = ((p["y"] - bounds["minY"]) / bounds["h"]) * 100
    return x, y


def _build_feature_layers(landmarks: list, bounds: dict) -> list:
    layers = []
    for feat in FEATURE_TOPOLOGY:
        pts = [_to_svg(landmarks, idx, bounds) for idx in feat["indices"]]
        points = " ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
        if points:
            layers.append({
                "id": feat["id"],
                "type": feat["type"],
                "fill": feat["fill"],
                "strokeWidth": feat["strokeWidth"],
                "points": points,
            })
    return layers


def _place_polyline_arc(landmarks: list, indices: list, cx: float, cy: float, rx: float, ry: float, start: float, end: float) -> None:
    n = len(indices)
    if n < 1:
        return
    for i, idx in enumerate(indices):
        t = i / (n - 1) if n > 1 else 0.5
        angle = start + (end - start) * t
        landmarks[idx] = {"x": cx + rx * math.cos(angle), "y": cy + ry * math.sin(angle), "z": 0.0}


def _synthetic_ideal_landmarks(bounds: dict, norms: dict) -> list:
    """Ideal face template from norms + user bounds only — zero user landmark input."""
    landmarks: list[dict] = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]

    top = bounds["minY"] + bounds["h"] * 0.07
    bottom = bounds["minY"] + bounds["h"] * 0.93
    fh = bottom - top
    fw = norms["faceWidthHeight"] * fh
    cx = bounds["minX"] + bounds["w"] * 0.5

    brow_y = top + fh * norms["upperThird"]
    nose_tip_y = brow_y + fh * norms["middleThird"]
    lip_y = nose_tip_y + fh * norms["lowerThird"] * 0.55
    eye_y = brow_y + fh * norms["middleThird"] * 0.32
    eye_half = fw * 0.11
    nose_half = fw * norms["noseRatio"] * 0.5

    landmarks[10] = {"x": cx, "y": top, "z": 0.0}
    landmarks[152] = {"x": cx, "y": bottom, "z": 0.0}
    landmarks[1] = {"x": cx, "y": nose_tip_y, "z": 0.0}
    landmarks[2] = {"x": cx, "y": nose_tip_y - fh * norms["middleThird"] * 0.15, "z": 0.0}
    jaw_half = fw * 0.5
    landmarks[172] = {"x": cx - jaw_half, "y": bottom - fh * 0.12, "z": 0.0}
    landmarks[397] = {"x": cx + jaw_half, "y": bottom - fh * 0.12, "z": 0.0}
    landmarks[127] = {"x": cx - fw * 0.5, "y": brow_y + fh * 0.08, "z": 0.0}
    landmarks[356] = {"x": cx + fw * 0.5, "y": brow_y + fh * 0.08, "z": 0.0}
    landmarks[234] = {"x": cx - fw * 0.48, "y": bottom - fh * 0.08, "z": 0.0}
    landmarks[454] = {"x": cx + fw * 0.48, "y": bottom - fh * 0.08, "z": 0.0}

    for k, idx in enumerate(FACE_OVAL):
        angle = -math.pi / 2 + (2 * math.pi * k / len(FACE_OVAL))
        landmarks[idx] = {
            "x": cx + (fw * 0.5) * math.cos(angle),
            "y": top + fh * 0.5 + (fh * 0.5) * math.sin(angle),
            "z": 0.0,
        }

    _place_polyline_arc(landmarks, _subsample(RIGHT_EYE, 14), cx - eye_half * 2.2, eye_y, eye_half, fh * 0.04, math.pi * 0.15, math.pi * 0.85)
    _place_polyline_arc(landmarks, _subsample(LEFT_EYE, 14), cx + eye_half * 2.2, eye_y, eye_half, fh * 0.04, math.pi * 0.85, math.pi * 1.85)
    _place_polyline_arc(landmarks, _subsample(RIGHT_BROW, 11), cx - eye_half * 2.2, brow_y - fh * 0.02, eye_half * 1.3, fh * 0.025, math.pi * 0.1, math.pi * 0.9)
    _place_polyline_arc(landmarks, _subsample(LEFT_BROW, 11), cx + eye_half * 2.2, brow_y - fh * 0.02, eye_half * 1.3, fh * 0.025, math.pi * 0.9, math.pi * 1.9)

    for i, idx in enumerate([168, 6, 197, 195, 5, 4, 1]):
        t = i / 6
        landmarks[idx] = {"x": cx, "y": top + t * (nose_tip_y - top), "z": 0.0}
    for i, idx in enumerate([98, 97, 2, 326, 327]):
        t = (i - 2) / 2
        landmarks[idx] = {"x": cx + nose_half * t, "y": nose_tip_y + fh * 0.02, "z": 0.0}

    _place_polyline_arc(landmarks, [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], cx, lip_y - fh * 0.02, fw * 0.14, fh * 0.025, math.pi * 0.05, math.pi * 0.95)
    _place_polyline_arc(landmarks, [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], cx, lip_y + fh * 0.03, fw * 0.12, fh * 0.03, math.pi * 1.05, math.pi * 1.95)

    landmarks[33] = {"x": cx - eye_half * 2.2, "y": eye_y, "z": 0.0}
    landmarks[263] = {"x": cx + eye_half * 2.2, "y": eye_y, "z": 0.0}
    landmarks[48] = {"x": cx - nose_half, "y": nose_tip_y, "z": 0.0}
    landmarks[278] = {"x": cx + nose_half, "y": nose_tip_y, "z": 0.0}

    return landmarks


def _face_proportions(landmarks: list) -> dict:
    """Shared brow-line (eye-center) for thirds; jaw/cheek widths from gonial + zygomatic landmarks."""
    jaw_l = lm(landmarks, 172)
    jaw_r = lm(landmarks, 397)
    cheek_l = lm(landmarks, 127)
    cheek_r = lm(landmarks, 356)
    chin = lm(landmarks, 152)
    forehead = lm(landmarks, 10)
    subnasale = lm(landmarks, 2)
    eye_l = lm(landmarks, 33)
    eye_r = lm(landmarks, 263)

    face_h = chin["y"] - forehead["y"] or 0.3
    jaw_w = abs(jaw_r["x"] - jaw_l["x"]) or 0.3
    cheek_w = abs(cheek_r["x"] - cheek_l["x"]) or jaw_w
    brow_line_y = (eye_l["y"] + eye_r["y"]) / 2

    return {
        "face_h": face_h,
        "face_w": cheek_w,
        "jaw_w": jaw_w,
        "face_ratio": jaw_w / face_h,
        "brow_line_y": brow_line_y,
        "upper_third": (brow_line_y - forehead["y"]) / face_h,
        "middle_third": (subnasale["y"] - brow_line_y) / face_h,
        "lower_third": (chin["y"] - subnasale["y"]) / face_h,
        "nose_ratio": _dist(lm(landmarks, 48), lm(landmarks, 278)) / cheek_w,
    }


def _relative_error(measured: float, ideal: float) -> float:
    return min(MAX_FEATURE_MAGNITUDE, abs(measured - ideal) / max(abs(ideal), 0.05))


def _measure_deviations(landmarks: list, metrics: Optional[dict], norms: dict) -> list:
    props = _face_proportions(landmarks)
    sym_score = _symmetry_score(landmarks, metrics)
    brow_line_rel = (props["brow_line_y"] - lm(landmarks, 10)["y"]) / props["face_h"]

    items = [
        {
            "feature": "jaw width",
            "magnitude": _relative_error(props["face_ratio"], norms["faceWidthHeight"]),
            "direction": "narrower" if props["face_ratio"] < norms["faceWidthHeight"] else "wider",
        },
        {
            "feature": "nose",
            "magnitude": _relative_error(props["nose_ratio"], norms["noseRatio"]),
            "direction": "narrower" if props["nose_ratio"] < norms["noseRatio"] else "broader",
        },
        {
            "feature": "brows",
            "magnitude": _relative_error(brow_line_rel, norms["upperThird"]),
            "direction": "lower" if brow_line_rel < norms["upperThird"] else "higher",
        },
        {
            "feature": "facial thirds",
            "magnitude": min(
                MAX_FEATURE_MAGNITUDE,
                (
                    abs(props["upper_third"] - norms["upperThird"])
                    + abs(props["middle_third"] - norms["middleThird"])
                    + abs(props["lower_third"] - norms["lowerThird"])
                ) / 3,
            ),
            "direction": "shifted",
        },
        {
            "feature": "symmetry",
            "magnitude": min(MAX_FEATURE_MAGNITUDE, max(0, 80 - sym_score) / 120),
            "direction": "more asymmetric" if sym_score < 80 else "balanced",
        },
    ]
    return sorted(items, key=lambda d: d["magnitude"], reverse=True)


def _build_explanation(deviations: list, score: int) -> str:
    notable = [d for d in deviations if d["magnitude"] > 0.04 and d["direction"] not in ("balanced", "shifted")][:3]
    if score >= 70:
        if not notable:
            return (
                "You sit on the typical side overall: central features and skin quality are very average, "
                "with proportions that align closely to your demographic norm."
            )
        phrases = []
        for d in notable:
            if d["feature"] == "brows":
                adj = "higher, thicker" if d["direction"] == "higher" else "lower"
                phrases.append(f"{adj} brows")
            elif d["feature"] == "nose":
                adj = "straighter" if d["direction"] == "narrower" else "broader"
                phrases.append(f"a {adj} nose")
            elif d["feature"] == "jaw width":
                adj = "narrower" if d["direction"] == "narrower" else "wider"
                phrases.append(f"a {adj} jaw")
            else:
                phrases.append(d["feature"])
        return (
            "You sit on the typical side overall: central features and skin quality are very average, "
            f"while {', '.join(phrases)} add moderate distinctiveness without moving you far from the demographic norm."
        )
    if not notable:
        return (
            "Your key facial ratios align closely with the ideal proportion targets for your selected profile."
            if score >= 70
            else "Your ratios show a mix of conformity and variation relative to the ideal proportion targets."
        )
    phrases = []
    for d in notable:
        if d["feature"] == "brows":
            phrases.append(f"{d['direction']} brow line")
        elif d["feature"] == "nose":
            phrases.append(f"a {d['direction']} nose")
        elif d["feature"] == "jaw width":
            phrases.append(f"a {d['direction']} jaw")
        else:
            phrases.append(f"{d['direction']} {d['feature']}")
    if score >= 70:
        return (
            f"Overall your proportions sit close to the ideal targets; minor variation shows in {', '.join(phrases)}."
        )
    return (
        f"Compared to the ideal proportion targets, notable variation appears in {', '.join(phrases)}."
    )


def _compute_score(deviations: list) -> int:
    weighted = sum(d["magnitude"] * SCORE_WEIGHTS.get(d["feature"], 0.15) for d in deviations)
    penalty = weighted * SCORE_PENALTY_SCALE
    return max(25, min(96, round(SCORE_BASE - penalty)))


def compute_prototypicality_report(
    landmarks: list,
    metrics: Optional[dict] = None,
    answers: Optional[dict] = None,
) -> dict[str, Any]:
    if not landmarks:
        return {
            "score": None, "label": None, "rangeLabel": None,
            "scaleLeft": "Distinctive", "scaleRight": "Highly Typical",
            "explanation": None, "deviations": [], "wireframe": None,
            "methodology": METHODOLOGY,
        }

    norms = get_prototypicality_norms(answers)
    deviations = _measure_deviations(landmarks, metrics, norms)
    score = _compute_score(deviations)
    props = _face_proportions(landmarks)
    sym_score = _symmetry_score(landmarks, metrics)

    bounds = _square_bounds(landmarks)
    ideal_landmarks = _synthetic_ideal_landmarks(bounds, norms)

    return {
        "score": score,
        "label": _score_label(score),
        "rangeLabel": prototypicality_range_label(score),
        "scaleLeft": "Distinctive",
        "scaleRight": "Highly Typical",
        "explanation": _build_explanation(deviations, score),
        "methodology": METHODOLOGY,
        "cohortKey": norms["cohortKey"],
        "faceRatio": {
            "value": f"{props['face_ratio']:.2f}",
            "ideal": f"{norms['faceWidthHeight']:.2f}",
            "deviation": f"{abs(props['face_ratio'] - norms['faceWidthHeight']) / norms['faceWidthHeight'] * 100:.1f}",
        },
        "proportions": {
            "upper": f"{props['upper_third']:.2f}",
            "middle": f"{props['middle_third']:.2f}",
            "lower": f"{props['lower_third']:.2f}",
            "deviation": f"{(abs(props['upper_third'] - norms['upperThird']) * 100 + abs(props['middle_third'] - norms['middleThird']) * 100 + abs(props['lower_third'] - norms['lowerThird']) * 100):.1f}",
        },
        "symmetry": {"score": sym_score, "deviation": f"{max(0, 100 - sym_score):.1f}"},
        "nose": {
            "ratio": f"{props['nose_ratio']:.2f}",
            "ideal": f"{norms['noseRatio']:.2f}",
            "deviation": f"{abs(props['nose_ratio'] - norms['noseRatio']) / norms['noseRatio'] * 100:.1f}",
        },
        "deviations": [{"feature": d["feature"], "direction": d["direction"], "magnitude": round(d["magnitude"], 3)} for d in deviations],
        "wireframe": {
            "viewBox": "0 0 100 100",
            "userFeatures": _build_feature_layers(landmarks, bounds),
            "averageFeatures": _build_feature_layers(ideal_landmarks, bounds),
        },
    }
