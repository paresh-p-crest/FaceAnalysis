"""Protocol persistence over the unified MediaStorage interface.

Stores the protocol bundle as JSON at assessments/{id}/protocol.json in whichever
media backend is active (local filesystem or Replit Object Storage).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional

from .media_storage import assessment_key, get_media_storage, public_url_for_key

PROTOCOL_FILE_VERSION = 1


@dataclass
class StoredProtocol:
    relativePath: str
    publicUrl: str
    contentType: str
    byteSize: int
    storedAt: str

    def to_dict(self) -> dict:
        return asdict(self)


class ProtocolStorage:
    """Protocol JSON persistence over the active MediaStorage backend."""

    def __init__(self, media=None):
        self.media = media or get_media_storage()

    @staticmethod
    def _key(assessment_id: str) -> str:
        return assessment_key(assessment_id, "protocol.json")

    def save_protocol(
        self,
        assessment_id: str,
        *,
        protocol_narrative: Optional[dict] = None,
        feature_narratives: Optional[dict] = None,
    ) -> StoredProtocol:
        key = self._key(assessment_id)
        payload = {
            "version": PROTOCOL_FILE_VERSION,
            "storedAt": datetime.now(timezone.utc).isoformat(),
            "protocolNarrative": protocol_narrative,
            "featureNarratives": feature_narratives,
        }
        raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.media.put_bytes(key, raw)
        return StoredProtocol(
            relativePath=key,
            publicUrl=public_url_for_key(key),
            contentType="application/json",
            byteSize=len(raw),
            storedAt=payload["storedAt"],
        )

    def load_protocol(self, assessment_id: str) -> Optional[dict]:
        raw = self.media.get_bytes(self._key(assessment_id))
        if not raw:
            return None
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None
        if not isinstance(payload, dict):
            return None
        # Ignore legacy protocolData key if present
        return {
            "protocolNarrative": payload.get("protocolNarrative"),
            "featureNarratives": payload.get("featureNarratives"),
            "storedAt": payload.get("storedAt"),
            "version": payload.get("version"),
        }

    def delete_protocol(self, assessment_id: str) -> None:
        self.media.delete(self._key(assessment_id))


def get_protocol_storage() -> ProtocolStorage:
    return ProtocolStorage()
