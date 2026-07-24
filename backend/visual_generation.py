"""AI visual variant generation for hair, outfit, and aging previews.

Delegates image edits to the provider-agnostic image_client (OpenAI Images Edits
or OpenRouter chat image modalities). Source images may be data URLs (legacy) or
persisted public URLs under photo storage.
"""

from __future__ import annotations

import logging
import re
from typing import Optional, Union

import httpx

from .image_client import generate_image_edit, has_image_api_key, resolve_image_provider
from .image_client import image_model as _image_model
from .image_utils import decode_image
from .media_storage import assessment_key, get_media_storage, media_key_from_ref
from .photo_storage import save_ai_visual_image
from .config import (
    AI_VISUALS_AGING_COUNT,
    AI_VISUALS_HAIR_COUNT,
    AI_VISUALS_OUTFIT_COUNT,
)
from .visual_style_banks import (
    AGING_TIERS,
    hair_styles_for,
    outfit_styles_for,
    iter_all_hair_styles,
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


def _cv_anchors(cv_report: dict, *, include_hair_color: bool = True) -> dict:
    """Ready-to-insert phrases so missing CV values stay grammatical.

    Hair-style prompts pass ``include_hair_color=False`` so color is locked from
    the reference image only (never named from CV).
    """
    hair = cv_report.get("hair") or {}
    face_shape = (cv_report.get("faceShape") or {}).get("shape")
    hairline = hair.get("hairline")
    hair_color = hair.get("hairColor")
    hair_texture = hair.get("textureType")
    skin_tone = (cv_report.get("skin") or {}).get("skinTone")

    def _ok(value) -> bool:
        return bool(value) and str(value).strip().lower() not in _UNKNOWN_SENTINELS

    hair_detail = ""
    if include_hair_color:
        if _ok(hair_color) and _ok(hair_texture):
            hair_detail = (
                f"{str(hair_color).strip().lower()} {str(hair_texture).strip().lower()} hair"
            )
        elif _ok(hair_color):
            hair_detail = f"{str(hair_color).strip().lower()} hair"
        elif _ok(hair_texture):
            hair_detail = f"{str(hair_texture).strip().lower()} hair"

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

    Style selection is preference-aware upstream. ``answers`` / ``metrics`` unused
    in prompt text; hair color is locked from the reference image (not CV labels).
    """
    _ = (answers, metrics)
    anchors = _cv_anchors(cv_report or {}, include_hair_color=False)
    return (
        f"{SHARED_VISUAL_OPENING}\n\n"
        "Change only the hairstyle and hair finish — leave the skin, face, and everything else "
        "exactly as it is. Give this person a "
        f"{style.display_name}: {style.descriptor}. For {anchors['face_shape_phrase']} with {anchors['hairline_phrase']} — "
        "preserve the exact hair color and natural texture from the reference image; "
        "do not dye, bleach, lighten, darken, or shift undertone. Change cut, shape, and finish only."
    )


def build_outfit_baseline_prompt() -> str:
    """Strict white-tee edit for outfit slider BEFORE (UI comparison only)."""
    return (
        "Photorealistic portrait edit of the supplied portrait — the exact same person, "
        "same bone structure, eye color, skin tone, expression, head pose, and lighting. "
        "Do not reshape the face or invent new features. No text, watermarks, or logos.\n\n"
        "Change only the clothing: put this person in a plain simple white crew-neck t-shirt. "
        "Leave the face and hair exactly as they are. Show head, neck, and shoulders so "
        "the white tee is clearly visible. No jacket, jewelry, logos, patterns, or other styling."
    )


def build_outfit_prompt(
    style: OutfitStyleSpec,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
) -> str:
    """Production edit prompt for a single outfit occasion.

    Style selection is preference-aware upstream; ``answers`` / ``metrics`` unused
    in prompt text.
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


def _persist_edit_data_url(
    data_url: str,
    *,
    assessment_id: Optional[str],
    storage_path: Optional[tuple[str, ...]],
) -> dict:
    """Write edit bytes to media storage when assessment_id + path are set."""
    if not assessment_id or not storage_path:
        return {"imageSrc": data_url, "error": None}
    try:
        image_bytes = decode_image(data_url)
        stored = save_ai_visual_image(assessment_id, *storage_path, image_bytes=image_bytes)
        return {
            "imageSrc": stored.publicUrl,
            "relativePath": stored.relativePath,
            "contentType": stored.contentType,
            "error": None,
        }
    except Exception as exc:
        logger.exception("AI visuals: failed to persist image for %s", storage_path)
        return {"imageSrc": None, "error": str(exc) or "Failed to store generated image."}


async def _generate_edit_image(
    prompt: str,
    image_bytes: bytes,
    *,
    assessment_id: Optional[str] = None,
    storage_path: Optional[tuple[str, ...]] = None,
) -> dict:
    """Provider-agnostic image edit → persisted media URL or legacy data URL."""
    result = await generate_image_edit(prompt, image_bytes, log_label="AI visuals image edit")
    data_url = result.get("dataUrl")
    if not data_url:
        return {"imageSrc": None, "error": result.get("error") or "Image generation returned no image."}
    persisted = _persist_edit_data_url(
        data_url,
        assessment_id=assessment_id,
        storage_path=storage_path,
    )
    out = {"imageSrc": persisted.get("imageSrc"), "error": persisted.get("error")}
    if persisted.get("relativePath"):
        out["relativePath"] = persisted["relativePath"]
    if persisted.get("contentType"):
        out["contentType"] = persisted["contentType"]
    return out


def _all_style_specs_for_type(
    variant_type: str,
    cv_report: dict,
    answers: Optional[dict] = None,
) -> list[Union[HairStyleSpec, OutfitStyleSpec, AgingTierSpec]]:
    """Return full style bank for one variant type (no env count limit)."""
    if variant_type == "hair":
        return hair_styles_for(cv_report or {}, answers)
    if variant_type == "outfit":
        return outfit_styles_for(answers)
    if variant_type == "aging":
        return list(AGING_TIERS)
    raise ValueError(f"Unsupported visual variant type: {variant_type}")


def _style_specs_for_type(
    variant_type: str,
    cv_report: dict,
    answers: Optional[dict] = None,
) -> list[Union[HairStyleSpec, OutfitStyleSpec, AgingTierSpec]]:
    """Return style specs for one variant type, limited by env counts."""
    specs = _all_style_specs_for_type(variant_type, cv_report, answers)
    limit = _VARIANT_COUNT_BY_TYPE.get(variant_type, 0)
    return specs[:limit] if limit else []


def find_style_by_id(
    style_id: str,
    cv_report: dict,
    *,
    answers: Optional[dict] = None,
    existing_variants: Optional[list] = None,
) -> tuple[str, Union[HairStyleSpec, OutfitStyleSpec, AgingTierSpec]]:
    """Resolve (variant_type, style_spec) for a styleId from banks or existing variants."""
    sid = (style_id or "").strip()
    if not sid:
        raise ValueError("styleId is required.")

    for variant_type in VARIANT_TYPES:
        for spec in _all_style_specs_for_type(variant_type, cv_report or {}, answers):
            if spec.style_id == sid:
                return variant_type, spec

    # Hair styleIds may live in another preference bank (regen after preference drift).
    for spec in iter_all_hair_styles():
        if spec.style_id == sid:
            return "hair", spec

    # Fallback: type from existing envelope (regen of a stored card even if bank drifted).
    for variant in existing_variants or []:
        if not isinstance(variant, dict) or variant.get("styleId") != sid:
            continue
        variant_type = variant.get("type")
        if variant_type not in VARIANT_TYPES:
            break
        title = variant.get("title") or sid
        if variant_type == "hair":
            return variant_type, HairStyleSpec(style_id=sid, display_name=title, descriptor=title)
        if variant_type == "outfit":
            return variant_type, OutfitStyleSpec(style_id=sid, occasion_name=title, descriptor=title)
        years = 5
        m = re.search(r"(\d+)", sid)
        if m:
            years = int(m.group(1))
        return variant_type, AgingTierSpec(
            style_id=sid,
            years=years,
            skin_text=title,
            soft_tissue_text="",
            hair_dark_text="",
            hair_light_text="",
        )

    raise ValueError(f"Unknown styleId: {sid}")


def merge_ai_visuals(
    existing: Optional[dict],
    regenerated: dict,
    *,
    style_id: Optional[str] = None,
    replaced_types: Optional[list[str]] = None,
) -> dict:
    """Merge regenerated variants into an existing ai_visuals envelope.

    - style_id: replace/append that one card; keep siblings.
    - replaced_types: replace all cards of those types; keep other types.
    - neither: use regenerated variants as-is (full replace).
    """
    existing = existing if isinstance(existing, dict) else {}
    regenerated = regenerated if isinstance(regenerated, dict) else {}
    existing_variants = [
        v for v in (existing.get("variants") or []) if isinstance(v, dict)
    ]
    new_variants = [
        v for v in (regenerated.get("variants") or []) if isinstance(v, dict)
    ]

    if style_id:
        sid = style_id.strip()
        by_id = {v.get("styleId"): v for v in new_variants if v.get("styleId")}
        replacement = by_id.get(sid)
        merged: list[dict] = []
        replaced = False
        for variant in existing_variants:
            if variant.get("styleId") == sid and replacement is not None:
                merged.append(replacement)
                replaced = True
            elif variant.get("styleId") != sid:
                merged.append(variant)
        if not replaced and replacement is not None:
            merged.append(replacement)
    elif replaced_types:
        types_set = {t for t in replaced_types if t in VARIANT_TYPES}
        merged = []
        for variant_type in VARIANT_TYPES:
            if variant_type in types_set:
                merged.extend(v for v in new_variants if v.get("type") == variant_type)
            else:
                merged.extend(v for v in existing_variants if v.get("type") == variant_type)
        # Preserve any non-standard types from existing.
        known = set(VARIANT_TYPES)
        merged.extend(v for v in existing_variants if v.get("type") not in known)
    else:
        merged = new_variants

    out = {**existing, **regenerated, "variants": merged}
    if regenerated.get("variantCounts"):
        out["variantCounts"] = regenerated["variantCounts"]
    elif existing.get("variantCounts"):
        out["variantCounts"] = existing["variantCounts"]
    else:
        out["variantCounts"] = dict(_VARIANT_COUNT_BY_TYPE)

    # outfitBaseline: full/category outfit regen replaces; hair/aging-only keeps existing.
    regen_outfit = bool(
        style_id
        and any(v.get("type") == "outfit" for v in new_variants)
    ) or bool(replaced_types and "outfit" in replaced_types) or (
        not style_id and not replaced_types
    )
    if not regen_outfit and existing.get("outfitBaseline") and "outfitBaseline" not in regenerated:
        out["outfitBaseline"] = existing["outfitBaseline"]

    return out


def _variant_title(
    variant_type: str,
    style_spec: Union[HairStyleSpec, OutfitStyleSpec, AgingTierSpec],
) -> str:
    if variant_type == "hair":
        return style_spec.display_name
    if variant_type == "outfit":
        return style_spec.occasion_name
    return f"+{style_spec.years} years"


async def _generate_outfit_baseline(
    *,
    image_bytes: bytes,
    assessment_id: Optional[str],
    can_generate: bool,
    resolve_note: Optional[str],
    existing_ai_visuals: Optional[dict],
    style_id_set: Optional[set[str]],
) -> Optional[dict]:
    """White-tee comparison image for outfit slider BEFORE (UI only)."""
    if style_id_set and existing_ai_visuals:
        existing = existing_ai_visuals.get("outfitBaseline")
        if isinstance(existing, dict) and existing.get("imageSrc"):
            return existing

    prompt = build_outfit_baseline_prompt()
    baseline = {
        "imageSrc": None,
        "prompt": prompt,
        "status": "prompt_ready",
        "error": resolve_note,
    }

    if not can_generate or not image_bytes:
        if resolve_note:
            baseline["status"] = "blocked"
        return baseline

    try:
        storage = ("outfit-baseline.jpg",) if assessment_id else None
        result = await _generate_edit_image(
            prompt,
            image_bytes,
            assessment_id=assessment_id,
            storage_path=storage,
        )
        baseline["imageSrc"] = result.get("imageSrc")
        baseline["error"] = result.get("error")
        if result.get("relativePath"):
            baseline["relativePath"] = result["relativePath"]
        if result.get("contentType"):
            baseline["contentType"] = result["contentType"]
        baseline["status"] = "generated" if baseline["imageSrc"] else "blocked"
    except Exception as exc:
        logger.exception("AI visuals outfit baseline generation failed")
        baseline["error"] = str(exc) or "Outfit baseline generation failed."
        baseline["status"] = "blocked"

    return baseline


async def generate_visual_variants(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    source_image: Optional[str] = None,
    variant_types: Optional[list[str]] = None,
    style_ids: Optional[list[str]] = None,
    assessment_id: Optional[str] = None,
    assessment_photos: Optional[dict] = None,
    projected_after: Optional[dict] = None,
    require_projected_after: bool = False,
    existing_ai_visuals: Optional[dict] = None,
) -> dict:
    selected = [v for v in (variant_types or list(VARIANT_TYPES)) if v in VARIANT_TYPES]
    if not selected:
        selected = list(VARIANT_TYPES)

    style_id_set = {s for s in (style_ids or []) if s} or None

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
        "AI visuals start (assessment=%s source=%s can_generate=%s variants=%s style_ids=%s)",
        assessment_id,
        source_kind or "none",
        can_generate,
        ",".join(selected),
        ",".join(sorted(style_id_set)) if style_id_set else "",
    )

    variants = []
    outfit_baseline = None

    if "outfit" in selected:
        outfit_baseline = await _generate_outfit_baseline(
            image_bytes=image_bytes,
            assessment_id=assessment_id,
            can_generate=can_generate,
            resolve_note=resolve_note,
            existing_ai_visuals=existing_ai_visuals,
            style_id_set=style_id_set,
        )

    for variant_type in selected:
        if style_id_set:
            # Look up exact specs (may be outside env count slice when regenerating one card).
            style_specs = []
            for sid in style_id_set:
                try:
                    found_type, spec = find_style_by_id(
                        sid, cv_report or {}, answers=answers or {}
                    )
                except ValueError:
                    continue
                if found_type == variant_type:
                    style_specs.append(spec)
        else:
            style_specs = _style_specs_for_type(
                variant_type, cv_report or {}, answers or {}
            )

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
            edit_result = None

            if can_generate and image_bytes:
                try:
                    storage_path = None
                    if assessment_id:
                        storage_path = (variant_type, f"{style_spec.style_id}.jpg")
                    edit_result = await _generate_edit_image(
                        prompt,
                        image_bytes,
                        assessment_id=assessment_id,
                        storage_path=storage_path,
                    )
                    image_src = edit_result.get("imageSrc")
                    error = edit_result.get("error")
                    status = "generated" if image_src else "blocked"
                except Exception as exc:
                    logger.exception(
                        "AI visuals unexpected failure for %s/%s",
                        variant_type,
                        getattr(style_spec, "style_id", "unknown"),
                    )
                    image_src = None
                    error = str(exc) or "Image generation failed."
                    status = "blocked"
            elif not can_generate:
                status = "blocked" if error else "prompt_ready"

            variant_entry = {
                "type": variant_type,
                "styleId": style_spec.style_id,
                "title": _variant_title(variant_type, style_spec),
                "prompt": prompt,
                "imageSrc": image_src,
                "status": status,
                "error": error,
            }
            if isinstance(edit_result, dict):
                if edit_result.get("relativePath"):
                    variant_entry["relativePath"] = edit_result["relativePath"]
                if edit_result.get("contentType"):
                    variant_entry["contentType"] = edit_result["contentType"]

            variants.append(variant_entry)

    out = {
        "source": provider if (can_generate or any(v.get("imageSrc") for v in variants)) else "blocked",
        "model": _image_model(),
        "sourceKind": source_kind,
        "variantCounts": dict(_VARIANT_COUNT_BY_TYPE),
        "variants": variants,
    }
    if outfit_baseline is not None:
        out["outfitBaseline"] = outfit_baseline
    return out
