"""Deterministic recommendation hints passed into LLM prompts (not client-facing prose)."""

from __future__ import annotations

from typing import Any

EvidenceTier = str  # lifestyle | otc | refer_clinician


def magnitude_label(magnitude: float) -> str:
    if magnitude >= 0.12:
        return "notable"
    if magnitude >= 0.06:
        return "moderate"
    if magnitude >= 0.03:
        return "mild"
    return "minimal"


def deviation_to_tier(magnitude: float, score: Any = None) -> EvidenceTier:
    """Map CV deviation magnitude to recommended evidence tier ceiling."""
    if isinstance(score, (int, float)) and score >= 88 and magnitude < 0.05:
        return "lifestyle"
    if magnitude >= 0.12:
        return "refer_clinician"
    if magnitude >= 0.05:
        return "otc"
    return "lifestyle"


def _feature_deviation_magnitude(feature_id: str, ctx: dict) -> float:
    dev_facts = ctx.get("deviationFacts") or []
    if dev_facts:
        for fact in dev_facts:
            if "magnitude:" in fact:
                try:
                    return float(fact.split("magnitude:")[-1].strip())
                except ValueError:
                    pass
    cv = ctx.get("cvMetrics") or {}
    score = cv.get("score")
    if isinstance(score, (int, float)):
        return max(0, (85 - score) / 200)
    return 0.04


def get_tier_hints(feature_id: str, ctx: dict) -> list[str]:
    """Severity-gated tier guidance for subsection evidenceTier fields."""
    mag = _feature_deviation_magnitude(feature_id, ctx)
    label = magnitude_label(mag)
    ceiling = deviation_to_tier(mag, (ctx.get("cvMetrics") or {}).get("score"))
    hints = [
        f"Deviation magnitude for this feature: {label} ({mag:.2f}).",
        "Close each subsection with ONE recommendation sentence matching its evidenceTier.",
        "Tier ladder: lifestyle = routine/topical/skincare-only; otc = non-invasive OTC/at-home; "
        "refer_clinician = in-office consultation referral only (never prescribe procedures).",
        f"Maximum tier for this feature unless subsection severity clearly warrants escalation: {ceiling}.",
    ]
    if ceiling == "lifestyle":
        hints.append("Prefer lifestyle tier for all subsections; use otc only for clearly measured mild deviations.")
    elif ceiling == "refer_clinician":
        hints.append("At least one subsection may use refer_clinician for the most notable measured deviation.")
    return hints


def get_deterministic_recommendation_hints(feature_id: str, ctx: dict) -> list[str]:
    hints: list[str] = list(get_tier_hints(feature_id, ctx))
    cv = ctx.get("cvMetrics") or {}
    score = cv.get("score")
    if isinstance(score, (int, float)) and score >= 85:
        hints.append("Overall measured score is strong; emphasize maintenance and protection, not aggressive intervention.")

    contra = ctx.get("contraindications") or {}
    if contra.get("flags"):
        hints.append("Respect contraindication flags; avoid actives that conflict with reported allergies, infections, or recent retinoids.")

    if feature_id == "skin":
        redness = cv.get("redness") or cv.get("clarity")
        if redness and str(redness).lower() not in ("normal", "good", "even"):
            hints.append("Elevated redness: prioritize gentle cleansing, niacinamide or azelaic acid OTC before strong acids.")
        skin_type = (contra.get("skinType") or "").lower()
        if "sensitive" in skin_type:
            hints.append("Sensitive skin: introduce actives gradually; patch test; daily SPF 50.")

    if feature_id == "hair":
        if cv.get("dataSource") == "estimated" or not cv.get("densityPct"):
            hints.append("Hair density not directly measured: do not state Norwood stage or prescribe minoxidil; focus on gentle scalp care and photo guidance.")
        elif cv.get("norwoodStage") and int(cv.get("norwoodStage", 1)) >= 3:
            hints.append("Significant thinning signals: suggest discussing options with a dermatologist; OTC scalp care only in report text.")

    if feature_id == "eyes":
        hints.append("Do not describe iris color; use sclera and periorbital metrics only.")
        m = cv.get("eyeAnalysis") or {}
        if m.get("underEyeHealth") in ("Shadowed", "Dark circles present"):
            hints.append("Under-eye shadowing: sleep, hydration, caffeine-based OTC eye serum, daily SPF; no procedural claims.")

    if feature_id in ("jaw", "neck", "chin"):
        hints.append("Structural change from grooming/posture/neck exercise only; no surgical or injectable framing.")

    if feature_id == "ears":
        hints.append("Ear metrics are proportional only; grooming and hairstyle framing, not otoplasty.")

    return hints
