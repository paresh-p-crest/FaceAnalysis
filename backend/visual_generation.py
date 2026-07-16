"""AI visual variant generation for hair, outfit, and aging previews.

Delegates image edits to the provider-agnostic image_client (OpenAI Images Edits
or OpenRouter chat image modalities). Source images may be data URLs (legacy) or
persisted public URLs under photo storage.
"""

from __future__ import annotations

import logging
from typing import Optional

import httpx

from .image_client import generate_image_edit, has_image_api_key, resolve_image_provider
from .image_client import image_model as _image_model
from .image_utils import decode_image
from .media_storage import assessment_key, get_media_storage, media_key_from_ref

logger = logging.getLogger(__name__)

VARIANT_TYPES = ("hair", "outfit", "aging")

_VARIANT_TITLES = {
    "hair": "Hairstyle Preview",
    "outfit": "Outfit Styling Preview",
    "aging": "Healthy Aging Preview",
}

SHARED_VISUAL_OPENING = (
    "Photorealistic portrait edit of the supplied front-facing photo — the exact same person, "
    "same bone structure, eye color, skin tone, expression, head pose, camera distance, and lighting. "
    "Do not reshape the face or invent new features. "
    "No text, watermarks, or medical/surgical imagery."
)

_UNKNOWN_SENTINELS = frozenset({"unknown", "unspecified", "n/a", "na"})


def _cv_anchors(cv_report: dict) -> dict:
    """Ready-to-insert phrases so missing CV values stay grammatical."""
    face_shape = (cv_report.get("faceShape") or {}).get("shape")
    hairline = (cv_report.get("hair") or {}).get("hairline")
    skin_tone = (cv_report.get("skin") or {}).get("tone")

    def _ok(value) -> bool:
        return bool(value) and str(value).strip().lower() not in _UNKNOWN_SENTINELS

    return {
        "face_shape_phrase": (
            f"this {str(face_shape).strip().lower()} face" if _ok(face_shape) else "their face shape"
        ),
        "hairline_phrase": (
            f"a {str(hairline).strip().lower()} hairline" if _ok(hairline) else "their hairline"
        ),
        "skin_tone_phrase": (
            f"their {str(skin_tone).strip().lower()} skin tone" if _ok(skin_tone) else "their skin tone"
        ),
    }


def build_visual_prompt(variant_type: str, answers: dict, cv_report: dict, metrics: Optional[dict]) -> str:
    """Production edit prompts for Images API — identity-preserving, non-clinical.

    ``answers`` and ``metrics`` are unused (signature kept for call-site compat).
    """
    anchors = _cv_anchors(cv_report or {})

    if variant_type == "hair":
        body = (
            "Change only the hairstyle and hair finish — leave the skin, face, and everything else "
            "exactly as it is. Give this person their most flattering possible haircut for their face "
            "shape and hairline: a real barbershop-or-salon-quality cut with natural volume, shine, "
            f"and clean styling, for {anchors['face_shape_phrase']} with {anchors['hairline_phrase']}. "
            "Keep the same hair color as the source unless a close, natural refinement clearly improves "
            "the framing."
        )
    elif variant_type == "outfit":
        body = (
            "Change only the clothing and styling from the shoulders up — leave the face and hair "
            "exactly as they are. Dress this person in refined, contemporary wardrobe and colors that "
            f"complement {anchors['skin_tone_phrase']} and {anchors['face_shape_phrase']}. "
            "Professional portrait presentation, tasteful and not costume-like."
        )
    elif variant_type == "aging":
        body = (
            "Apply a gentle, realistic healthy-aging preview of about 8-12 years — subtle skin "
            "maturation only, like fine lines and mild texture change, nothing exaggerated. "
            "Keep this person clearly and immediately recognizable as themselves, just older. "
            "Avoid dramatic wrinkles, weight change, or a fear-based aging look."
        )
    else:
        raise ValueError(f"Unsupported visual variant type: {variant_type}")

    return f"{SHARED_VISUAL_OPENING}\n\n{body}"


def _looks_like_data_or_b64(value: str) -> bool:
    v = value.strip()
    if v.startswith("data:image/"):
        return True
    # Raw base64 payloads are long and lack path separators
    if len(v) > 200 and "/" not in v[:80] and not v.startswith("http"):
        return True
    return False


def _resolve_ref_bytes(url_or_path: str) -> Optional[bytes]:
    """Resolve a stored media ref (publicUrl / relativePath / URL) to bytes."""
    key = media_key_from_ref(url_or_path or "")
    if not key:
        return None
    return get_media_storage().get_bytes(key)


def load_pose_bytes(assessment_id: str, pose_id: str = "front") -> Optional[bytes]:
    return get_media_storage().get_bytes(assessment_key(assessment_id, f"{pose_id}.jpg"))


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
            data = _resolve_ref_bytes(str(ref))
            if data:
                return data, f"photos.front.{key}"

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

    # 4) Stored media ref (publicUrl / relativePath / URL) → bytes
    data = _resolve_ref_bytes(src)
    if data:
        return data, "cv_report_url_file"

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
