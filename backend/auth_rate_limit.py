"""Rate limiting for auth endpoints (forgot-password)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from .database import session_scope
from .models import AuthRateLimit

FORGOT_PASSWORD_EMAIL_LIMIT = 3
FORGOT_PASSWORD_IP_LIMIT = 10


def _hour_bucket(now: datetime | None = None) -> str:
    moment = now or datetime.now(timezone.utc)
    return moment.strftime("%Y-%m-%dT%H")


async def _get_count(scope: str, key: str, bucket: str) -> int:
    async with session_scope() as session:
        result = await session.execute(
            select(AuthRateLimit).where(
                AuthRateLimit.scope == scope,
                AuthRateLimit.key == key,
                AuthRateLimit.hour_bucket == bucket,
            )
        )
        row = result.scalar_one_or_none()
        return int(row.count) if row else 0


async def _increment(scope: str, key: str, bucket: str) -> int:
    now = datetime.now(timezone.utc)
    async with session_scope() as session:
        result = await session.execute(
            select(AuthRateLimit).where(
                AuthRateLimit.scope == scope,
                AuthRateLimit.key == key,
                AuthRateLimit.hour_bucket == bucket,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = AuthRateLimit(
                scope=scope,
                key=key,
                hour_bucket=bucket,
                count=1,
                created_at=now,
            )
            session.add(row)
        else:
            row.count = int(row.count or 0) + 1
        await session.flush()
        return int(row.count or 1)


async def check_forgot_password_rate_limit(*, email: str, client_ip: str) -> bool:
    """Return True if the request is allowed; False if throttled."""
    bucket = _hour_bucket()
    email_key = email.lower().strip()
    ip_key = (client_ip or "unknown").strip() or "unknown"

    email_count = await _get_count("forgot_password_email", email_key, bucket)
    if email_count >= FORGOT_PASSWORD_EMAIL_LIMIT:
        return False

    ip_count = await _get_count("forgot_password_ip", ip_key, bucket)
    if ip_count >= FORGOT_PASSWORD_IP_LIMIT:
        return False

    return True


async def record_forgot_password_attempt(*, email: str, client_ip: str) -> None:
    bucket = _hour_bucket()
    email_key = email.lower().strip()
    ip_key = (client_ip or "unknown").strip() or "unknown"
    await _increment("forgot_password_email", email_key, bucket)
    await _increment("forgot_password_ip", ip_key, bucket)
