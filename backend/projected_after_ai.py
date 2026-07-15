"""Generative projected AFTER face (provider-agnostic image edit).

Sends the stored front portrait plus an identity- and measurement-preserving
"enhancement preview" prompt to image_client (OpenAI or OpenRouter) and returns the
edited image bytes for disk storage. The improvement focus is derived from CV weakness
signals (``projection_strengths``), so the AFTER emphasizes the features the analysis
flagged as weakest — without reshaping the face or altering measured proportions.

Also owns the projected-AFTER feature flag (``projected_after_enabled``) and the
``projection_strengths`` weighting (previously in the now-removed OpenCV projected_after
module, which is superseded by this generative path).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from .image_client import generate_image_edit, has_image_api_key, image_model, resolve_image_provider
from .visual_generation import _face_context, _profile_line

logger = logging.getLogger(__name__)


def projected_after_enabled() -> bool:
    return os.environ.get("PROJECTED_AFTER_ENABLED", "false").lower() in ("1", "true", "yes", "on")


def _clamp_strength(v: float) -> float:
    return min(0.22, max(0.12, v))


def _from_score(score: Optional[float]) -> float:
    if score is None:
        return _clamp_strength((88 - 72) / 100)
    try:
        return _clamp_strength((88 - float(score)) / 100)
    except (TypeError, ValueError):
        return _clamp_strength(0.16)


def _section_score(cv_report: dict, *keys: str) -> Optional[float]:
    for key in keys:
        section = cv_report.get(key) if isinstance(cv_report, dict) else None
        if isinstance(section, dict) and section.get("score") is not None:
            try:
                return float(section["score"])
            except (TypeError, ValueError):
                continue
    return None


def projection_strengths(cv_report: Optional[dict], metrics: Optional[dict]) -> dict[str, float]:
    """Per-feature deviation weight (higher == weaker feature) used to focus the prompt.

    Mirrors utils/anthropometrics.js projectionStrengths (simplified).
    """
    cv = cv_report or {}
    dev = {}
    if isinstance(metrics, dict):
        anthro = metrics.get("anthropometrics") or {}
        if isinstance(anthro, dict):
            dev = anthro.get("deviations") or {}

    def dev_val(key: str, default: float = 10.0) -> float:
        try:
            return float(dev.get(key, default))
        except (TypeError, ValueError):
            return default

    dev_avg = 10.0
    if dev:
        nums = [float(v) for v in dev.values() if isinstance(v, (int, float))]
        if nums:
            dev_avg = sum(nums) / len(nums)

    return {
        "hair": _from_score(_section_score(cv, "hair")),
        "eyebrows": _clamp_strength(dev_val("symmetry") / 100 + _from_score(80)),
        "eyes": _clamp_strength(dev_val("canthal", 8) / 120 + _from_score(_section_score(cv, "eyes"))),
        "skin": _from_score(_section_score(cv, "skin")),
        "nose": _clamp_strength(dev_val("nose", 8) / 110),
        "jaw": _clamp_strength(dev_val("jaw", 8) / 100 + _from_score(_section_score(cv, "jaw", "jawChin"))),
        "lips": _from_score(_section_score(cv, "lips", "mouth")),
        "cheeks": _from_score(_section_score(cv, "cheeks")),
        "chin": _from_score(_section_score(cv, "chin", "jawChin")),
        "neck": _from_score(_section_score(cv, "neck")),
        "ears": _from_score(_section_score(cv, "ears")),
        "full": _clamp_strength(dev_avg / 80),
    }

# Higher projection strength == larger measured deviation == weaker feature to emphasize.
_FEATURE_GUIDANCE = {
    "skin": "even out skin tone and reduce blemishes, redness, and shine for clear, healthy-looking skin",
    "hair": "give the hair a neater, healthier, well-groomed finish",
    "eyes": "brighten the eyes and gently reduce under-eye shadowing and puffiness",
    "cheeks": "restore subtle, healthy midface fullness and smoothness",
    "jaw": "present a slightly cleaner, more defined jawline WITHOUT changing bone structure",
    "chin": "present a balanced, well-defined chin WITHOUT changing bone structure",
    "lips": "naturally hydrated, healthy lips",
    "eyebrows": "tidy, well-groomed eyebrows",
    "nose": "even lighting across the nose WITHOUT reshaping it",
    "neck": "smooth, healthy neck skin",
    "ears": "even skin tone on the ears",
}


def _focus_features(cv_report: Optional[dict], metrics: Optional[dict], top_n: int = 4) -> list[str]:
    strengths = projection_strengths(cv_report, metrics)
    ranked = sorted(
        ((k, v) for k, v in strengths.items() if k != "full" and k in _FEATURE_GUIDANCE),
        key=lambda kv: kv[1],
        reverse=True,
    )
    return [k for k, _ in ranked[:top_n]]


def build_projected_after_prompt(
    answers: Optional[dict],
    cv_report: Optional[dict],
    metrics: Optional[dict],
) -> str:
    """Identity/measurement-preserving 'after protocol' edit prompt."""
    profile = _profile_line(answers or {})
    context = _face_context(cv_report or {}, metrics)
    focus_keys = _focus_features(cv_report, metrics)
    focus = "; ".join(_FEATURE_GUIDANCE[k] for k in focus_keys) or (
        "even skin tone, healthy grooming, and a refreshed, well-rested complexion"
    )
    return (
        "Photorealistic 'after' preview of the supplied front-facing portrait: the SAME person "
        "after following a realistic skincare, grooming, and healthy-lifestyle protocol. "
        "Preserve identity strictly — same person, facial bone structure, measured proportions, "
        "eye color, expression, head pose, camera distance, framing, and lighting. "
        "Do NOT reshape or slim the face, do NOT alter jaw, nose, chin, or eye geometry, "
        "and do NOT invent new facial features. "
        "Apply only natural, non-surgical improvements: " + focus + ". "
        "Keep it subtle and believable — no makeup transformation, no beautification-filter look, "
        "no airbrushed plastic skin. No text, watermarks, logos, borders, or collage. "
        "No medical, surgical, injectable, or clinical-procedure imagery. "
        f"Client: {profile}. Context: {context}."
    )


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
