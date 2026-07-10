"""OpenAI Vision enrichment for feature narratives — dynamic pose→feature mapping.

CV measurements remain MediaPipe/OpenCV. When the text LLM provider is OpenAI,
selected pose photos are attached as multimodal context so GPT can ground prose
in the correct views without inventing scores.
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Any, Optional

from .config import FEATURE_VISION_POSES, PROTOCOL_FEATURE_IDS
from .llm_client import resolve_llm_provider
from .photo_storage import get_photo_storage

logger = logging.getLogger(__name__)

_VISION_MAX_EDGE = 1024
_VISION_JPEG_QUALITY = 85

POSE_LABELS = {
    "front": "front face",
    "topHead": "top-of-head / hairline",
    "leftProfile": "left profile",
    "rightProfile": "right profile",
    "left45": "left three-quarter",
    "right45": "right three-quarter",
    "smile": "smile",
}


def openai_vision_narrative_enabled() -> bool:
    """Vision attachments only when text LLM is OpenAI and not explicitly disabled."""
    flag = os.environ.get("OPENAI_VISION_NARRATIVE", "1").strip().lower()
    if flag in ("0", "false", "off", "no"):
        return False
    if resolve_llm_provider() != "openai":
        return False
    return bool(os.environ.get("OPENAI_API_KEY", "").strip())


def poses_for_feature(feature_id: str) -> list[str]:
    """Return ordered pose ids for a feature (dynamic map; unknown → front only)."""
    mapped = FEATURE_VISION_POSES.get(feature_id)
    if mapped:
        return list(mapped)
    if feature_id in PROTOCOL_FEATURE_IDS:
        return ["front"]
    return []


def _compress_jpeg(image_bytes: bytes) -> bytes:
    try:
        import cv2
        import numpy as np

        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return image_bytes
        h, w = img.shape[:2]
        scale = min(1.0, _VISION_MAX_EDGE / max(h, w))
        if scale < 1.0:
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        ok, encoded = cv2.imencode(
            ".jpg",
            img,
            [int(cv2.IMWRITE_JPEG_QUALITY), _VISION_JPEG_QUALITY],
        )
        if ok:
            return encoded.tobytes()
    except Exception:
        logger.debug("Vision image compress failed; using original bytes", exc_info=True)
    return image_bytes


def load_pose_image_bytes(
    assessment_id: str,
    pose_id: str,
    photos_meta: Optional[dict] = None,
) -> Optional[bytes]:
    """Load a stored pose JPEG from disk (local public storage)."""
    if not assessment_id or not pose_id:
        return None
    storage = get_photo_storage()
    path = storage.upload_root / assessment_id / f"{pose_id}.jpg"
    if path.is_file():
        return path.read_bytes()
    meta = (photos_meta or {}).get(pose_id) or {}
    rel = meta.get("relativePath")
    if rel:
        from pathlib import Path

        repo_public = Path(__file__).resolve().parent.parent / "public"
        candidate = repo_public / rel.replace("\\", "/").lstrip("/")
        if candidate.is_file():
            return candidate.read_bytes()
    return None


def pose_to_data_url(image_bytes: bytes) -> str:
    compressed = _compress_jpeg(image_bytes)
    b64 = base64.b64encode(compressed).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def vision_instruction_for_feature(feature_id: str, pose_ids: list[str]) -> str:
    """Text instruction telling the model which attached views to use."""
    if not pose_ids:
        return ""
    named = ", ".join(POSE_LABELS.get(p, p) for p in pose_ids)
    return (
        f"Attached photos for this {feature_id} section (in order): {named}. "
        "Use them only as visual context for wording. "
        "Do not invent scores or measurements; rely on measuredFacts for numbers. "
        "Do not mention photos, cameras, or that images were provided."
    )


def load_poses_as_image_parts(
    assessment_id: Optional[str],
    pose_ids: list[str],
    photos_meta: Optional[dict] = None,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Load specific poses as OpenAI image_url parts (when vision enabled)."""
    if not openai_vision_narrative_enabled() or not assessment_id:
        return [], []
    loaded: list[str] = []
    parts: list[dict[str, Any]] = []
    for pose_id in pose_ids:
        raw = load_pose_image_bytes(assessment_id, pose_id, photos_meta)
        if not raw:
            continue
        loaded.append(pose_id)
        parts.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": pose_to_data_url(raw),
                    "detail": "low",
                },
            }
        )
    return loaded, parts


def load_feature_vision_bundle(
    feature_id: str,
    *,
    assessment_id: Optional[str],
    photos_meta: Optional[dict] = None,
) -> tuple[list[str], list[dict[str, Any]]]:
    """Return (pose_ids_loaded, OpenAI image_url content parts)."""
    return load_poses_as_image_parts(
        assessment_id,
        poses_for_feature(feature_id),
        photos_meta,
    )


def build_multimodal_user_message(text: str, image_parts: list[dict[str, Any]]) -> Any:
    """Plain string when no images; otherwise OpenAI multimodal content list."""
    if not image_parts:
        return text
    return [{"type": "text", "text": text}, *image_parts]
