"""Media serving — streams assessment media from the active MediaStorage backend.

Works for both the local filesystem and Replit Object Storage backends, so image
URLs (/api/media/assessments/{id}/...) resolve identically in dev and prod.
Soft-deleted assessments return 404 for their media keys.
"""

from __future__ import annotations

import asyncio
import re
import uuid

from fastapi import APIRouter, HTTPException, Response

from ..config import MEDIA_OBJECT_ROOT
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


async def _require_active_assessment_for_key(key: str) -> None:
    """404 soft-deleted / missing assessments for assessments/{id}/… keys."""
    match = _ASSESSMENT_KEY_RE.match(key)
    if not match:
        return
    if not is_db_configured():
        return
    aid = match.group("aid")
    try:
        uuid.UUID(aid)
    except ValueError:
        raise HTTPException(status_code=404, detail="Not found") from None
    existing = await get_assessment_by_id(aid)
    if not existing:
        raise HTTPException(status_code=404, detail="Not found")


@router.get("/{object_key:path}")
async def get_media(object_key: str):
    key = object_key.replace("\\", "/").strip("/")
    if ".." in key or not key.startswith(f"{MEDIA_OBJECT_ROOT}/"):
        raise HTTPException(status_code=404, detail="Not found")
    await _require_active_assessment_for_key(key)
    data = await asyncio.to_thread(get_media_storage().get_bytes, key)
    if data is None:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=data,
        media_type=_content_type_from_bytes(data, key),
        headers={"Cache-Control": "public, max-age=3600"},
    )
