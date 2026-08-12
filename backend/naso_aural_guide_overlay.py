"""Scoped naso-aural nose level guides — FaceMesh-first, silhouette fallback.

Uses ``extract_glabella_subnasale`` (same order as ``scripts/profile_landmarks.py``:
FaceMesh glabella/subnasale when mesh locks; else face-det crop + silhouette).
Does not change global profile silhouette extraction used elsewhere.
"""

from __future__ import annotations

import logging
from typing import Optional

from .ear_analysis import build_nose_level_guides, ear_vertical_x_pct
from .profile_face_crop import extract_glabella_subnasale, mediapipe_solutions_available

logger = logging.getLogger(__name__)

_MIN_GUIDE_Y = 0.12  # reject hairline/crown lock only; script has no upper-y gate


def _guides_crown_plausible(guide_glabella: dict, guide_nose_bottom: dict) -> bool:
    """Minimal sanity — script draws guides without a span gate."""
    gy = float(guide_glabella.get("y", 0))
    by = float(guide_nose_bottom.get("y", 0))
    if gy < _MIN_GUIDE_Y or by < _MIN_GUIDE_Y:
        return False
    return by > gy + 0.005


def _norm_y01(pt: dict | None) -> float | None:
    if not isinstance(pt, dict):
        return None
    try:
        y = float(pt["y"])
    except (KeyError, TypeError, ValueError):
        return None
    if y > 1.5:
        y /= 100.0
    return y if 0.0 <= y <= 1.0 else None


def nose_height_norm_from_guides(naso: dict | None) -> float | None:
    """Vertical nose span (0–1) from dashed guide landmarks when present."""
    if not isinstance(naso, dict):
        return None
    gg = naso.get("guideGlabella")
    gnb = naso.get("guideNoseBottom")
    if not isinstance(gg, dict) or not isinstance(gnb, dict):
        return None
    gy = _norm_y01(gg)
    by = _norm_y01(gnb)
    if gy is None or by is None:
        return None
    if not _guides_crown_plausible({"y": gy}, {"y": by}):
        return None
    span = abs(by - gy)
    return span if span > 1e-6 else None


def _build_guide_patch(
    guide_glabella: dict,
    guide_nose_bottom: dict,
    *,
    vertical_x_pct: float,
) -> dict | None:
    if not _guides_crown_plausible(guide_glabella, guide_nose_bottom):
        return None
    guides = build_nose_level_guides(
        glabella=guide_glabella,
        nose_bottom=guide_nose_bottom,
        vertical_x_pct=vertical_x_pct,
    )
    if not guides:
        return None
    return {
        "guideGlabella": guide_glabella,
        "guideNoseBottom": guide_nose_bottom,
        "guides": guides,
    }


def run_naso_aural_nose_guide_overlay(
    profile_bytes: bytes,
    *,
    facing_right: bool,
    ear_measurements: dict | None = None,
    pose_id: str | None = None,
) -> dict | None:
    """Face-det crop + silhouette → ``{ guideGlabella, guideNoseBottom, guides }`` or None."""
    if not profile_bytes:
        return None
    if not mediapipe_solutions_available():
        logger.warning(
            "naso-aural guide sidecar: MediaPipe solutions missing — run backend with "
            "project .venv (mediapipe==0.10.14), same as scripts/profile_landmarks.py"
        )
        return None

    guide_glabella, guide_nose_bottom, _sil_anchors = extract_glabella_subnasale(
        profile_bytes,
        bg_remove=True,
    )
    if not guide_glabella or not guide_nose_bottom:
        logger.warning(
            "naso-aural guide sidecar: face-det/silhouette failed on %s profile",
            pose_id or "unknown",
        )
        return None

    em = ear_measurements or {}
    ht = em.get("helixTop") or {}
    vertical_x = ear_vertical_x_pct(
        x_min_norm=em.get("xMinNorm"),
        x_max_norm=em.get("xMaxNorm"),
        vertical_bracket_x_norm=em.get("verticalBracketXNorm"),
        helix_x_norm=ht.get("x"),
        facing_right=facing_right,
    )
    if vertical_x is None:
        logger.warning(
            "naso-aural guide sidecar: ear vertical x unresolved on %s profile",
            pose_id or "unknown",
        )
        return None

    patch = _build_guide_patch(
        guide_glabella,
        guide_nose_bottom,
        vertical_x_pct=vertical_x,
    )
    if not patch:
        logger.warning(
            "naso-aural guide sidecar: crown plausibility failed on %s "
            "(glabella=%.3f subnasale=%.3f span=%.3f)",
            pose_id or "unknown",
            guide_glabella["y"],
            guide_nose_bottom["y"],
            float(guide_nose_bottom["y"]) - float(guide_glabella["y"]),
        )
    return patch


def patch_naso_aural_guides(
    naso: dict,
    profile_bytes: bytes | None,
    *,
    facing_right: bool,
    ear_measurements: Optional[dict] = None,
    pose_id: str | None = None,
) -> dict:
    """Merge sidecar guide fields into ``naso`` (overlay guides only; ratio recomputed upstream)."""
    if not isinstance(naso, dict) or not profile_bytes:
        return naso

    pose_id = pose_id or naso.get("photoSource")

    patch = run_naso_aural_nose_guide_overlay(
        profile_bytes,
        facing_right=facing_right,
        ear_measurements=ear_measurements,
        pose_id=pose_id,
    )
    if not patch:
        logger.warning(
            "naso-aural guide sidecar: no nose level guides patched on %s (ear caliper unchanged)",
            pose_id or "unknown",
        )
        return naso

    overlay = dict(naso.get("overlay") or {})
    overlay["guides"] = patch["guides"]
    overlay["nasoLayout"] = "earPlusNoseGuides-v6"

    return {
        **naso,
        "guideGlabella": patch["guideGlabella"],
        "guideNoseBottom": patch["guideNoseBottom"],
        "overlay": overlay,
    }
