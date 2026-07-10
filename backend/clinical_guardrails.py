"""Post-LLM clinical and policy validation for protocol narratives."""

from __future__ import annotations

import re
from typing import Optional

from .feature_context import build_feature_context
from .narrative_schemas import FEATURE_SUBSECTION_TITLES, FeatureNarrative
from .recommendation_rules import get_deterministic_recommendation_hints, deviation_to_tier, _feature_deviation_magnitude

BANNED_TERM_PATTERN = re.compile(
    r"\b(botox|filler|fillers|injectable|injectables|surgery|surgical|laser|lasers|"
    r"ipl|hifu|thermage|endolift|microneedling|co2|rhinoplasty|otoplasty|"
    r"prescription|tretinoin rx|isotretinoin|accutane|minoxidil|finasteride)\b",
    re.IGNORECASE,
)

SUPERLATIVE_PATTERN = re.compile(
    r"\b(perfect|flawless|dramatic transformation|guaranteed|100% improvement)\b",
    re.IGNORECASE,
)

NUMBER_PATTERN = re.compile(r"\b(\d{1,3})\s*/\s*100\b|\bscore\s+(\d{1,3})\b", re.IGNORECASE)


def _template_subsection_body(feature_id: str, title: str, ctx: dict) -> str:
    facts = ", ".join(ctx.get("measuredFacts") or ["stored measurements"])[:200]
    hints = get_deterministic_recommendation_hints(feature_id, ctx)
    hint = hints[0] if hints else "Focus on consistent non-surgical habits."
    return (
        f"Based on your assessment ({facts}), this area should be managed with conservative, "
        f"evidence-aligned non-surgical care. {hint} "
        "Reassess under consistent lighting after 30 days. Discuss persistent concerns with a qualified clinician."
    )


def template_feature_narrative(feature_id: str, ctx: dict) -> dict:
    titles = FEATURE_SUBSECTION_TITLES[feature_id]
    subsections = []
    for title in titles:
        body = _template_subsection_body(feature_id, title, ctx)
        if len(body) < 80:
            body = body + " " + "Maintain daily SPF, sleep, and hydration as foundational support for facial health."
        subsections.append(
            {
                "title": title,
                "body": body[:700],
                "evidenceTier": "lifestyle" if "dermatologist" in body.lower() else "otc",
            }
        )
    summary = f"Non-surgical guidance for {feature_id} based on stored measurements."
    description = (
        f"Your {feature_id} assessment reflects the measured values listed in this report. "
        + " ".join(ctx.get("limitations") or [])[:300]
    )
    return FeatureNarrative(
        featureId=feature_id,
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx.get("limitations") or [],
        summary=summary[:200],
        description=description[:600],
        subsections=subsections,
        recommendations=[
            "Daily broad-spectrum SPF 50 when outdoors.",
            "Consistent sleep and hydration.",
        ],
    ).model_dump()


def _allowed_numbers(ctx: dict) -> set[str]:
    allowed: set[str] = set()
    for fact in ctx.get("measuredFacts") or []:
        for match in NUMBER_PATTERN.finditer(fact):
            for g in match.groups():
                if g:
                    allowed.add(g)
    cv = ctx.get("cvMetrics") or {}
    score = cv.get("score")
    if score is not None:
        allowed.add(str(int(score)))
    return allowed


def validate_feature_narrative(
    narrative: FeatureNarrative,
    ctx: dict,
    *,
    answers: Optional[dict] = None,
) -> tuple[bool, list[str]]:
    errors: list[str] = []
    allowed_nums = _allowed_numbers(ctx)

    text_blob = " ".join(
        [narrative.summary, narrative.description]
        + [s.body for s in narrative.subsections]
        + list(narrative.recommendations)
    )

    if BANNED_TERM_PATTERN.search(text_blob):
        errors.append("Contains banned clinical/procedural terms")

    if SUPERLATIVE_PATTERN.search(text_blob):
        errors.append("Contains overstated outcome language")

    for match in NUMBER_PATTERN.finditer(text_blob):
        for g in match.groups():
            if g and g not in allowed_nums and int(g) > 15:
                errors.append(f"Numeric claim {g} not grounded in measured facts")

    contra = ctx.get("contraindications") or {}
    if contra.get("flags") and re.search(r"\bretinol\b", text_blob, re.I):
        if any("infection" in f.lower() or "allerg" in f.lower() for f in contra["flags"]):
            errors.append("Retinol mentioned despite contraindication flags")

    if narrative.featureId == "eyes" and re.search(r"\b(iris|eye color)\b", text_blob, re.I):
        if "sclera" not in text_blob.lower():
            errors.append("Iris/eye color mentioned without sclera-only framing")

    mag = _feature_deviation_magnitude(narrative.featureId, ctx)
    ceiling = deviation_to_tier(mag, (ctx.get("cvMetrics") or {}).get("score"))
    tier_order = {"lifestyle": 0, "otc": 1, "refer_clinician": 2}
    for sub in narrative.subsections:
        tier = sub.evidenceTier
        if tier_order.get(tier, 0) > tier_order.get(ceiling, 2):
            errors.append(f"evidenceTier {tier} exceeds allowed ceiling {ceiling} for measured deviation")
        if tier == "refer_clinician" and mag < 0.08 and ceiling != "refer_clinician":
            errors.append("refer_clinician tier used without notable measured deviation")

    return (len(errors) == 0, errors)


def validate_or_template(
    raw: Optional[dict],
    feature_id: str,
    ctx: dict,
    *,
    answers: Optional[dict] = None,
) -> dict:
    if raw:
        try:
            parsed = FeatureNarrative.model_validate(raw)
            ok, _errs = validate_feature_narrative(parsed, ctx, answers=answers)
            if ok:
                return parsed.model_dump()
        except Exception:
            pass
    return template_feature_narrative(feature_id, ctx)
