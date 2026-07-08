"""AI visual variant generation for hair, outfit, and aging previews."""

from __future__ import annotations

import base64
import os
from typing import Optional

import httpx

VARIANT_TYPES = ("hair", "outfit", "aging")


def _image_model() -> str:
    return os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")


def _profile_line(answers: dict) -> str:
    return (
        f"age range {answers.get('ageRange', 'unspecified')}, "
        f"gender {answers.get('gender', 'unspecified')}, "
        f"skin type {answers.get('skinType', 'unspecified')}, "
        f"goals {answers.get('goals', 'unspecified')}"
    )


def _face_context(cv_report: dict, metrics: Optional[dict]) -> str:
    face_shape = (cv_report.get("faceShape") or {}).get("shape", "unknown")
    hair = cv_report.get("hair") or {}
    skin = cv_report.get("skin") or {}
    visual_age = (metrics or {}).get("visualAge", "unknown")
    return (
        f"face shape: {face_shape}; visual age estimate: {visual_age}; "
        f"hairline: {hair.get('hairline', 'unknown')}; hair color: {hair.get('hairColor', 'unknown')}; "
        f"skin tone/texture: {skin.get('tone', 'unknown')} / {skin.get('texture', 'unknown')}"
    )


def build_visual_prompt(variant_type: str, answers: dict, cv_report: dict, metrics: Optional[dict]) -> str:
    profile = _profile_line(answers or {})
    context = _face_context(cv_report or {}, metrics)
    shared = (
        "Create a realistic editorial preview from the supplied portrait. "
        "Preserve the person's identity, facial structure, skin tone, expression, and camera angle. "
        "Do not change measured facial proportions. Avoid medical, surgical, or injectable treatment imagery. "
    )
    if variant_type == "hair":
        return (
            shared
            + "Show a polished hairstyle recommendation that complements the measured face shape and hairline. "
            + "Keep the result natural, salon-realistic, and suitable for a premium aesthetic report. "
            + f"Client profile: {profile}. CV context: {context}."
        )
    if variant_type == "outfit":
        return (
            shared
            + "Show refined outfit and color styling from shoulders upward, suitable for a professional portrait. "
            + "Use tasteful wardrobe styling that complements the client's coloring and facial balance. "
            + f"Client profile: {profile}. CV context: {context}."
        )
    if variant_type == "aging":
        return (
            shared
            + "Create a gentle healthy-aging preview, about 8 to 12 years older, with realistic skin maturation only. "
            + "Keep the person recognizable and avoid exaggerated wrinkles or fear-based aging effects. "
            + f"Client profile: {profile}. CV context: {context}."
        )
    raise ValueError("Unsupported visual variant type")


def _data_url_to_bytes(data_url: str) -> bytes:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return base64.b64decode(data_url)


async def _generate_openai_image(prompt: str, image_data_url: str) -> dict:
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not key:
        return {"imageSrc": None, "error": "OpenAI API key not set."}

    image_bytes = _data_url_to_bytes(image_data_url)
    files = {"image": ("portrait.jpg", image_bytes, "image/jpeg")}
    data = {
        "model": _image_model(),
        "prompt": prompt,
        "size": "1024x1024",
        "quality": "low",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            "https://api.openai.com/v1/images/edits",
            headers={"Authorization": f"Bearer {key}"},
            data=data,
            files=files,
        )
    payload = response.json()
    if response.status_code >= 400:
        message = payload.get("error", {}).get("message") or "OpenAI image generation failed."
        return {"imageSrc": None, "error": message}
    b64 = (payload.get("data") or [{}])[0].get("b64_json")
    if not b64:
        return {"imageSrc": None, "error": "OpenAI returned no image data."}
    return {"imageSrc": f"data:image/png;base64,{b64}", "error": None}


async def generate_visual_variants(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    source_image: Optional[str],
    variant_types: Optional[list[str]] = None,
) -> dict:
    selected = variant_types or list(VARIANT_TYPES)
    variants = []
    can_generate = bool(source_image and os.environ.get("OPENAI_API_KEY", "").strip())

    for variant_type in selected:
        if variant_type not in VARIANT_TYPES:
            continue
        prompt = build_visual_prompt(variant_type, answers or {}, cv_report or {}, metrics)
        image_src = None
        error = None
        status = "prompt_ready"
        if can_generate:
            result = await _generate_openai_image(prompt, source_image)
            image_src = result.get("imageSrc")
            error = result.get("error")
            status = "generated" if image_src else "blocked"
        variants.append(
            {
                "type": variant_type,
                "title": {
                    "hair": "Hairstyle Preview",
                    "outfit": "Outfit Styling Preview",
                    "aging": "Healthy Aging Preview",
                }[variant_type],
                "prompt": prompt,
                "imageSrc": image_src,
                "status": status,
                "error": error,
            }
        )

    return {
        "source": "openai" if can_generate else "prompt-only",
        "model": _image_model(),
        "variants": variants,
    }
