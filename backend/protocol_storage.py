"""Protocol persistence — local JSON files (dev) with cloud migration path."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Protocol

PROTOCOL_FILE_VERSION = 1

_REPO_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_UPLOAD_ROOT = _REPO_ROOT / "public" / "uploads" / "assessments"


@dataclass
class StoredProtocol:
    relativePath: str
    publicUrl: str
    contentType: str
    byteSize: int
    storedAt: str

    def to_dict(self) -> dict:
        return asdict(self)


class ProtocolStorage(Protocol):
    def save_protocol(
        self,
        assessment_id: str,
        *,
        protocol_data: dict,
        protocol_narrative: Optional[dict] = None,
    ) -> StoredProtocol: ...

    def load_protocol(self, assessment_id: str) -> Optional[dict]: ...

    def delete_protocol(self, assessment_id: str) -> None: ...


class LocalPublicProtocolStorage:
    """Writes protocol bundle JSON under public/uploads/assessments/{id}/protocol.json."""

    def __init__(self, upload_root: Optional[Path] = None, public_url_prefix: str = "/uploads/assessments"):
        self.upload_root = upload_root or _DEFAULT_UPLOAD_ROOT
        self.public_url_prefix = public_url_prefix.rstrip("/")

    def _protocol_path(self, assessment_id: str) -> Path:
        return self.upload_root / assessment_id / "protocol.json"

    def save_protocol(
        self,
        assessment_id: str,
        *,
        protocol_data: dict,
        protocol_narrative: Optional[dict] = None,
    ) -> StoredProtocol:
        dest_path = self._protocol_path(assessment_id)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": PROTOCOL_FILE_VERSION,
            "storedAt": datetime.now(timezone.utc).isoformat(),
            "protocolData": protocol_data,
            "protocolNarrative": protocol_narrative,
        }
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        dest_path.write_bytes(raw)
        rel = f"uploads/assessments/{assessment_id}/protocol.json"
        return StoredProtocol(
            relativePath=rel,
            publicUrl=f"{self.public_url_prefix}/{assessment_id}/protocol.json",
            contentType="application/json",
            byteSize=len(raw),
            storedAt=payload["storedAt"],
        )

    def load_protocol(self, assessment_id: str) -> Optional[dict]:
        dest_path = self._protocol_path(assessment_id)
        if not dest_path.exists():
            return None
        try:
            payload = json.loads(dest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict):
            return None
        return {
            "protocolData": payload.get("protocolData"),
            "protocolNarrative": payload.get("protocolNarrative"),
            "storedAt": payload.get("storedAt"),
            "version": payload.get("version"),
        }

    def delete_protocol(self, assessment_id: str) -> None:
        dest_path = self._protocol_path(assessment_id)
        if dest_path.exists():
            dest_path.unlink()


def get_protocol_storage() -> LocalPublicProtocolStorage:
    backend = os.environ.get("PROTOCOL_STORAGE_BACKEND", "local").lower()
    if backend != "local":
        # Future S3/R2 backend — fall back to local until implemented.
        pass
    root = os.environ.get("PROTOCOL_UPLOAD_ROOT") or os.environ.get("PHOTO_UPLOAD_ROOT")
    prefix = os.environ.get("PROTOCOL_PUBLIC_URL_PREFIX", "/uploads/assessments")
    if root:
        return LocalPublicProtocolStorage(upload_root=Path(root), public_url_prefix=prefix)
    return LocalPublicProtocolStorage(public_url_prefix=prefix)
