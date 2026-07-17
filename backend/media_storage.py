"""Unified media storage — one interface, two interchangeable backends.

All assessment media (uploaded poses, SegFormer parsing crops, projected AFTER
images, protocol JSON) is stored and read through `get_media_storage()`. Callers
never know which backend is active:

- ``LocalMediaStorage`` — filesystem (local dev + tests).
- ``ReplitObjectMediaStorage`` — Replit Object Storage (Replit runtime only).

The backend is chosen once, by ``MEDIA_STORAGE_BACKEND`` (``local`` | ``replit``).
If unset, it auto-detects: ``replit`` when running inside a Replit environment,
else ``local``. There is no runtime fallback — if ``replit`` is selected and the
bucket errors, it raises (single source of truth per environment).

Objects are addressed by forward-slash keys like ``assessments/{id}/front.jpg``
and served to the browser at ``/api/media/{key}`` regardless of backend, so the
frontend and stored ``publicUrl`` values are identical for local and Replit.
"""

from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path
from typing import Optional, Protocol
from urllib.parse import urlparse

from .config import MEDIA_LOCAL_ROOT, MEDIA_OBJECT_ROOT, MEDIA_URL_BASE

logger = logging.getLogger(__name__)


def _normalize_key(key: str) -> str:
    """Canonical object key: forward slashes, no leading/trailing slash."""
    return (key or "").replace("\\", "/").strip("/")


class MediaStorage(Protocol):
    def put_bytes(self, key: str, data: bytes) -> None: ...
    def get_bytes(self, key: str) -> Optional[bytes]: ...
    def delete(self, key: str) -> None: ...
    def delete_prefix(self, prefix: str) -> None: ...
    def exists(self, key: str) -> bool: ...


class LocalMediaStorage:
    """Filesystem-backed media store under a single root dir (dev + tests)."""

    def __init__(self, root: Optional[Path] = None):
        self.root = Path(root) if root else MEDIA_LOCAL_ROOT

    def _path(self, key: str) -> Path:
        return self.root / _normalize_key(key)

    def put_bytes(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get_bytes(self, key: str) -> Optional[bytes]:
        path = self._path(key)
        if path.is_file():
            return path.read_bytes()
        return None

    def delete(self, key: str) -> None:
        path = self._path(key)
        try:
            path.unlink()
        except FileNotFoundError:
            pass

    def delete_prefix(self, prefix: str) -> None:
        norm = _normalize_key(prefix)
        target = self.root / norm
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
            return
        if not self.root.exists():
            return
        for path in self.root.rglob("*"):
            if path.is_file() and path.relative_to(self.root).as_posix().startswith(norm):
                path.unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()


class ReplitObjectMediaStorage:
    """Replit Object Storage backed media store (Replit runtime only).

    The client is created lazily so the backend imports and runs locally without
    the ``replit-object-storage`` package when the local backend is in use.
    """

    def __init__(self, bucket_id: Optional[str] = None):
        self._bucket_id = bucket_id or os.environ.get("REPLIT_DEFAULT_BUCKET_ID") or None
        self._client = None

    def _get_client(self):
        if self._client is None:
            try:
                from replit.object_storage import Client
            except ImportError as exc:  # pragma: no cover - only when misconfigured
                raise RuntimeError(
                    "replit-object-storage is not installed but MEDIA_STORAGE_BACKEND=replit. "
                    "Install it (`python -m pip install -r requirements.txt`)."
                ) from exc
            # Client() with no bucket_id resolves .replit's [objectStorage] defaultBucketID.
            self._client = Client(bucket_id=self._bucket_id) if self._bucket_id else Client()
        return self._client

    def put_bytes(self, key: str, data: bytes) -> None:
        self._get_client().upload_from_bytes(_normalize_key(key), data)

    def get_bytes(self, key: str) -> Optional[bytes]:
        from replit.object_storage.errors import ObjectNotFoundError

        try:
            return self._get_client().download_as_bytes(_normalize_key(key))
        except ObjectNotFoundError:
            return None

    def delete(self, key: str) -> None:
        self._get_client().delete(_normalize_key(key), ignore_not_found=True)

    def delete_prefix(self, prefix: str) -> None:
        client = self._get_client()
        norm = _normalize_key(prefix)
        for obj in client.list(prefix=norm):
            client.delete(obj.name, ignore_not_found=True)

    def exists(self, key: str) -> bool:
        return self._get_client().exists(_normalize_key(key))


# --- Backend selection ------------------------------------------------------

_INSTANCE: Optional[MediaStorage] = None


def _running_on_replit() -> bool:
    return any(
        os.environ.get(var)
        for var in ("REPL_ID", "REPLIT_DEPLOYMENT", "REPLIT_DB_URL", "REPLIT_DEFAULT_BUCKET_ID")
    )


def _resolve_backend_name() -> str:
    name = (os.environ.get("MEDIA_STORAGE_BACKEND") or "").strip().lower()
    if name in ("replit", "object", "objectstorage", "object_storage"):
        return "replit"
    if name in ("local", "fs", "filesystem"):
        return "local"
    if name:
        logger.warning("Unknown MEDIA_STORAGE_BACKEND=%r; using auto-detect", name)
    return "replit" if _running_on_replit() else "local"


def _build_media_storage() -> MediaStorage:
    backend = _resolve_backend_name()
    if backend == "replit":
        logger.info("Media storage backend: Replit Object Storage")
        return ReplitObjectMediaStorage()
    logger.info("Media storage backend: local filesystem (%s)", MEDIA_LOCAL_ROOT)
    return LocalMediaStorage()


def get_media_storage() -> MediaStorage:
    """Return the process-wide media storage backend (cached)."""
    global _INSTANCE
    if _INSTANCE is None:
        _INSTANCE = _build_media_storage()
    return _INSTANCE


def reset_media_storage_cache() -> None:
    """Test hook — clear the cached backend so env changes take effect."""
    global _INSTANCE
    _INSTANCE = None


# --- Key + URL helpers ------------------------------------------------------


def assessment_key(assessment_id: str, *parts: str) -> str:
    """Build an object key under the per-assessment namespace."""
    segments = [MEDIA_OBJECT_ROOT, assessment_id, *[p for p in parts if p]]
    return "/".join(_normalize_key(s) for s in segments)


def public_url_for_key(key: str) -> str:
    """Browser URL for a stored object key (served by /api/media)."""
    return f"{MEDIA_URL_BASE}/{_normalize_key(key)}"


def media_key_from_ref(ref: str) -> Optional[str]:
    """Map a stored publicUrl / relativePath / URL to an object key.

    Accepts current forms (``/api/media/assessments/...``, ``assessments/...``)
    and legacy forms (``/uploads/assessments/...``, ``uploads/assessments/...``).
    Returns None when the ref does not point at the per-assessment namespace.
    """
    raw = (ref or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    path = parsed.path if parsed.scheme in ("http", "https") else raw
    path = path.replace("\\", "/")
    for marker in ("/api/media/", "api/media/"):
        idx = path.find(marker)
        if idx >= 0:
            path = path[idx + len(marker):]
            break
    path = path.lstrip("/")
    if path.startswith("uploads/"):
        path = path[len("uploads/"):]
    if path.startswith(f"{MEDIA_OBJECT_ROOT}/"):
        return _normalize_key(path)
    return None
