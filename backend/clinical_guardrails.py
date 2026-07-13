"""Post-LLM clinical and policy validation for protocol narratives."""

from __future__ import annotations

import logging
import re
from typing import Optional

from .feature_context import build_feature_context
from .narrative_schemas import FEATURE_SUBSECTION_TITLES, FeatureNarrative
from .recommendation_rules import get_deterministic_recommendation_hints, deviation_to_tier, _feature_deviation_magnitude

logger = logging.getLogger(__name__)

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


def sanitize_report_ascii(text: str) -> str:
    """Normalize fancy Unicode punctuation to Helvetica-safe ASCII for PDF storage."""
    if not isinstance(text, str) or not text:
        return text
    out = text
    for src, dst in (
        ("\u00ad", "-"),
        ("\u2010", "-"),
        ("\u2011", "-"),
        ("\u2012", "-"),
        ("\u2013", "-"),
        ("\u2014", "-"),
        ("\u2015", "-"),
        ("\u2212", "-"),
        ("\u2018", "'"),
        ("\u2019", "'"),
        ("\u201c", '"'),
        ("\u201d", '"'),
        ("\u2026", "..."),
        ("\u00a0", " "),
    ):
        out = out.replace(src, dst)
    out = re.sub(r"[^\t\n\r\x20-\x7E]", "", out)
    out = re.sub(r"[ \t]{2,}", " ", out)
    return out.strip()


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
    out = re.sub(r"the subject's's", "the subject's", out, flags=re.I)
    return sanitize_report_ascii(out)


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


def _as_str_list(value, *, max_items: int = 20) -> list[str]:
    if isinstance(value, list):
        out = [str(x).strip() for x in value if x is not None and str(x).strip()]
        return out[:max_items]
    if isinstance(value, str) and value.strip():
        return [value.strip()][:max_items]
    return []


def _clip(text: str, max_len: int) -> str:
    t = (text or "").strip()
    if len(t) <= max_len:
        return t
    return t[: max(0, max_len - 3)].rstrip() + "..."


def normalize_feature_narrative_raw(
    raw: Optional[dict],
    feature_id: str,
    ctx: Optional[dict] = None,
) -> Optional[dict]:
    """Coerce common free-model JSON shape mistakes into FeatureNarrative fields.

    Handles: ``feature``→``featureId``, string list fields, subsections as a
    title-keyed object, ``description`` used as subsection body, length caps.
    """
    if not isinstance(raw, dict) or not raw:
        return None

    data: dict = dict(raw)
    expected = FEATURE_SUBSECTION_TITLES.get(feature_id) or []

    # Unwrap {"Nose": {...}} / {"cheeks": {summary...}} single wrappers
    if "summary" not in data and "featureId" not in data and "feature" not in data:
        nested = None
        for key, val in data.items():
            if not isinstance(val, dict):
                continue
            key_l = str(key).strip().lower().replace(" ", "")
            if key_l == feature_id or key_l == feature_id.rstrip("s"):
                nested = val
                break
        if nested is None and len(data) == 1:
            only = next(iter(data.values()))
            if isinstance(only, dict):
                nested = only
        if isinstance(nested, dict):
            data = dict(nested)

    if isinstance(data.get("feature"), str) and "featureId" not in data:
        data["featureId"] = data.pop("feature")
    data["featureId"] = feature_id

    if "summary" not in data or not data.get("summary"):
        for alt in ("overview", "headline", "title"):
            if isinstance(data.get(alt), str) and data[alt].strip():
                data["summary"] = data[alt]
                break
    if "description" not in data or not data.get("description"):
        for alt in ("detail", "details", "analysis"):
            if isinstance(data.get(alt), str) and data[alt].strip():
                data["description"] = data[alt]
                break

    data["measuredFacts"] = _as_str_list(data.get("measuredFacts"), max_items=20)
    if not data["measuredFacts"] and ctx:
        data["measuredFacts"] = _as_str_list(ctx.get("measuredFacts"), max_items=20)
    if not data["measuredFacts"]:
        data["measuredFacts"] = ["Measured facial metrics available for this feature."]

    data["limitations"] = _as_str_list(data.get("limitations"), max_items=8)
    if not data["limitations"] and ctx:
        data["limitations"] = _as_str_list(ctx.get("limitations"), max_items=8)

    data["recommendations"] = _as_str_list(data.get("recommendations"), max_items=8)

    if isinstance(data.get("summary"), str):
        data["summary"] = _clip(data["summary"], 200)
    if isinstance(data.get("description"), str):
        data["description"] = _clip(data["description"], 600)

    subs = data.get("subsections")
    converted: list[dict] = []
    if isinstance(subs, dict):
        for key, val in subs.items():
            if isinstance(val, dict):
                body = (
                    val.get("body")
                    or val.get("description")
                    or val.get("text")
                    or val.get("content")
                    or ""
                )
                converted.append(
                    {
                        "title": val.get("title") or key,
                        "body": body,
                        "evidenceTier": val.get("evidenceTier")
                        or val.get("evidence_tier")
                        or "otc",
                    }
                )
            elif isinstance(val, str):
                converted.append({"title": key, "body": val, "evidenceTier": "otc"})
    elif isinstance(subs, list):
        for item in subs:
            if not isinstance(item, dict):
                continue
            body = (
                item.get("body")
                or item.get("description")
                or item.get("text")
                or item.get("content")
                or ""
            )
            converted.append(
                {
                    "title": item.get("title") or "",
                    "body": body,
                    "evidenceTier": item.get("evidenceTier")
                    or item.get("evidence_tier")
                    or "otc",
                }
            )

    for item in converted:
        body = item.get("body") if isinstance(item.get("body"), str) else ""
        item["body"] = _clip(body, 700)
        tier = item.get("evidenceTier")
        if tier not in ("lifestyle", "otc", "refer_clinician"):
            item["evidenceTier"] = "otc"

    aligned: list[dict] = []
    if expected:
        by_title = {
            str(s.get("title") or "").strip(): s
            for s in converted
            if str(s.get("title") or "").strip()
        }
        if all(t in by_title for t in expected):
            aligned = [{**by_title[t], "title": t} for t in expected]
        elif len(converted) == len(expected):
            aligned = [{**converted[i], "title": expected[i]} for i in range(len(expected))]
        else:
            # Best-effort: map known titles, then fill remaining slots by order
            used: set[int] = set()
            for t in expected:
                if t in by_title:
                    aligned.append({**by_title[t], "title": t})
                    continue
                for i, s in enumerate(converted):
                    if i in used:
                        continue
                    used.add(i)
                    aligned.append({**s, "title": t})
                    break
    else:
        aligned = converted

    data["subsections"] = aligned
    return data


def is_template_feature_narrative(data: Optional[dict]) -> bool:
    """Detect guardrail template copy (not LLM-authored)."""
    if not isinstance(data, dict):
        return False
    summary = data.get("summary") or ""
    return summary.startswith("Prioritize the subject's") and "Focus on grooming, topical care" in summary


def try_validate_feature_narrative(
    raw: Optional[dict],
    feature_id: str,
    ctx: dict,
    *,
    answers: Optional[dict] = None,
) -> tuple[Optional[dict], bool]:
    """Return (rewritten narrative, usable).

    Schema-valid LLM copy is kept even when soft clinical checks fail
    (ungrounded scores, evidence-tier ceiling, etc.). Only banned
    procedural language forces a hard reject (caller templates/retries).
    """
    if not raw:
        return None, False
    normalized = normalize_feature_narrative_raw(raw, feature_id, ctx) or raw
    try:
        parsed = FeatureNarrative.model_validate(normalized)
        ok, errs = validate_feature_narrative(parsed, ctx, answers=answers)
        rewritten = _rewrite_narrative_dict(parsed.model_dump())
        if ok:
            return rewritten, True
        hard = any("banned clinical" in (e or "").lower() for e in errs)
        if hard:
            logger.warning("feature %s hard reject: %s", feature_id, errs)
            return None, False
        logger.warning("feature %s soft clinical warnings (keeping LLM): %s", feature_id, errs)
        return rewritten, True
    except Exception as exc:
        keys = sorted(normalized.keys()) if isinstance(normalized, dict) else []
        logger.warning(
            "feature %s schema reject (keys=%s): %s",
            feature_id,
            keys,
            exc,
        )
        return None, False


def validate_or_template(
    raw: Optional[dict],
    feature_id: str,
    ctx: dict,
    *,
    answers: Optional[dict] = None,
) -> dict:
    validated, usable = try_validate_feature_narrative(raw, feature_id, ctx, answers=answers)
    if usable and validated:
        return validated
    return _rewrite_narrative_dict(template_feature_narrative(feature_id, ctx))
