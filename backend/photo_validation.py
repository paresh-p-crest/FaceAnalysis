"""Validate required photo poses before analysis."""

from __future__ import annotations

from .config import PHOTO_POSES

REQUIRED_POSE_IDS: tuple[str, ...] = tuple(
    p["id"] for p in PHOTO_POSES if p.get("required", False)
)

POSE_RANGES: dict[str, tuple[float, float]] = {
    "front": (0.35, 0.65),
    "leftProfile": (0.45, 1.0),
    "rightProfile": (0.0, 0.55),
    "left45": (0.35, 0.85),
    "right45": (0.15, 0.65),
    "smile": (0.30, 0.70),
    "topHead": (0.20, 0.80),
}


def missing_required_poses(photos: dict) -> list[str]:
    """Return pose IDs that are required but missing or empty in *photos*."""
    missing: list[str] = []
    for pose_id in REQUIRED_POSE_IDS:
        val = photos.get(pose_id)
        if val is None or (isinstance(val, (bytes, str)) and not val):
            missing.append(pose_id)
    return missing


def validate_required_poses(photos: dict) -> list[str]:
    """Alias for missing_required_poses — returns list of missing pose IDs."""
    return missing_required_poses(photos)

