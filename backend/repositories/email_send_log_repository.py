"""PostgreSQL persistence for email send logs."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from ..database import session_scope
from ..models import EmailSendLog
from ._helpers import iso, parse_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _log_to_dict(row: EmailSendLog) -> dict:
    return {
        "id": str(row.id),
        "recipient": row.recipient,
        "template": row.template,
        "provider": row.provider,
        "providerMessageId": row.provider_message_id,
        "status": row.status,
        "errorMessage": row.error_message,
        "userId": str(row.user_id) if row.user_id else None,
        "raw": row.raw or {},
        "createdAt": iso(row.created_at),
    }


async def create_email_send_log(
    *,
    log_id: uuid.UUID | None = None,
    recipient: str,
    template: str,
    provider: str,
    status: str,
    provider_message_id: Optional[str] = None,
    error_message: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    raw: Optional[dict] = None,
) -> dict:
    now = _utcnow()
    row = EmailSendLog(
        id=log_id or uuid.uuid4(),
        recipient=recipient,
        template=template,
        provider=provider,
        provider_message_id=provider_message_id,
        status=status,
        error_message=error_message,
        user_id=user_id,
        raw=raw or {},
        created_at=now,
    )
    async with session_scope() as session:
        session.add(row)
        await session.flush()
        return _log_to_dict(row)
