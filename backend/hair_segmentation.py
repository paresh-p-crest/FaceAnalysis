"""Optional BiSeNet hair segmentation — gated by HAIR_SEGMENTATION_ENABLED env."""

from __future__ import annotations

import os
from typing import Optional


def hair_segmentation_enabled() -> bool:
    return os.environ.get("HAIR_SEGMENTATION_ENABLED", "").lower() in ("1", "true", "yes")


def analyze_hair_segmentation(top_head_bytes: bytes, front_bytes: Optional[bytes] = None) -> Optional[dict]:
    """Return hair-mask metrics when segmentation is enabled; otherwise None."""
    if not hair_segmentation_enabled() or not top_head_bytes:
        return None
    # Phase 2: integrate pretrained face-parsing model (BiSeNet). Until then, return None
    # so callers fall back to pixel heuristics in hair_analysis.py.
    return None
