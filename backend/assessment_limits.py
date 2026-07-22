"""Per-user submitted assessment limits (customer package cap)."""

from __future__ import annotations

from fastapi import HTTPException

from .report_status import assessment_is_submitted
from .repositories.assessment_repository import (
    count_submitted_assessments_for_user,
    get_assessment_by_id,
)

MAX_SUBMITTED_ASSESSMENTS_PER_USER = 2
ASSESSMENT_LIMIT_DETAIL = "Assessment limit reached for your plan."


async def require_assessment_slot(
    current_user: dict,
    *,
    assessment_id: str | None = None,
) -> None:
    """Raise 403 when a non-admin user has used all package assessment slots."""
    if current_user.get("role") == "admin":
        return

    if assessment_id:
        existing = await get_assessment_by_id(assessment_id)
        if existing and assessment_is_submitted(existing):
            return

    count = await count_submitted_assessments_for_user(current_user["id"])
    if count >= MAX_SUBMITTED_ASSESSMENTS_PER_USER:
        raise HTTPException(status_code=403, detail=ASSESSMENT_LIMIT_DETAIL)
