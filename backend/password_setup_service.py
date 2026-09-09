"""One-time password-setup tokens for landing-paid account imports."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

SETUP_TOKEN_TTL_MINUTES = 15
SETUP_TOKEN_ERROR = "Invalid or expired setup link. Please return to myface.de or contact support."


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_setup_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hex_hash)."""
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, token_hash


def hash_setup_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def setup_token_expires_at() -> datetime:
    return _utcnow() + timedelta(minutes=SETUP_TOKEN_TTL_MINUTES)


if __name__ == "__main__":
    raw, digest = generate_setup_token()
    assert hash_setup_token(raw) == digest
    print("password_setup_service ok")
