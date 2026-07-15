"""AI visual variant generation for hair, outfit, and aging previews.

Delegates image edits to the provider-agnostic image_client (OpenAI Images Edits
or OpenRouter chat image modalities). Source images may be data URLs (legacy) or
persisted public URLs under photo storage.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx

from .image_client import generate_image_edit, has_image_api_key, resolve_image_provider
from .image_client import image_model as _image_model
from .image_utils import decode_image
from .photo_storage import get_photo_storage

logger = logging.getLogger(__name__)

VARIANT_TYPES = ("hair", "outfit", "aging")

_VARIANT_TITLES = {
    "hair": "Hairstyle Preview",
    "outfit": "Outfit Styling Preview",
    "aging": "Healthy Aging Preview",
}

_REPO_ROOT = Path(__file__).resolve().parent.parent


def _profile_line(answers: dict) -> str:
    goals = answers.get("goals") or "unspecified"
    if isinstance(goals, list):
        goals = ", ".join(str(g) for g in goals[:4]) or "unspecified"
    return (
        f"age range {answers.get('ageRange') or 'unspecified'}; "
        f"gender {answers.get('gender') or 'unspecified'}; "
        f"skin type {answers.get('skinType') or 'unspecified'}; "
        f"goals {goals}"
    )


def _face_context(cv_report: dict, metrics: Optional[dict]) -> str:
    face_shape = (cv_report.get("faceShape") or {}).get("shape") or "unknown"
    hair = cv_report.get("hair") or {}
    skin = cv_report.get("skin") or {}
    visual_age = (metrics or {}).get("visualAge")
    age_bit = f"visual age estimate {visual_age}; " if visual_age not in (None, "", "unknown") else ""
    return (
        f"face shape {face_shape}; {age_bit}"
        f"hairline {hair.get('hairline') or 'unknown'}; "
        f"hair color {hair.get('hairColor') or 'unknown'}; "
        f"skin tone {skin.get('tone') or 'unknown'}; "
        f"skin texture {skin.get('texture') or 'unknown'}"
    )


def build_visual_prompt(variant_type: str, answers: dict, cv_report: dict, metrics: Optional[dict]) -> str:
    """Production edit prompts for Images API — identity-preserving, non-clinical."""
    profile = _profile_line(answers or {})
    context = _face_context(cv_report or {}, metrics)

    shared = (
        "Photorealistic portrait edit of the supplied front-facing photo. "
        "Preserve identity: same person, facial bone structure, eye color, skin tone, "
        "expression, head pose, camera distance, and lighting. "
        "Do not reshape the face, alter measured proportions, or invent new facial features. "
        "No text, watermarks, logos, or collage. "
        "No medical, surgical, injectable, or clinical procedure imagery. "
    )

    if variant_type == "hair":
        return (
            shared
            + "Change only the hairstyle and hair finish. "
            + "Recommend a polished, salon-realistic cut and styling that flatters the measured face shape and hairline. "
            + "Keep hair color close to the source unless a subtle refinement improves framing. "
            + "Natural texture, clean edges, premium aesthetic-report quality. "
            + f"Client: {profile}. Context: {context}."
        )
    if variant_type == "outfit":
        return (
            shared
            + "Change only clothing and soft styling from the shoulders up. "
            + "Keep the face and hair unchanged. "
            + "Apply refined, contemporary wardrobe and color that complements the client's coloring and facial balance. "
            + "Professional portrait presentation; tasteful, non-costume, no logos. "
            + f"Client: {profile}. Context: {context}."
        )
    if variant_type == "aging":
        return (
            shared
            + "Apply a gentle healthy-aging preview of about 8–12 years. "
            + "Use subtle, realistic skin maturation only (fine lines, mild texture change). "
            + "Keep the person clearly recognizable. "
            + "Avoid exaggerated wrinkles, fear-based aging, weight distortion, or cartoon effects. "
            + f"Client: {profile}. Context: {context}."
        )
    raise ValueError(f"Unsupported visual variant type: {variant_type}")


def _looks_like_data_or_b64(value: str) -> bool:
    v = value.strip()
    if v.startswith("data:image/"):
        return True
    # Raw base64 payloads are long and lack path separators
    if len(v) > 200 and "/" not in v[:80] and not v.startswith("http"):
        return True
    return False


def _public_url_to_local_path(url_or_path: str) -> Optional[Path]:
    """Map /uploads/assessments/{id}/{pose}.jpg → local file under photo storage or public/."""
    raw = (url_or_path or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    path = parsed.path if parsed.scheme in ("http", "https") else raw
    path = path.replace("\\", "/")
    marker = "/uploads/assessments/"
    idx = path.find(marker)
    if idx < 0 and path.startswith("uploads/assessments/"):
        rel = path
    elif idx >= 0:
        rel = path[idx + 1 :]  # uploads/assessments/...
    else:
        return None

    storage = get_photo_storage()
    # relativePath style: uploads/assessments/{id}/{file}
    parts = rel.split("/")
    if len(parts) >= 4 and parts[0] == "uploads" and parts[1] == "assessments":
        assessment_id, filename = parts[2], parts[3]
        candidate = storage.upload_root / assessment_id / filename
        if candidate.is_file():
            return candidate

    # Fallback: Next.js public dir (artifacts/myface); see backend/config.py.
    public_candidate = _REPO_ROOT / "artifacts" / "myface" / "public" / rel
    if public_candidate.is_file():
        return public_candidate
    return None


def load_pose_bytes(assessment_id: str, pose_id: str = "front") -> Optional[bytes]:
    storage = get_photo_storage()
    path = storage.upload_root / assessment_id / f"{pose_id}.jpg"
    if path.is_file():
        return path.read_bytes()
    return None


def resolve_source_image_bytes(
    *,
    assessment_id: Optional[str] = None,
    assessment_photos: Optional[dict] = None,
    source_image: Optional[str] = None,
) -> tuple[Optional[bytes], Optional[str]]:
    """
    Resolve portrait bytes for image edits.

    Preference order:
    1. Stored front pose file for assessment_id
    2. assessment.photos.front relativePath / publicUrl on disk
    3. source_image data URL / base64
    4. source_image public URL mapped to local file
    5. HTTP(S) fetch of source_image (last resort)
    """
    # 1) Canonical front pose on disk
    if assessment_id:
        front = load_pose_bytes(assessment_id, "front")
        if front:
            return front, "assessment_front_file"

    # 2) Photos map metadata
    photos = assessment_photos or {}
    front_meta = photos.get("front") if isinstance(photos, dict) else None
    if isinstance(front_meta, dict):
        for key in ("relativePath", "publicUrl"):
            ref = front_meta.get(key)
            if not ref:
                continue
            local = _public_url_to_local_path(str(ref))
            if local:
                return local.read_bytes(), f"photos.front.{key}"

    if not source_image or not isinstance(source_image, str):
        return None, None

    src = source_image.strip()

    # 3) Data URL / raw base64
    if _looks_like_data_or_b64(src):
        try:
            return decode_image(src), "data_url"
        except ValueError as exc:
            logger.warning("AI visuals: could not decode data URL source (%s)", exc)
            return None, None

    # 4) Local public URL / path
    local = _public_url_to_local_path(src)
    if local:
        return local.read_bytes(), "cv_report_url_file"

    # 5) Remote fetch
    if src.startswith("http://") or src.startswith("https://"):
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.get(src)
            if resp.status_code < 400 and resp.content:
                return resp.content, "remote_url"
        except Exception as exc:
            logger.warning("AI visuals: failed to fetch source image URL: %s", exc)
            return None, None

    logger.warning("AI visuals: unrecognized source image reference (len=%s)", len(src))
    return None, None


async def _generate_edit_image(prompt: str, image_bytes: bytes) -> dict:
    """Provider-agnostic image edit → {imageSrc: data URL | None, error}."""
    result = await generate_image_edit(prompt, image_bytes, log_label="AI visuals image edit")
    data_url = result.get("dataUrl")
    if data_url:
        return {"imageSrc": data_url, "error": None}
    return {"imageSrc": None, "error": result.get("error") or "Image generation returned no image."}


def _pick_cv_source_ref(cv_report: dict) -> Optional[str]:
    for section in ("faceShape", "symmetry", "proportions"):
        src = (cv_report.get(section) or {}).get("imageSrc")
        if isinstance(src, str) and src.strip():
            return src.strip()
    photos = cv_report.get("photos") or {}
    front = photos.get("front")
    if isinstance(front, str) and front.strip():
        return front.strip()
    return None


async def generate_visual_variants(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    source_image: Optional[str] = None,
    variant_types: Optional[list[str]] = None,
    assessment_id: Optional[str] = None,
    assessment_photos: Optional[dict] = None,
) -> dict:
    selected = [v for v in (variant_types or list(VARIANT_TYPES)) if v in VARIANT_TYPES]
    if not selected:
        selected = list(VARIANT_TYPES)

    source_ref = source_image or _pick_cv_source_ref(cv_report or {})
    image_bytes, source_kind = resolve_source_image_bytes(
        assessment_id=assessment_id,
        assessment_photos=assessment_photos,
        source_image=source_ref,
    )

    provider = resolve_image_provider()
    has_key = has_image_api_key(provider)
    can_generate = bool(image_bytes and has_key)

    if not has_key:
        resolve_note = f"{provider} API key not set."
    elif not image_bytes:
        resolve_note = (
            "Front portrait could not be loaded for image edits. "
            "Re-run analysis so photos are stored, then try again."
        )
    else:
        resolve_note = None

    logger.info(
        "AI visuals start (assessment=%s source=%s can_generate=%s variants=%s)",
        assessment_id,
        source_kind or "none",
        can_generate,
        ",".join(selected),
    )

    variants = []
    for variant_type in selected:
        prompt = build_visual_prompt(variant_type, answers or {}, cv_report or {}, metrics)
        image_src = None
        error = resolve_note
        status = "prompt_ready"

        if can_generate and image_bytes:
            try:
                result = await _generate_edit_image(prompt, image_bytes)
                image_src = result.get("imageSrc")
                error = result.get("error")
                status = "generated" if image_src else "blocked"
            except Exception as exc:
                logger.exception("AI visuals unexpected failure for %s", variant_type)
                image_src = None
                error = str(exc) or "Image generation failed."
                status = "blocked"
        elif not can_generate:
            status = "blocked" if error else "prompt_ready"

        variants.append(
            {
                "type": variant_type,
                "title": _VARIANT_TITLES[variant_type],
                "prompt": prompt,
                "imageSrc": image_src,
                "status": status,
                "error": error,
            }
        )

    return {
        "source": provider if (can_generate or any(v.get("imageSrc") for v in variants)) else "blocked",
        "model": _image_model(),
        "sourceKind": source_kind,
        "variants": variants,
    }
