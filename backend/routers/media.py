"""Media serving — streams assessment media from the active MediaStorage backend.

Works for both the local filesystem and Replit Object Storage backends, so image
URLs (/api/media/assessments/{id}/...) resolve identically in dev and prod.
Soft-deleted assessments return 404 for their media keys.
Authenticated media: token endpoint + owner-or-admin enforcement for assessment keys.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from ..auth import get_current_user, get_optional_current_user
from ..config import MEDIA_AUTH_REQUIRED, MEDIA_OBJECT_ROOT, MEDIA_TOKEN_TTL_SECONDS
from ..database import is_db_configured
from ..media_storage import get_media_storage
from ..repositories.assessment_repository import get_assessment_by_id

router = APIRouter(prefix="/api/media", tags=["media"])

_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".json": "application/json",
}

_ASSESSMENT_KEY_RE = re.compile(
    rf"^{re.escape(MEDIA_OBJECT_ROOT)}/"
    rf"(?P<aid>[0-9a-fA-F]{{8}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{4}}-[0-9a-fA-F]{{12}})/"
)


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


def _encode_token(user: dict) -> tuple[str, str]:
    now = int(time.time())
    payload = {
        "sub": user["id"],
        "role": user.get("role", "user"),
        "iat": now,
        "exp": now + MEDIA_TOKEN_TTL_SECONDS,
    }
    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    payload_b64 = _b64url(payload_json)
    signature = hmac.new(_auth_secret(), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return f"{payload_b64}.{_b64url(signature)}", payload["exp"]


def _decode_token(token: str) -> dict:
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


def _content_type(key: str) -> str:
    lower = key.lower()
    for ext, ctype in _CONTENT_TYPES.items():
        if lower.endswith(ext):
            return ctype
    return "application/octet-stream"


def _content_type_from_bytes(data: bytes, key: str) -> str:
    """Prefer image magic bytes over the object-key extension.

    Poses are stored under a `.jpg` key but keep their original bytes (which may be
    PNG/WebP) to preserve quality, so sniff the real type for a correct header.
    """
    if data:
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            return "image/png"
        if data[:3] == b"\xff\xd8\xff":
            return "image/jpeg"
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return "image/webp"
    return _content_type(key)


async def _require_active_assessment_for_key(key: str) -> Optional[dict]:
    """404 soft-deleted / missing assessments for assessments/{id}/… keys.

    Returns the assessment dict when found, else None (non-assessment key).
    """
    match = _ASSESSMENT_KEY_RE.match(key)
    if not match:
        return None
    if not is_db_configured():
        return None
    aid = match.group("aid")
    try:
        uuid.UUID(aid)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found") from None
    existing = await get_assessment_by_id(aid)
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")
    return existing


@router.get("/token")
async def create_media_token(current_user: dict = Depends(get_current_user)):
    token, exp = _encode_token(current_user)
    return {
        "token": token,
        "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(exp)),
    }


@router.get("/{object_key:path}")
async def get_media(
    object_key: str,
    token: Optional[str] = Query(None, alias="token"),
    current_user: Optional[dict] = Depends(get_optional_current_user),
):
    key = object_key.replace("\\", "/").strip("/")
    if ".." in key or not key.startswith(f"{MEDIA_OBJECT_ROOT}/"):
        raise HTTPException(status_code=404, detail="Not found")
    existing = await _require_active_assessment_for_key(key)
    if existing is not None:
        assessment_key = True
    else:
        assessment_key = bool(_ASSESSMENT_KEY_RE.match(key))

    if assessment_key and is_db_configured():
        identity = None
        if current_user:
            identity = current_user
        elif token:
            payload = _decode_token(token)
            from ..repositories.user_repository import get_user_by_id

            identity = await get_user_by_id(payload.get("sub", ""))
            if not identity:
                raise HTTPException(status_code=404, detail="Not found")
        if MEDIA_AUTH_REQUIRED and not identity:
            raise HTTPException(status_code=404, detail="Not found")
        if identity and str(existing.get("userId")) != str(identity.get("id")) and identity.get("role") != "admin":
            raise HTTPException(status_code=404, detail="Not found")

    data = await asyncio.to_thread(get_media_storage().get_bytes, key)
    if data is None:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=data,
        media_type=_content_type_from_bytes(data, key),
        headers={"Cache-Control": "public, max-age=3600"},
    )
