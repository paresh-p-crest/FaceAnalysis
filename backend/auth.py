"""Authentication helpers: password hashing, signed tokens, and guards."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .repositories.user_repository import get_user_by_id

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
_bearer = HTTPBearer(auto_error=False)


def _auth_secret() -> bytes:
    secret = os.environ.get("AUTH_SECRET")
    if not secret:
        secret = "myface-local-dev-secret-change-me"
    return secret.encode("utf-8")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64url(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256$120000${_b64url(salt)}${_b64url(digest)}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = _unb64url(salt_b64)
        expected = _unb64url(digest_b64)
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "iat": now,
        "exp": now + TOKEN_TTL_SECONDS,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url(payload_json)
    signature = hmac.new(_auth_secret(), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url(signature)}"


def decode_access_token(token: str) -> dict:
    try:
        payload_b64, signature_b64 = token.split(".", 1)
        expected = hmac.new(_auth_secret(), payload_b64.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64url(signature_b64), expected):
            raise ValueError("Invalid signature")
        payload = json.loads(_unb64url(payload_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expired")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_access_token(credentials.credentials)
    user = await get_user_by_id(payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[dict]:
    if not credentials:
        return None
    return await get_current_user(credentials)


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return current_user


async def ensure_bootstrap_admin() -> None:
    """Create/update the configured admin account on startup."""
    email = os.environ.get("ADMIN_EMAIL", "").strip()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    if len(password) < 8:
        raise RuntimeError("ADMIN_PASSWORD must be at least 8 characters")

    from .repositories.user_repository import ensure_user

    await ensure_user(email=email, password_hash=hash_password(password), role="admin")
