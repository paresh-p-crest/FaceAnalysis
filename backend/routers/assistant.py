"""Beauty Assistant API, grounded on stored assessment cvReport."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..ai_access import (
    check_assistant_rate_limit,
    increment_assistant_rate_limit,
    require_paid_ai_access,
)
from ..auth import get_current_user
from ..database import is_mongodb_configured
from ..repositories.assessment_repository import get_assessment_by_id
from ..repositories.conversation_repository import (
    append_messages,
    get_conversation,
    get_or_create_conversation,
    update_session_summary,
)
from ..serialization import to_json_safe
from ..assistant_agent import run_assistant_agent

router = APIRouter(prefix="/api/assessments", tags=["assistant"])


class AssistantMessageRequest(BaseModel):
    message: str = Field(min_length=2, max_length=1200)


def _can_access_assessment(existing: dict, current_user: dict) -> bool:
    if not existing.get("userId"):
        return True
    return current_user.get("role") == "admin" or current_user.get("id") == existing.get("userId")


async def _load_assessment_or_403(assessment_id: str, current_user: dict) -> dict:
    if not is_mongodb_configured():
        raise HTTPException(status_code=503, detail="MongoDB not configured.")
    assessment = await get_assessment_by_id(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not _can_access_assessment(assessment, current_user):
        raise HTTPException(status_code=403, detail="You do not have access to this assessment")
    if not (assessment.get("analysis") or {}).get("cvReport"):
        raise HTTPException(status_code=400, detail="Stored cvReport is required for Beauty Assistant.")
    return assessment


@router.get("/{assessment_id}/assistant")
async def get_assistant_conversation(
    assessment_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_paid_ai_access(current_user)
    await _load_assessment_or_403(assessment_id, current_user)
    conversation = await get_conversation(assessment_id=assessment_id, user_id=current_user["id"])
    return to_json_safe(conversation or {"assessmentId": assessment_id, "messages": []})


@router.post("/{assessment_id}/assistant")
async def post_assistant_message(
    assessment_id: str,
    req: AssistantMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    await require_paid_ai_access(current_user)
    await check_assistant_rate_limit(current_user["id"])

    assessment = await _load_assessment_or_403(assessment_id, current_user)
    conversation = await get_or_create_conversation(assessment_id=assessment_id, user_id=current_user["id"])
    messages = conversation.get("messages") or []

    result = await asyncio.to_thread(
        run_assistant_agent,
        question=req.message,
        assessment=assessment,
        history=messages,
        session_summary=conversation.get("sessionSummary"),
        summary_at_user_count=int(conversation.get("summaryAtUserCount") or 0),
    )
    if not result.get("content"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Assistant response unavailable.")

    updated = await append_messages(
        conversation_id=conversation["id"],
        messages=[
            {"role": "user", "content": req.message},
            {"role": "assistant", "content": result["content"]},
        ],
    )

    if result.get("session_summary") and result.get("should_refresh_summary"):
        updated = await update_session_summary(
            conversation_id=conversation["id"],
            session_summary=result["session_summary"],
            summary_at_user_count=int(result.get("summary_at_user_count") or 0),
        )

    await increment_assistant_rate_limit(current_user["id"])
    return to_json_safe(updated)