"""Media serving — streams assessment media from the active MediaStorage backend.

Works for both the local filesystem and Replit Object Storage backends, so image
URLs (/api/media/assessments/{id}/...) resolve identically in dev and prod. Open
access, matching the prior public /uploads behavior; owner-only access can be
layered on later via signed media tokens.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, Response

from ..config import MEDIA_OBJECT_ROOT
from ..media_storage import get_media_storage

router = APIRouter(prefix="/api/media", tags=["media"])

_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".json": "application/json",
}


def _content_type(key: str) -> str:
    lower = key.lower()
    for ext, ctype in _CONTENT_TYPES.items():
        if lower.endswith(ext):
            return ctype
    return "application/octet-stream"


@router.get("/{object_key:path}")
async def get_media(object_key: str):
    key = object_key.replace("\\", "/").strip("/")
    if ".." in key or not key.startswith(f"{MEDIA_OBJECT_ROOT}/"):
        raise HTTPException(status_code=404, detail="Not found")
    data = await asyncio.to_thread(get_media_storage().get_bytes, key)
    if data is None:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=data,
        media_type=_content_type(key),
        headers={"Cache-Control": "public, max-age=3600"},
    )
