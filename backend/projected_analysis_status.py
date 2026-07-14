"""Projected AFTER facial analysis (CV) status helpers.

Stored in assessments.projected_analysis — never mutates BEFORE analysis.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_projected_analysis_pending() -> dict:
    return {
        "status": "pending",
        "updatedAt": _utcnow_iso(),
        "source": "projected_full",
        "cvReport": None,
        "landmarks": None,
        "metrics": None,
        "eyeAnalysis": None,
        "error": None,
    }


def merge_projected_analysis_update(existing: Optional[dict], **updates: Any) -> dict:
    base = dict(existing or new_projected_analysis_pending())
    base.update(updates)
    base["updatedAt"] = _utcnow_iso()
    if "source" not in base or not base["source"]:
        base["source"] = "projected_full"
    return base
