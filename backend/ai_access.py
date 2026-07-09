"""Payment gating and rate limits for backend AI endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from .config import ASSISTANT_HOURLY_MESSAGE_LIMIT
from .database import get_db
from .repositories.payment_repository import user_has_completed_payment


async def require_paid_ai_access(current_user: dict) -> None:
    """Raise 402 unless the user is admin or has a completed payment."""
    if current_user.get("role") == "admin":
        return
    if not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required.")
    if not await user_has_completed_payment(current_user["id"]):
        raise HTTPException(
            status_code=402,
            detail="Payment required before using AI features.",
        )


def _hour_bucket(now: datetime | None = None) -> str:
    moment = now or datetime.now(timezone.utc)
    return moment.strftime("%Y-%m-%dT%H")


async def check_assistant_rate_limit(user_id: str) -> None:
    """Raise 429 when the user exceeds the hourly assistant message budget."""
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")

    db = get_db()
    bucket = _hour_bucket()
    doc = await db.assistant_rate_limits.find_one({"userId": user_id, "hourBucket": bucket})
    count = int((doc or {}).get("count") or 0)
    if count >= ASSISTANT_HOURLY_MESSAGE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Assistant limit reached ({ASSISTANT_HOURLY_MESSAGE_LIMIT} messages per hour). Try again later.",
        )


async def increment_assistant_rate_limit(user_id: str) -> int:
    """Increment the hourly counter after a successful assistant reply."""
    db = get_db()
    bucket = _hour_bucket()
    doc = await db.assistant_rate_limits.find_one_and_update(
        {"userId": user_id, "hourBucket": bucket},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {
                "userId": user_id,
                "hourBucket": bucket,
                "createdAt": datetime.now(timezone.utc),
            },
        },
        upsert=True,
        return_document=True,
    )
    return int(doc.get("count") or 1)
