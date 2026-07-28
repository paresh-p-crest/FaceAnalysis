"""Password reset token generation and validation."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

RESET_TOKEN_TTL_MINUTES = 60
RESET_TOKEN_ERROR = "Invalid or expired reset link. Request a new one."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_reset_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hex_hash)."""
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, token_hash


def hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def reset_token_expires_at() -> datetime:
    return _utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)


if __name__ == "__main__":
    raw, digest = generate_reset_token()
    assert hash_reset_token(raw) == digest
    print("password_reset_service ok")
