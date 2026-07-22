"""AI visual variant generation for hair, outfit, and aging previews.

Delegates image edits to the provider-agnostic image_client (OpenAI Images Edits
or OpenRouter chat image modalities). Source images may be data URLs (legacy) or
persisted public URLs under photo storage.
"""

from __future__ import annotations

import logging
from typing import Optional, Union

import httpx

from .image_client import generate_image_edit, has_image_api_key, resolve_image_provider
from .image_client import image_model as _image_model
from .image_utils import decode_image
from .media_storage import assessment_key, get_media_storage, media_key_from_ref
from .config import (
    AI_VISUALS_AGING_COUNT,
    AI_VISUALS_HAIR_COUNT,
    AI_VISUALS_OUTFIT_COUNT,
)
from .visual_style_banks import (
    AGING_TIERS,
    OUTFIT_STYLES,
    hair_styles_for,
    HairStyleSpec,
    AgingTierSpec,
    OutfitStyleSpec,
)

logger = logging.getLogger(__name__)

VARIANT_TYPES = ("hair", "outfit", "aging")

_VARIANT_COUNT_BY_TYPE = {
    "hair": AI_VISUALS_HAIR_COUNT,
    "outfit": AI_VISUALS_OUTFIT_COUNT,
    "aging": AI_VISUALS_AGING_COUNT,
}

_VARIANT_TITLES = {
    "hair": "Hairstyle Preview",
    "outfit": "Outfit Styling Preview",
    "aging": "Healthy Aging Preview",
}

SHARED_VISUAL_OPENING = (
    "Photorealistic portrait edit of the supplied portrait — the exact same person, "
    "same bone structure, eye color, skin tone, expression, head pose, camera distance, and lighting. "
    "Do not reshape the face or invent new features. "
    "No text, watermarks, or medical/surgical imagery."
)

_UNKNOWN_SENTINELS = frozenset({"unknown", "unspecified", "n/a", "na"})

# Hair colors where temple graying instructions would be misleading.
_LIGHT_OR_GRAY_HAIR = frozenset({
    "blonde",
    "blond",
    "light blonde",
    "platinum",
    "platinum blonde",
    "light brown",
    "gray",
    "grey",
    "white",
    "silver",
    "salt and pepper",
    "salt-and-pepper",
    "fair",
})


def _cv_anchors(cv_report: dict) -> dict:
    """Ready-to-insert phrases so missing CV values stay grammatical."""
    hair = cv_report.get("hair") or {}
    face_shape = (cv_report.get("faceShape") or {}).get("shape")
    hairline = hair.get("hairline")
    hair_color = hair.get("hairColor")
    hair_texture = hair.get("textureType")
    skin_tone = (cv_report.get("skin") or {}).get("skinTone")

    def _ok(value) -> bool:
        return bool(value) and str(value).strip().lower() not in _UNKNOWN_SENTINELS

    if _ok(hair_color) and _ok(hair_texture):
        hair_detail = (
            f"{str(hair_color).strip().lower()} {str(hair_texture).strip().lower()} hair"
        )
    elif _ok(hair_color):
        hair_detail = f"{str(hair_color).strip().lower()} hair"
    elif _ok(hair_texture):
        hair_detail = f"{str(hair_texture).strip().lower()} hair"
    else:
        hair_detail = ""

    return {
        "face_shape_phrase": (
            f"this {str(face_shape).strip().lower()} face" if _ok(face_shape) else "their face shape"
        ),
        "hairline_phrase": (
            f"a {str(hairline).strip().lower()} hairline" if _ok(hairline) else "their hairline"
        ),
        "hair_detail_suffix": f", {hair_detail}" if hair_detail else "",
        "skin_tone_phrase": (
            f"their {str(skin_tone).strip().lower()} skin tone" if _ok(skin_tone) else "their skin tone"
        ),
    }


def _hair_color_supports_graying(cv_report: dict) -> bool:
    """True when CV hair color is dark enough for subtle graying language."""
    hair = (cv_report or {}).get("hair") or {}
    color = hair.get("hairColor")
    if not color or str(color).strip().lower() in _UNKNOWN_SENTINELS:
        return False
    key = str(color).strip().lower()
    if key in _LIGHT_OR_GRAY_HAIR:
        return False
    if any(token in key for token in ("blond", "gray", "grey", "white", "silver", "platinum", "fair")):
        return False
    return True


def _aging_magnitude_text(style: AgingTierSpec, cv_report: dict) -> str:
    hair_line = style.hair_dark_text if _hair_color_supports_graying(cv_report) else style.hair_light_text
    return (
        f"Skin: {style.skin_text}. "
        f"Hair: {hair_line}. "
        f"Soft tissue: {style.soft_tissue_text}."
    )


def build_hair_prompt(
    style: HairStyleSpec,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
) -> str:
    """Production edit prompt for a single hairstyle style.

    ``answers`` and ``metrics`` are unused (signature kept for call-site compat).
    """
    _ = (answers, metrics)
    anchors = _cv_anchors(cv_report or {})
    return (
        f"{SHARED_VISUAL_OPENING}\n\n"
        "Change only the hairstyle and hair finish — leave the skin, face, and everything else "
        "exactly as it is. Give this person a "
        f"{style.display_name}: {style.descriptor}. For {anchors['face_shape_phrase']} with {anchors['hairline_phrase']}{anchors['hair_detail_suffix']} — "
        "keep the same color and natural texture unless the style specifically calls for it."
    )


def build_outfit_prompt(
    style: OutfitStyleSpec,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
) -> str:
    """Production edit prompt for a single outfit occasion.

    ``answers`` and ``metrics`` are unused (signature kept for call-site compat).
    """
    _ = (answers, metrics)
    anchors = _cv_anchors(cv_report or {})
    return (
        f"{SHARED_VISUAL_OPENING}\n\n"
        "Change only the clothing and styling from the shoulders up — leave the face and hair "
        "exactly as they are. Dress this person in a "
        f"{style.occasion_name} look: {style.descriptor}, in colors that complement {anchors['skin_tone_phrase']} and {anchors['face_shape_phrase']}. "
        "Professional portrait presentation, tasteful and not costume-like."
    )


def build_aging_prompt(
    style: AgingTierSpec,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
) -> str:
    """Production edit prompt for a single aging tier.

    ``answers`` and ``metrics`` are unused (signature kept for call-site compat).
    """
    _ = (answers, metrics)
    years = style.years
    magnitude = _aging_magnitude_text(style, cv_report or {})
    return (
        f"{SHARED_VISUAL_OPENING}\n\n"
        "Apply a realistic healthy-aging preview of about "
        f"{years} years, affecting skin, hair, and soft tissue naturally and proportionally. "
        f"{magnitude} "
        "Keep this person clearly and immediately recognizable as themselves, just older — "
        "preserve bone structure, eye shape, and facial proportions exactly. "
        "Avoid dramatic changes, weight change, or a fear-based aging look."
    )


def build_visual_prompt(
    variant_type: str,
    style: Union[HairStyleSpec, OutfitStyleSpec, AgingTierSpec],
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
) -> str:
    """Route to the correct prompt builder for a given variant+style spec."""
    if variant_type == "hair":
        assert isinstance(style, HairStyleSpec)
        return build_hair_prompt(style, answers, cv_report, metrics)
    if variant_type == "outfit":
        assert isinstance(style, OutfitStyleSpec)
        return build_outfit_prompt(style, answers, cv_report, metrics)
    if variant_type == "aging":
        assert isinstance(style, AgingTierSpec)
        return build_aging_prompt(style, answers, cv_report, metrics)
    raise ValueError(f"Unsupported visual variant type: {variant_type}")


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
    projected_after: Optional[dict] = None,
    require_projected_after: bool = False,
) -> tuple[Optional[bytes], Optional[str]]:
    """
    Resolve portrait bytes for AI visual image edits.

    Uses assessment **front (BEFORE)** pose, then photos map / source_image refs.
    Projected AFTER is no longer used as the edit source (FE + BE aligned).
    """
    # Previously: required projected AFTER when require_projected_after=True.
    # if require_projected_after and assessment_id:
    #     projected = load_projected_full(assessment_id, projected_after)
    #     if projected:
    #         return projected, "projected_after_full"
    #     return None, None
    _ = (projected_after, require_projected_after)  # retained for call-site compatibility

    # Canonical front pose on disk (BEFORE)
    if assessment_id:
        front = load_pose_bytes(assessment_id, "front")
        if front:
            return front, "assessment_front_file"

    # Photos map metadata
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

    if _looks_like_data_or_b64(src):
        try:
            return decode_image(src), "data_url"
        except ValueError as exc:
            logger.warning("AI visuals: could not decode data URL source (%s)", exc)
            return None, None

    data = _resolve_ref_bytes(src)
    if data:
        return data, "cv_report_url_file"

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


def _style_specs_for_type(
    variant_type: str,
    cv_report: dict,
) -> list[Union[HairStyleSpec, OutfitStyleSpec, AgingTierSpec]]:
    """Return style specs for one variant type, limited by env counts."""
    if variant_type == "hair":
        specs = hair_styles_for(cv_report or {})
    elif variant_type == "outfit":
        specs = list(OUTFIT_STYLES)
    elif variant_type == "aging":
        specs = list(AGING_TIERS)
    else:
        raise ValueError(f"Unsupported visual variant type: {variant_type}")
    limit = _VARIANT_COUNT_BY_TYPE.get(variant_type, 0)
    return specs[:limit] if limit else []


async def generate_visual_variants(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    source_image: Optional[str] = None,
    variant_types: Optional[list[str]] = None,
    assessment_id: Optional[str] = None,
    assessment_photos: Optional[dict] = None,
    projected_after: Optional[dict] = None,
    require_projected_after: bool = False,
) -> dict:
    selected = [v for v in (variant_types or list(VARIANT_TYPES)) if v in VARIANT_TYPES]
    if not selected:
        selected = list(VARIANT_TYPES)

    image_bytes, source_kind = resolve_source_image_bytes(
        assessment_id=assessment_id,
        assessment_photos=assessment_photos,
        source_image=source_image,
        projected_after=projected_after,
        require_projected_after=require_projected_after,
    )

    provider = resolve_image_provider()
    has_key = has_image_api_key(provider)
    can_generate = bool(image_bytes and has_key)

    if not has_key:
        resolve_note = f"{provider} API key not set."
    elif not image_bytes:
        resolve_note = (
            "Front (BEFORE) portrait could not be loaded for image edits. "
            "Ensure the assessment front photo is stored, then try again."
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
        style_specs = _style_specs_for_type(variant_type, cv_report or {})

        # One edit per style spec (no mega-prompt).
        for style_spec in style_specs:
            prompt = build_visual_prompt(
                variant_type,
                style_spec,
                answers or {},
                cv_report or {},
                metrics,
            )

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
                    logger.exception("AI visuals unexpected failure for %s/%s", variant_type, getattr(style_spec, "style_id", "unknown"))
                    image_src = None
                    error = str(exc) or "Image generation failed."
                    status = "blocked"
            elif not can_generate:
                status = "blocked" if error else "prompt_ready"

            if variant_type == "hair":
                title = style_spec.display_name
            elif variant_type == "outfit":
                title = style_spec.occasion_name
            else:
                title = f"+{style_spec.years} years"
            variants.append(
                {
                    "type": variant_type,
                    "styleId": style_spec.style_id,
                    "title": title,
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
        "variantCounts": dict(_VARIANT_COUNT_BY_TYPE),
        "variants": variants,
    }
