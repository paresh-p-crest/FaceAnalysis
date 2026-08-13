"""Naso-aural ratio enrichment — per-profile variants + admin pose selection."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Optional

from .ear_analysis import (
    build_naso_aural_caliper_overlay,
    pick_profile_ear_side,
    resolve_nose_points_for_profile,
)
from .naso_aural_guide_overlay import nose_height_norm_from_guides, patch_naso_aural_guides
from .profile_cephalometrics import _naso_aural_explanation, _naso_aural_label
from . import cv_report_explanations_de as expl_de

_SIDE_KEYS = (("right", "rightProfile"), ("left", "leftProfile"))


def _side_usable_for_naso(side: dict | None) -> bool:
    if not isinstance(side, dict):
        return False
    meas = side.get("measurements") or {}
    if not meas.get("verticalHeightNorm") or not meas.get("helixTop"):
        return False
    return bool(meas.get("softBottom") or meas.get("lobeBottom"))


def build_naso_aural_variant(
    cv_report: dict,
    photos: dict[str, bytes],
    side: dict,
    base_naso: dict,
) -> Optional[dict[str, Any]]:
    """Build one profile's naso-aural payload (overlay, ratio, guides)."""
    meas = side.get("measurements") or {}
    ear_h = meas.get("verticalHeightNorm")
    pose_id = side.get("poseId") or "rightProfile"
    nose_top, nose_bot = resolve_nose_points_for_profile(cv_report, pose_id, base_naso)
    if not nose_top or not nose_bot or ear_h is None:
        return None
    nose_h = abs(float(nose_bot["y"]) - float(nose_top["y"]))
    if float(nose_h) <= 1e-6 or float(ear_h) <= 1e-6:
        return None
    if not meas.get("helixTop") or not (meas.get("softBottom") or meas.get("lobeBottom")):
        return None

    ratio = round(float(ear_h) / float(nose_h), 2)
    facing_right = pose_id != "leftProfile"
    qoves_overlay = build_naso_aural_caliper_overlay(
        ear_measurements=meas,
        nose_top=nose_top,
        nose_bottom=nose_bot,
        facing_right=facing_right,
    )
    bracket_ids = {b.get("id") for b in (qoves_overlay.get("brackets") or [])}
    if "earVertical" not in bracket_ids:
        return None

    naso = {
        **base_naso,
        "yourValue": ratio,
        "yourLabel": _naso_aural_label(ratio),
        "explanation": _naso_aural_explanation(ratio),
        "explanationDe": expl_de.naso_aural_explanation_de(float(ratio)),
        "earHeightNorm": round(float(ear_h), 6),
        "noseHeightNorm": round(float(nose_h), 6),
        "noseTop": nose_top,
        "noseBottom": nose_bot,
        "photoSource": pose_id,
        "dataSource": "ear_landmarker",
        "overlay": qoves_overlay,
        "overlaySpace": "image",
        "requiresProfile": False,
    }
    profile_bytes = photos.get(pose_id)
    naso = patch_naso_aural_guides(
        naso,
        profile_bytes,
        facing_right=facing_right,
        ear_measurements=meas,
        pose_id=pose_id,
    )
    guide_nose_h = nose_height_norm_from_guides(naso)
    if guide_nose_h is not None:
        ratio = round(float(ear_h) / guide_nose_h, 2)
        naso = {
            **naso,
            "yourValue": ratio,
            "yourLabel": _naso_aural_label(ratio),
            "explanation": _naso_aural_explanation(ratio),
            "explanationDe": expl_de.naso_aural_explanation_de(float(ratio)),
            "noseHeightNorm": round(guide_nose_h, 6),
            "noseHeightSource": "guide_glabella_subnasale",
        }
    capture = side.get("earCapture") or {}
    naso["earCaptureProper"] = bool(capture.get("proper"))
    return naso


def build_naso_aural_by_pose(
    cv_report: dict,
    photos: dict[str, bytes],
    sides: dict,
) -> dict[str, dict[str, Any]]:
    """Compute naso-aural for every profile side that has landmarker measurements."""
    base_naso = (
        (cv_report.get("proportions") or {}).get("ratios", {}).get("nasoAural") or {}
    )
    base_naso = dict(base_naso)
    out: dict[str, dict[str, Any]] = {}
    for side_key, pose_id in _SIDE_KEYS:
        side = sides.get(side_key)
        if not _side_usable_for_naso(side):
            continue
        variant = build_naso_aural_variant(cv_report, photos, side, base_naso)
        if variant:
            out[pose_id] = variant
    return out


def resolve_naso_profile_pose(ears: dict | None) -> Optional[str]:
    """Active profile for naso-aural display — admin override, then right default if by_pose."""
    if not isinstance(ears, dict):
        return None
    admin = ears.get("adminMeasurementProfilePose")
    if admin in ("leftProfile", "rightProfile"):
        return admin
    by_pose = ears.get("nasoAuralByPose") or {}
    if by_pose:
        if "rightProfile" in by_pose:
            return "rightProfile"
        if "leftProfile" in by_pose:
            return "leftProfile"
    picked = pick_profile_ear_side(ears.get("sides") or {})
    if picked:
        return picked.get("poseId")
    auto = ears.get("measurementProfilePose")
    return auto if auto in ("leftProfile", "rightProfile") else None


def apply_naso_aural_variant(cv_report: dict, variant: dict) -> dict:
    """Merge one naso-aural variant into cv_report top-level fields."""
    cv_report = dict(cv_report)
    prev_ratios = (cv_report.get("proportions") or {}).get("ratios") or {}
    ratios = {**prev_ratios, "nasoAural": variant}
    cv_report["proportions"] = {**(cv_report.get("proportions") or {}), "ratios": ratios}
    ratio = variant.get("yourValue")
    if cv_report.get("nose") and ratio is not None:
        cv_report["nose"] = {**cv_report["nose"], "nasoAuralRatio": ratio}
    if cv_report.get("ears") and ratio is not None:
        cv_report["ears"] = {**cv_report["ears"], "protrusion": variant.get("yourLabel") or _naso_aural_label(ratio)}
    return cv_report


def apply_naso_aural_pose(cv_report: dict, ears: dict, pose_id: str) -> dict:
    """Select stored per-pose variant as the active naso-aural ratio."""
    by_pose = (ears or {}).get("nasoAuralByPose") or {}
    variant = by_pose.get(pose_id)
    if not variant:
        raise ValueError(f"No naso-aural variant for {pose_id}")
    cv_report = apply_naso_aural_variant(cv_report, variant)
    cv_report["ears"] = {
        **(cv_report.get("ears") or {}),
        **ears,
        "adminMeasurementProfilePose": pose_id,
    }
    return cv_report


def enrich_naso_aural_from_ears(cv_report: dict, photos: dict[str, bytes]) -> dict:
    """Build per-profile naso-aural variants and bind the default display pose."""
    ears = dict(cv_report.get("ears") or {})
    sides = ears.get("sides") or {}
    picked = pick_profile_ear_side(sides)
    if picked:
        ears["measurementProfilePose"] = picked.get("poseId")

    by_pose = build_naso_aural_by_pose(cv_report, photos, sides)
    if by_pose:
        ears["nasoAuralByPose"] = by_pose

    cv_report["ears"] = ears
    pose = resolve_naso_profile_pose(ears)
    if pose and pose in by_pose:
        cv_report = apply_naso_aural_variant(cv_report, by_pose[pose])
    return cv_report


def set_admin_naso_profile_pose(analysis: dict, pose_id: str) -> dict:
    """Admin review: persist chosen profile for naso-aural (+ ears hero when re-bound)."""
    if pose_id not in ("leftProfile", "rightProfile"):
        raise ValueError("pose must be leftProfile or rightProfile")
    analysis = deepcopy(analysis or {})
    cv_report = dict(analysis.get("cvReport") or {})
    ears = dict(cv_report.get("ears") or {})
    by_pose = ears.get("nasoAuralByPose") or {}
    if pose_id not in by_pose:
        raise ValueError(f"No naso-aural data for {pose_id}")
    cv_report = apply_naso_aural_pose(cv_report, ears, pose_id)
    analysis["cvReport"] = cv_report
    return analysis
