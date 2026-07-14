"""Projected AFTER status helpers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_projected_after_pending() -> dict:
    return {
        "status": "pending",
        "updatedAt": _utcnow_iso(),
        "full": None,
        "lastError": None,
    }


def merge_projected_after_update(existing: Optional[dict], **updates: Any) -> dict:
    base = dict(existing or new_projected_after_pending())
    base.update(updates)
    base["updatedAt"] = _utcnow_iso()
    return base
