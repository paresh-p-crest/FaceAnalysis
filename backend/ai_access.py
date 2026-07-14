"""Auth and rate limits for backend AI endpoints.

AI narrative, protocol, visuals, and Beauty Assistant are available to any
authenticated user who can access the assessment (same tier as dashboard).
Report visibility for clients remains gated by admin approval elsewhere.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select

from .config import ASSISTANT_HOURLY_MESSAGE_LIMIT
from .database import session_scope
from .models import AssistantRateLimit
from .repositories._helpers import parse_uuid


async def require_paid_ai_access(current_user: dict) -> None:
    """Require an authenticated user for AI features.

    Kept name for call-site compatibility. Payment is no longer required here —
    analysis entry may still be payment-gated separately; admin approval still
    controls client report unlock.
    """
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required.")


def _hour_bucket(now: datetime | None = None) -> str:
    moment = now or datetime.now(timezone.utc)
    return moment.strftime("%Y-%m-%dT%H")


async def check_assistant_rate_limit(user_id: str) -> None:
    """Raise 429 when the user exceeds the hourly assistant message budget."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")

    uid = parse_uuid(user_id)
    if uid is None:
        raise HTTPException(status_code=401, detail="Authentication required.")

    bucket = _hour_bucket()
    async with session_scope() as session:
        result = await session.execute(
            select(AssistantRateLimit).where(
                AssistantRateLimit.user_id == uid,
                AssistantRateLimit.hour_bucket == bucket,
            )
        )
        row = result.scalar_one_or_none()
        count = int(row.count) if row else 0
    if count >= ASSISTANT_HOURLY_MESSAGE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Assistant limit reached ({ASSISTANT_HOURLY_MESSAGE_LIMIT} messages per hour). "
                "Try again later."
            ),
        )


async def increment_assistant_rate_limit(user_id: str) -> int:
    """Increment the hourly counter after a successful assistant reply."""
    uid = parse_uuid(user_id)
    if uid is None:
        return 0
    bucket = _hour_bucket()
    now = datetime.now(timezone.utc)
    async with session_scope() as session:
        result = await session.execute(
            select(AssistantRateLimit).where(
                AssistantRateLimit.user_id == uid,
                AssistantRateLimit.hour_bucket == bucket,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = AssistantRateLimit(
                user_id=uid,
                hour_bucket=bucket,
                count=1,
                created_at=now,
            )
            session.add(row)
        else:
            row.count = int(row.count or 0) + 1
        await session.flush()
        return int(row.count or 1)
