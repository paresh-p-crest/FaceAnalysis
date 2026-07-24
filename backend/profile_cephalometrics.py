"""Lateral profile cephalometrics from profile photos."""

from __future__ import annotations

import math
from typing import Optional

from .face_crop import lm
from .profile_silhouette import extract_profile_silhouette_points

# Visible-side ear contour: rightProfile shows person's RIGHT side → right-ear mesh;
# leftProfile shows person's LEFT side → left-ear mesh.
RIGHT_PROFILE_EAR = (234, 127, 132, 93, 58, 172, 136, 150)
LEFT_PROFILE_EAR = (356, 454, 323, 361, 288, 397, 365, 379)

# Keys used by cephalometric formulas — prefer silhouette when present
_SILHOUETTE_KEYS = (
    "glabella",
    "nasion",
    "pronasale",
    "subnasale",
    "upperLip",
    "lowerLip",
    "pogonion",
    "menton",
    "bridgeMid",
    "gonion",
    "earTop",
    "earBottom",
    "noseTop",
    "noseBottom",
)


def _dist(a: dict, b: dict) -> float:
    return math.hypot(a["x"] - b["x"], a["y"] - b["y"])


def _angle_deg(a: dict, vertex: dict, c: dict) -> float:
    ab = (a["x"] - vertex["x"], a["y"] - vertex["y"])
    cb = (c["x"] - vertex["x"], c["y"] - vertex["y"])
    dot = ab[0] * cb[0] + ab[1] * cb[1]
    mag = math.hypot(*ab) * math.hypot(*cb)
    if mag < 1e-9:
        return 0.0
    return math.degrees(math.acos(max(-1.0, min(1.0, dot / mag))))


def _pct_y(y: float) -> float:
    return round(y * 100, 2)


def _pct_x(x: float) -> float:
    return round(x * 100, 2)


def _ear_span(landmarks: list, pose_id: str) -> tuple[dict, dict]:
    """Ear top/bottom on the visible profile side (Qoves naso-aural vertical span)."""
    indices = RIGHT_PROFILE_EAR if pose_id == "rightProfile" else LEFT_PROFILE_EAR
    pts = [lm(landmarks, i) for i in indices]
    top = min(pts, key=lambda p: p["y"])
    bottom = max(pts, key=lambda p: p["y"])
    return top, bottom


def _profile_landmarks(landmarks: list, pose_id: str) -> dict:
    ear_top, ear_bottom = _ear_span(landmarks, pose_id)
    # Visible-side gonion: right profile → person's right jaw (234).
    gonion_idx = 234 if pose_id == "rightProfile" else 454
    return {
        "glabella": lm(landmarks, 10),
        "nasion": lm(landmarks, 6),
        "subnasale": lm(landmarks, 2),
        "pronasale": lm(landmarks, 1),
        "pogonion": lm(landmarks, 152),
        "menton": lm(landmarks, 152),
        "gonion": lm(landmarks, gonion_idx),
        "bridgeMid": lm(landmarks, 168),
        "upperLip": lm(landmarks, 13),
        "lowerLip": lm(landmarks, 14),
        "earTop": ear_top,
        "earBottom": ear_bottom,
        "noseTop": lm(landmarks, 6),
        "noseBottom": lm(landmarks, 2),
    }


def _silhouette_soft_tissue_ok(sil_pts: dict) -> bool:
    """Reject collapsed silhouette contours (e.g. hair-only) that ruin G/Sn/Pog."""
    try:
        g = sil_pts["glabella"]["y"]
        sn = sil_pts["subnasale"]["y"]
        pog = sil_pts["pogonion"]["y"]
    except (KeyError, TypeError):
        return False
    ys = (g, sn, pog)
    span = max(ys) - min(ys)
    if span < 0.16:
        return False
    if max(ys) < 0.22 and span < 0.22:
        return False
    return True


def _merge_profile_points(
    mesh_pts: Optional[dict],
    sil_pts: Optional[dict],
) -> tuple[Optional[dict], str]:
    """Prefer silhouette anatomical points when plausible; else keep FaceMesh soft tissue."""
    if not sil_pts and not mesh_pts:
        return None, "unavailable"
    if sil_pts and not mesh_pts:
        return {k: sil_pts[k] for k in _SILHOUETTE_KEYS if k in sil_pts}, "silhouette"
    if mesh_pts and not sil_pts:
        return mesh_pts, "facemesh"

    merged = dict(mesh_pts)
    sil_ok = _silhouette_soft_tissue_ok(sil_pts)
    # Soft-tissue profile from silhouette only when G→Pog span looks like a face.
    # Ear helix→lobe from image still preferred over FaceMesh junction indices.
    soft_tissue = (
        "glabella",
        "nasion",
        "pronasale",
        "subnasale",
        "upperLip",
        "lowerLip",
        "pogonion",
        "menton",
        "bridgeMid",
        "noseTop",
        "noseBottom",
        "gonion",
    )
    ear_keys = ("earTop", "earBottom")
    if sil_ok:
        for key in soft_tissue:
            if key in sil_pts and isinstance(sil_pts[key], dict) and "x" in sil_pts[key]:
                merged[key] = sil_pts[key]
    for key in ear_keys:
        if key in sil_pts and isinstance(sil_pts[key], dict) and "x" in sil_pts[key]:
            merged[key] = sil_pts[key]
    if sil_ok:
        return merged, "silhouette+facemesh"
    return merged, "facemesh+silhouette_ears"


def build_naso_aural_proportion_overlay(pts: dict) -> dict:
    """Qoves-style ear/nose height brackets for ProportionFeatureOverlay (image 0–100).

    Short horizontal ticks at the ear and nose columns (not full-width guides) so the
    mapping stays readable on profile photos.
    """
    ear_x = _pct_x((pts["earTop"]["x"] + pts["earBottom"]["x"]) / 2)
    nose_x = _pct_x((pts["noseTop"]["x"] + pts["noseBottom"]["x"]) / 2)
    ear_top_y = _pct_y(pts["earTop"]["y"])
    ear_bot_y = _pct_y(pts["earBottom"]["y"])
    nose_top_y = _pct_y(pts["noseTop"]["y"])
    nose_bot_y = _pct_y(pts["noseBottom"]["y"])
    tick = 7.0

    return {
        "horizontal": [
            {"y": ear_top_y, "x1": ear_x - tick, "x2": ear_x + tick},
            {"y": ear_bot_y, "x1": ear_x - tick, "x2": ear_x + tick},
            {"y": nose_top_y, "x1": nose_x - tick, "x2": nose_x + tick},
            {"y": nose_bot_y, "x1": nose_x - tick, "x2": nose_x + tick},
        ],
        "segments": [
            {"x1": ear_x, "y1": ear_top_y, "x2": ear_x, "y2": ear_bot_y},
            {"x1": nose_x, "y1": nose_top_y, "x2": nose_x, "y2": nose_bot_y},
        ],
    }


def _facial_convexity(pts: dict) -> float:
    return round(_angle_deg(pts["glabella"], pts["subnasale"], pts["pogonion"]), 1)


def _classify_convexity(angle: float) -> str:
    if angle < 165:
        return "convex"
    if angle > 175:
        return "concave"
    return "orthognathic"


def _e_line_lip_distances(pts: dict) -> dict:
    """Signed perpendicular distance from lips to line pronasale→pogonion.

    Values are normalized-coordinate units × 100 (relative, not physical mm).
    """
    a, b = pts["pronasale"], pts["pogonion"]
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    line_len = math.hypot(dx, dy) or 1e-9

    def signed_dist(lip: dict) -> float:
        cross = (lip["x"] - a["x"]) * dy - (lip["y"] - a["y"]) * dx
        d_norm = cross / line_len
        sign = -1 if cross < 0 else 1
        return round(sign * d_norm * 100, 2)

    return {
        "eLineUpperLip": signed_dist(pts["upperLip"]),
        "eLineLowerLip": signed_dist(pts["lowerLip"]),
    }


def _naso_aural_ratio(pts: dict) -> float:
    """Ear vertical height / nose vertical height (nasion → subnasale), Qoves-style."""
    ear_h = abs(pts["earTop"]["y"] - pts["earBottom"]["y"])
    nose_h = abs(pts["noseTop"]["y"] - pts["noseBottom"]["y"])
    if nose_h < 1e-6:
        return 1.0
    return round(ear_h / nose_h, 2)


def _naso_aural_label(ratio: float) -> str:
    if ratio > 1.05:
        return "Ear > Nose"
    if ratio < 0.95:
        return "Ear < Nose"
    return "Ear ≈ Nose"


def _naso_aural_explanation(ratio: float) -> str:
    if ratio > 1.05:
        return (
            "Your taller ears compared with nasal height create a large vertical frame beside the midface "
            "which makes the side view feel more vertically extended and gives the central facial column "
            "a stronger supporting outline."
        )
    if ratio < 0.95:
        return (
            "Your shorter ears relative to nasal height keep the lateral frame more compact, "
            "so the midface column carries more of the vertical emphasis from the side."
        )
    return (
        "Your ear height aligns closely with nasal height, creating a balanced vertical frame "
        "beside the midface."
    )


def _nasolabial_angle(pts: dict) -> float:
    return round(_angle_deg(pts["pronasale"], pts["subnasale"], pts["upperLip"]), 1)


def _nasofrontal_angle(pts: dict) -> float:
    return round(_angle_deg(pts["glabella"], pts["nasion"], pts["pronasale"]), 1)


def _dorsal_hump_deviation(pts: dict) -> float:
    """Signed perpendicular deviation of bridge midpoint from nasion→pronasale line."""
    a, b = pts["nasion"], pts["pronasale"]
    mid = {
        "x": (a["x"] + b["x"]) / 2,
        "y": (a["y"] + b["y"]) / 2,
    }
    bridge = pts.get("bridgeMid") or mid
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    line_len = math.hypot(dx, dy) or 1e-9
    cross = (bridge["x"] - a["x"]) * dy - (bridge["y"] - a["y"]) * dx
    return round(cross / line_len, 4)


def _profile_gonial_angle(pts: dict) -> float:
    """Profile gonial angle at jaw corner between ramus and mandibular body."""
    gonion = pts.get("gonion") or pts["pogonion"]
    menton = pts.get("menton") or pts["pogonion"]
    tragus = pts.get("earTop") or pts["glabella"]
    return round(_angle_deg(tragus, gonion, menton), 1)


def _chin_projection_norm(pts: dict, facing_side: Optional[str] = None) -> float:
    """Horizontal distance from pogonion to vertical dropped from subnasale.

    Positive = chin ahead of the Sn vertical (toward the face's forward direction).
    """
    raw = pts["pogonion"]["x"] - pts["subnasale"]["x"]
    if facing_side == "left":
        # Face looks left (−x forward); flip so positive still means projected
        raw = -raw
    return round(raw, 4)


def analyze_profile(
    landmarks: Optional[list] = None,
    pose_id: str = "rightProfile",
    image_bytes: Optional[bytes] = None,
) -> Optional[dict]:
    mesh_pts = _profile_landmarks(landmarks, pose_id) if landmarks else None
    sil_pts = extract_profile_silhouette_points(image_bytes) if image_bytes else None
    pts, landmark_source = _merge_profile_points(mesh_pts, sil_pts)
    if not pts:
        return None

    facing = (sil_pts or {}).get("facingSide")
    if not facing:
        facing = "right" if pose_id == "rightProfile" else "left"

    convexity = _facial_convexity(pts)
    e_line = _e_line_lip_distances(pts)
    naso_aural = _naso_aural_ratio(pts)
    nasolabial = _nasolabial_angle(pts)
    nasofrontal = _nasofrontal_angle(pts)
    dorsal_hump = _dorsal_hump_deviation(pts)
    profile_gonial = _profile_gonial_angle(pts)
    chin_proj = _chin_projection_norm(pts, facing)
    ear_protrusion = round(abs(pts["earBottom"]["x"] - pts["pogonion"]["x"]), 4)
    naso_overlay = build_naso_aural_proportion_overlay(pts)

    return {
        "poseId": pose_id,
        "landmarkSource": landmark_source,
        "measurements": {
            "facialConvexityDeg": convexity,
            "nasolabialAngleDeg": nasolabial,
            "nasofrontalAngleDeg": nasofrontal,
            "dorsalHumpDeviation": dorsal_hump,
            "profileGonialAngleDeg": profile_gonial,
            "nasoAuralRatio": naso_aural,
            "chinProjectionNorm": chin_proj,
            "earProtrusionNorm": ear_protrusion,
            **e_line,
        },
        "classification": {
            "convexity": _classify_convexity(convexity),
            "chinProjection": "protruded" if chin_proj > 0.02 else ("recessed" if chin_proj < -0.02 else "balanced"),
            "nasoAural": _naso_aural_label(naso_aural),
        },
        "dataSource": "measured",
        "overlay": {
            "convexityPoints": [
                {"id": "G", "x": pts["glabella"]["x"], "y": pts["glabella"]["y"]},
                {"id": "N", "x": pts["nasion"]["x"], "y": pts["nasion"]["y"]},
                {"id": "Sn", "x": pts["subnasale"]["x"], "y": pts["subnasale"]["y"]},
                {"id": "Pog", "x": pts["pogonion"]["x"], "y": pts["pogonion"]["y"]},
            ],
            "eLine": [
                {"x": pts["pronasale"]["x"], "y": pts["pronasale"]["y"]},
                {"x": pts["pogonion"]["x"], "y": pts["pogonion"]["y"]},
            ],
            "nasoAural": naso_overlay,
        },
    }


def build_profile_report(
    views: dict,
    photos: Optional[dict] = None,
) -> dict:
    photos = photos or {}
    right45 = views.get("right45", {})
    left45 = views.get("left45", {})
    right = views.get("rightProfile", {})
    left = views.get("leftProfile", {})

    right45_lm = right45.get("landmarks", []) if right45.get("success") else []
    left45_lm = left45.get("landmarks", []) if left45.get("success") else []
    right_lm = right.get("landmarks", []) if right.get("success") else []
    left_lm = left.get("landmarks", []) if left.get("success") else []

    right45_bytes = photos.get("right45")
    left45_bytes = photos.get("left45")
    right_bytes = photos.get("rightProfile")
    left_bytes = photos.get("leftProfile")

    primary_pose = None
    if right45_lm or right45_bytes:
        primary_pose = "right45"
    elif right_lm or right_bytes:
        primary_pose = "rightProfile"
    elif left45_lm or left45_bytes:
        primary_pose = "left45"
    elif left_lm or left_bytes:
        primary_pose = "leftProfile"

    primary = None
    if primary_pose == "right45":
        primary = analyze_profile(right45_lm or None, "right45", right45_bytes)
    elif primary_pose == "rightProfile":
        primary = analyze_profile(right_lm or None, "rightProfile", right_bytes)
    elif primary_pose == "left45":
        primary = analyze_profile(left45_lm or None, "left45", left45_bytes)
    elif primary_pose == "leftProfile":
        primary = analyze_profile(left_lm or None, "leftProfile", left_bytes)

    left_analysis = (
        analyze_profile(left_lm or None, "leftProfile", left_bytes)
        if (left_lm or left_bytes)
        else None
    )
    right_analysis = (
        analyze_profile(right_lm or None, "rightProfile", right_bytes)
        if (right_lm or right_bytes)
        else None
    )

    asymmetry = {}
    if left_analysis and right_analysis:
        lc = left_analysis["measurements"]["facialConvexityDeg"]
        rc = right_analysis["measurements"]["facialConvexityDeg"]
        asymmetry = {
            "convexityDelta": round(abs(lc - rc), 1),
            "chinProjectionDelta": round(
                abs(
                    left_analysis["measurements"]["chinProjectionNorm"]
                    - right_analysis["measurements"]["chinProjectionNorm"]
                ),
                4,
            ),
        }

    return {
        "primaryView": primary_pose,
        "rightProfile": right_analysis,
        "leftProfile": left_analysis,
        "primary": primary,
        "asymmetry": asymmetry,
        "dataSource": "measured" if primary else "unavailable",
    }
