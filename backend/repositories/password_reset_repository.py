"""PostgreSQL persistence for password reset tokens."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update

from ..database import session_scope
from ..models import PasswordResetToken
from ._helpers import iso, parse_uuid


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _row_to_dict(row: PasswordResetToken) -> dict:
    return {
        "id": str(row.id),
        "userId": str(row.user_id),
        "tokenHash": row.token_hash,
        "expiresAt": iso(row.expires_at),
        "usedAt": iso(row.used_at),
        "createdAt": iso(row.created_at),
    }


async def invalidate_unused_tokens_for_user(user_id: str) -> int:
    uid = parse_uuid(user_id)
    if uid is None:
        return 0
    now = _utcnow()
    async with session_scope() as session:
        result = await session.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.user_id == uid,
                PasswordResetToken.used_at.is_(None),
            )
            .values(used_at=now)
        )
        return result.rowcount or 0


async def create_password_reset_token(
    *,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
) -> dict:
    uid = parse_uuid(user_id)
    if uid is None:
        raise ValueError("Invalid user id")
    now = _utcnow()
    row = PasswordResetToken(
        user_id=uid,
        token_hash=token_hash,
        expires_at=expires_at,
        created_at=now,
    )
    async with session_scope() as session:
        session.add(row)
        await session.flush()
        return _row_to_dict(row)


async def get_valid_reset_token(token_hash: str) -> Optional[dict]:
    now = _utcnow()
    async with session_scope() as session:
        result = await session.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now,
            )
        )
        row = result.scalar_one_or_none()
        return _row_to_dict(row) if row else None


async def mark_reset_token_used(token_id: str) -> None:
    tid = parse_uuid(token_id)
    if tid is None:
        return
    now = _utcnow()
    async with session_scope() as session:
        row = await session.get(PasswordResetToken, tid)
        if row:
            row.used_at = now
            await session.flush()
