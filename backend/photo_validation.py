"""Validate required photo poses before analysis."""

from __future__ import annotations

from .config import PHOTO_POSES

REQUIRED_POSE_IDS: tuple[str, ...] = tuple(
    p["id"] for p in PHOTO_POSES if p.get("required", False)
)


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
