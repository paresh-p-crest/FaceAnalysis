"""Post-LLM clinical and policy validation for protocol narratives."""

from __future__ import annotations

import re
from typing import Optional

from .feature_context import build_feature_context
from .narrative_schemas import FEATURE_SUBSECTION_TITLES, FeatureNarrative
from .recommendation_rules import get_deterministic_recommendation_hints, deviation_to_tier, _feature_deviation_magnitude

# Allow "non-surgical" / "non surgical" while still banning standalone surgery/surgical claims.
BANNED_TERM_PATTERN = re.compile(
    r"(?<!non-)(?<!non\s)\b(surgery|surgical)\b|"
    r"\b(botox|filler|fillers|injectable|injectables|laser|lasers|"
    r"ipl|hifu|thermage|endolift|microneedling|co2|rhinoplasty|otoplasty|"
    r"prescription|tretinoin rx|isotretinoin|accutane|minoxidil|finasteride)\b",
    re.IGNORECASE,
)

SUPERLATIVE_PATTERN = re.compile(
    r"\b(perfect|flawless|dramatic transformation|guaranteed|100% improvement)\b",
    re.IGNORECASE,
)

NUMBER_PATTERN = re.compile(r"\b(\d{1,3})\s*/\s*100\b|\bscore\s+(\d{1,3})\b", re.IGNORECASE)

FEATURE_DISPLAY = {
    "hair": "hair and scalp",
    "eyes": "periorbital region",
    "nose": "nasal proportions",
    "cheeks": "midface and cheeks",
    "jaw": "jawline",
    "lips": "lip complex",
    "chin": "chin projection",
    "skin": "skin quality",
    "neck": "neck and submental contour",
    "ears": "ear proportions",
}


def _facts_phrase(ctx: dict, limit: int = 120) -> str:
    """Short human-readable cue list (score + up to 2 labels), not a raw metric dump."""
    facts = [f for f in (ctx.get("measuredFacts") or []) if f]
    cv = ctx.get("cvMetrics") or {}
    parts: list[str] = []
    score = cv.get("score")
    if isinstance(score, (int, float)):
        label = cv.get("scoreLabel")
        parts.append(f"score {int(score)}/100" + (f" ({label})" if label else ""))
    # Prefer short qualitative facts over long key:value dumps
    for fact in facts:
        cleaned = fact.strip()
        if ":" in cleaned and len(cleaned) > 40:
            # Take value side of key:value when present
            cleaned = cleaned.split(":", 1)[-1].strip()
        if cleaned and cleaned.lower() not in {p.lower() for p in parts}:
            parts.append(cleaned)
        if len(parts) >= 3:
            break
    if not parts:
        return "the subject's stored facial measurements for this region"
    return ", ".join(parts)[:limit]


def _template_subsection_body(feature_id: str, title: str, ctx: dict) -> str:
    facts = _facts_phrase(ctx)
    hints = get_deterministic_recommendation_hints(feature_id, ctx)
    # Skip meta tier hints; keep actionable clinical hints.
    actionable = [
        h for h in hints
        if not h.startswith("Deviation magnitude")
        and not h.startswith("Close each subsection")
        and not h.startswith("Tier ladder")
        and not h.startswith("Maximum tier")
        and not h.startswith("Prefer lifestyle")
        and not h.startswith("At least one subsection")
    ]
    hint = actionable[0] if actionable else (
        "Prioritize consistent sleep, hydration, daily broad-spectrum SPF 50 outdoors, "
        "and gentle cleansing as foundational support."
    )
    label = FEATURE_DISPLAY.get(feature_id, feature_id)
    title_l = title.lower()

    openers = {
        "hair style": (
            f"The subject's {label} analysis shows {facts}. Styles that balance facial thirds "
            f"and keep the forehead and temples tidy without aggressive chemical processing are appropriate. {hint} "
            "Reassess under consistent lighting after 30 days."
        ),
        "hair loss": (
            f"Based on the subject's scalp and density findings ({facts}), focus on conservative maintenance "
            f"rather than aggressive claims. {hint} Gentle cleansing, avoiding excessive heat, and "
            "discussing persistent thinning with a dermatologist are appropriate next steps. "
            "This estimate is educational, not a clinical diagnosis."
        ),
        "hair health": (
            f"The subject's hair health cues ({facts}) support mild shampoo, lightweight conditioning, and heat protection. "
            f"{hint} Reassess after 30 days of consistent care."
        ),
        "eyebrows": (
            f"Brow framing influences upper-face balance. Based on the subject's measurements ({facts}), "
            f"favor light grooming, brow gel, and symmetry-focused shaping rather than aggressive removal. {hint} "
            "Reassess brow balance under even lighting after 30 days."
        ),
        "eyelashes": (
            f"Lash presentation contributes to the periorbital frame. Based on the subject's analysis ({facts}), "
            f"maintain lid hygiene, avoid harsh makeup removers, and consider a conditioning lash serum at night if tolerated. {hint}"
        ),
        "eyes": (
            f"The subject's ocular and lid metrics ({facts}) support conservative periorbital care. "
            f"Support symmetry and comfort with sleep, hydration, and daily SPF; avoid rubbing. {hint} "
            "Discuss persistent concerns with a qualified clinician."
        ),
        "under eye": (
            f"Under-eye appearance is sensitive to sleep, hydration, and vascular shadowing. "
            f"Based on the subject's cues ({facts}), caffeine-based OTC eye care, SPF, and lifestyle consistency are appropriate. {hint} "
            "Reassess after 30 days under consistent lighting."
        ),
    }

    key = title_l.strip()
    if key in openers:
        body = openers[key]
    else:
        body = (
            f"The subject's {label} analysis ({title}) shows {facts}. "
            f"Based on that, stay with conservative non-surgical habits. {hint} "
            "Reassess under consistent lighting after 30 days. Discuss persistent concerns with a qualified clinician."
        )
    return body


def _template_summary(feature_id: str, ctx: dict) -> str:
    facts = _facts_phrase(ctx, 100)
    label = FEATURE_DISPLAY.get(feature_id, feature_id)
    score = (ctx.get("cvMetrics") or {}).get("score")
    score_bit = f" The current score is {int(score)}/100." if isinstance(score, (int, float)) else ""
    return (
        f"Prioritize the subject's {label} findings ({facts}).{score_bit} "
        "Focus on grooming, topical care, SPF, sleep, and hydration for 30 days before reassessing."
    )[:200]


def _template_description(feature_id: str, ctx: dict) -> str:
    facts = _facts_phrase(ctx, 160)
    label = FEATURE_DISPLAY.get(feature_id, feature_id)
    limits = " ".join(ctx.get("limitations") or [])[:220]
    # Strip tech jargon from limitations if present
    for banned in ("MediaPipe", "OpenCV", "computer-vision", "computer vision"):
        limits = limits.replace(banned, "photo-based")
    return (
        f"The subject's {label} assessment reflects the measured values ({facts}). "
        f"{limits} Recommendations remain educational and non-surgical."
    )[:600]


def template_feature_narrative(feature_id: str, ctx: dict) -> dict:
    titles = FEATURE_SUBSECTION_TITLES[feature_id]
    subsections = []
    for title in titles:
        body = _template_subsection_body(feature_id, title, ctx)
        if len(body) < 120:
            body = (
                body
                + " Maintain daily SPF, adequate sleep, and hydration as foundational support for facial health."
            )
        subsections.append(
            {
                "title": title,
                "body": body[:700],
                "evidenceTier": "lifestyle" if "dermatologist" in body.lower() else "otc",
            }
        )
    return FeatureNarrative(
        featureId=feature_id,
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx.get("limitations") or [],
        summary=_template_summary(feature_id, ctx),
        description=_template_description(feature_id, ctx),
        subsections=subsections,
        recommendations=[
            "Daily broad-spectrum SPF 50 when outdoors.",
            "Consistent sleep and hydration.",
            "Reassess under consistent lighting after 30 days.",
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
    norwood = cv.get("norwoodStage")
    if norwood is not None:
        allowed.add(str(int(norwood)))
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


def rewrite_to_subject_voice(text: str) -> str:
    """Convert second-person coaching copy to Qoves-style third person."""
    if not isinstance(text, str) or not text.strip():
        return text
    out = text
    pairs = [
        (re.compile(r"\bA practical 30-day plan for you\b", re.I), "A practical 30-day plan for the subject"),
        (re.compile(r"\bfrom your facial measurements\b", re.I), "from the subject's facial measurements"),
        (re.compile(r"\bBased on your\b"), "Based on the subject's"),
        (re.compile(r"\bbased on your\b"), "based on the subject's"),
        (re.compile(r"\bPrioritize your\b"), "Prioritize the subject's"),
        (re.compile(r"\bprioritize your\b"), "prioritize the subject's"),
        (re.compile(r"\bYour feature-specific priorities\b"), "Feature-specific priorities for the subject"),
        (re.compile(r"\bYour measured strengths\b"), "Measured strengths for the subject"),
        (re.compile(r"\bYour primary opportunities\b"), "Primary opportunities for the subject"),
        (re.compile(r"\bYour assessment shows\b"), "The subject's assessment shows"),
        (re.compile(r"\byourself\b", re.I), "themselves"),
        (re.compile(r"\bfor you\b", re.I), "for the subject"),
        (re.compile(r"\byou can\b", re.I), "the subject can"),
        (re.compile(r"\byou may\b", re.I), "the subject may"),
        (re.compile(r"\byou're\b", re.I), "the subject is"),
        (re.compile(r"\bYou've\b"), "The subject has"),
        (re.compile(r"\byou've\b"), "the subject has"),
        (re.compile(r"\bYour\b"), "The subject's"),
        (re.compile(r"\byour\b"), "the subject's"),
        (re.compile(r"\bYou\b"), "The subject"),
        (re.compile(r"\byou\b"), "the subject"),
    ]
    for pattern, repl in pairs:
        out = pattern.sub(repl, out)
    return re.sub(r"the subject's's", "the subject's", out, flags=re.I)


def _rewrite_narrative_dict(data: dict) -> dict:
    out = dict(data)
    for key in ("summary", "description"):
        if isinstance(out.get(key), str):
            out[key] = rewrite_to_subject_voice(out[key])
    subs = []
    for sub in out.get("subsections") or []:
        if not isinstance(sub, dict):
            continue
        item = dict(sub)
        if isinstance(item.get("body"), str):
            item["body"] = rewrite_to_subject_voice(item["body"])
        subs.append(item)
    if subs:
        out["subsections"] = subs
    recs = out.get("recommendations")
    if isinstance(recs, list):
        out["recommendations"] = [
            rewrite_to_subject_voice(r) if isinstance(r, str) else r for r in recs
        ]
    return out


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
                return _rewrite_narrative_dict(parsed.model_dump())
        except Exception:
            pass
    return _rewrite_narrative_dict(template_feature_narrative(feature_id, ctx))
