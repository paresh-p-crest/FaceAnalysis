"""Per-user submitted assessment limits (customer package cap)."""

from __future__ import annotations

from fastapi import HTTPException

from .entitlements import DEFAULT_ANALYSIS_SLOTS, max_analysis_slots_for_user
from .report_status import assessment_is_submitted
from .repositories.assessment_repository import (
    count_submitted_assessments_for_user,
    get_assessment_by_id,
)

# Backward-compatible alias: historical global cap was 2. Prefer max_analysis_slots_for_user().
MAX_SUBMITTED_ASSESSMENTS_PER_USER = 2
ASSESSMENT_LIMIT_DETAIL = "Assessment limit reached for your plan."


async def require_assessment_slot(
    current_user: dict,
    *,
    assessment_id: str | None = None,
) -> None:
    """Raise 403 when a non-admin user has used all package assessment slots.

    Slots come from entitlements:
    - analyse / premium → 1
    - duo → 2
    - incomplete package info → permissive (duo slots)
    """
    if current_user.get("role") == "admin":
        return

    if assessment_id:
        existing = await get_assessment_by_id(assessment_id)
        if existing and assessment_is_submitted(existing):
            return

    limit = max_analysis_slots_for_user(current_user) or DEFAULT_ANALYSIS_SLOTS
    count = await count_submitted_assessments_for_user(current_user["id"])
    if count >= limit:
        raise HTTPException(status_code=403, detail=ASSESSMENT_LIMIT_DETAIL)
