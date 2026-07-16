"""Generative projected AFTER face (provider-agnostic image edit).

Sends the stored front portrait plus a fixed best-groomed makeover prompt to
image_client (OpenAI or OpenRouter) and returns the edited image bytes for disk
storage. Also owns the projected-AFTER feature flag (``projected_after_enabled``).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .image_client import generate_image_edit, has_image_api_key, image_model, resolve_image_provider

logger = logging.getLogger(__name__)

PROJECTED_AFTER_PROMPT = """Photorealistic edit of the uploaded portrait — same person, same framing, angle, lighting, clothing.

Noticeably improve this person's skin and eyes: brighten the complexion, even out any redness or unevenness, add a healthy natural glow, and make the eyes look clearer, brighter, and more rested — a real, visible improvement, not a subtle one. Keep visible pores and natural skin texture — real skin, not airbrushed or plastic.

Style the hair into its most flattering, well-groomed shape with volume and shine — change length and style as needed for a great haircut. Choose whatever facial hair look, full beard, stubble, or clean-shaven, best suits this person's face, and style it to look genuinely great.

Same person throughout: same face shape, nose, lips, eyes, jawline, ears, and proportions — just their best-groomed, healthiest-looking version, not a different or generic face.""".strip()


def projected_after_enabled() -> bool:
    return os.environ.get("PROJECTED_AFTER_ENABLED", "false").lower() in ("1", "true", "yes", "on")


def build_projected_after_prompt(
    answers: Optional[dict] = None,
    cv_report: Optional[dict] = None,
    metrics: Optional[dict] = None,
) -> str:
    """Return the fixed best-groomed AFTER edit prompt (inputs ignored for API compat)."""
    return PROJECTED_AFTER_PROMPT


async def generate_projected_after_bytes(
    *,
    front_bytes: bytes,
    answers: Optional[dict],
    cv_report: Optional[dict],
    metrics: Optional[dict],
) -> dict:
    """Generate the AFTER image via the active image provider.

    Returns ``{"imageBytes": bytes|None, "error": str|None, "provider": str,
    "model": str, "prompt": str}``. Never raises for expected provider failures.
    """
    prompt = build_projected_after_prompt(answers or {}, cv_report or {}, metrics)
    provider = resolve_image_provider()
    if not has_image_api_key(provider):
        return {
            "imageBytes": None,
            "error": f"{provider} API key not set.",
            "provider": provider,
            "model": image_model(provider),
            "prompt": prompt,
        }
    result = await generate_image_edit(prompt, front_bytes, log_label="Projected AFTER image edit")
    return {
        "imageBytes": result.get("imageBytes"),
        "error": result.get("error"),
        "provider": result.get("provider") or provider,
        "model": result.get("model") or image_model(provider),
        "prompt": prompt,
    }
