"""Per-feature structured narrative generation for PDF protocol bundle."""

from __future__ import annotations

import asyncio
import logging
import sys
from typing import Any, Optional

from .clinical_guardrails import (
    is_template_feature_narrative,
    rewrite_to_subject_voice,
    sanitize_report_ascii,
    strip_score_language,
    try_validate_feature_narrative,
    validate_or_template,
)
from .config import (
    FEATURE_NARRATIVE_IDS,
    FEATURE_NARRATIVE_MAX_ATTEMPTS,
    FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC,
    FEATURE_NARRATIVE_RATE_LIMIT_RETRIES,
    PROTOCOL_FEATURE_IDS,
    LLM_MAX_OUTPUT_TOKENS,
)
from .feature_context import build_feature_context, feature_context_as_prompt_text
from .llm_client import chat_structured_completion
from .narrative_schemas import (
    FEATURE_SUBSECTION_TITLES,
    ClosingSynthesis,
    ProtocolOverview,
    closing_synthesis_json_schema,
    feature_narrative_json_schema,
    feature_subsection_length_prompt,
    protocol_overview_json_schema,
)
from .recommendation_rules import get_deterministic_recommendation_hints
from .text_ai_service import (
    NARRATIVE_VOICE_RULES,
    NO_SCORES_IN_REPORT_PROSE,
    NO_TECH_JARGON_RULES,
    STRICT_NON_SURGICAL_RULES,
    cv_report_summary_for_narrative,
)
from .vision_context import (
    build_multimodal_user_message,
    load_feature_vision_bundle,
    vision_instruction_for_feature,
)

_FEATURE_SEMAPHORE = asyncio.Semaphore(2)

logger = logging.getLogger(__name__)

_RETRY_USER_HINT = (
    "Previous output failed validation. Be more conservative and "
    "strictly grounded. Prefer the phrase non-surgical. Do not invent procedures. "
    "Use only ASCII hyphen (-) — no soft hyphens or special dashes. "
    "Return ONLY JSON keys: featureId, summary, subsections "
    "(array of {title, body}). Never include numeric CV measurements "
    "(no X/100, no score N, no decimal ratios, no cited degrees/mm). "
    "Use qualitative labels from supplied cues only."
)

_NL_STYLE_RULES = (
    "\n\n" + NARRATIVE_VOICE_RULES + "\n" + NO_TECH_JARGON_RULES + "\n" + NO_SCORES_IN_REPORT_PROSE
)

FEATURE_NARRATIVE_SYSTEM = (
    "You are MyFace's clinical aesthetic protocol writer for ONE facial feature page.\n"
    + STRICT_NON_SURGICAL_RULES
    + _NL_STYLE_RULES
    + "\n\nWrite conservative, biologically plausible non-surgical guidance grounded ONLY in supplied cues. "
    "Return ONLY: featureId, summary, and subsections (title + body). "
    "Do NOT return measuredFacts, limitations, description, recommendations, evidenceTier, or scores. "
    "Use subsection titles exactly as required by schema. "
    "Honor each subsection's length target from the user message — never X/100. "
    "Summary: 1-2 sentences naming qualitative priorities for this feature (not a generic placeholder). "
    "The phrase 'non-surgical' is allowed and preferred; do not recommend surgery or injectables.\n"
    "Example — Bad: 'The subject's skin quality shows score 72/100 with textured surface.' "
    "Good: 'The subject's skin shows moderate redness with a dry texture under photographic review.'"
)


def _build_feature_messages(
    feature_id: str,
    ctx: dict,
    hints: list[str],
    *,
    assessment_id: Optional[str] = None,
    photos_meta: Optional[dict] = None,
) -> list[dict]:
    titles = ", ".join(FEATURE_SUBSECTION_TITLES[feature_id])
    user = (
        f"Generate protocol narrative JSON for feature '{feature_id}'.\n"
        f"Required subsection titles in order: {titles}\n\n"
        f"{feature_context_as_prompt_text(ctx)}\n\n"
    )
    if hints:
        user += f"Clinical hints (follow these):\n" + "\n".join(f"- {h}" for h in hints) + "\n"
    user += (
        "\nReturn JSON with ONLY: featureId, summary, subsections[{title, body}]. "
        "Never include numeric scores.\n"
        + feature_subsection_length_prompt(feature_id)
    )

    pose_ids, image_parts = load_feature_vision_bundle(
        feature_id,
        assessment_id=assessment_id,
        photos_meta=photos_meta,
    )
    if pose_ids:
        user += "\n\n" + vision_instruction_for_feature(feature_id, pose_ids)

    return [
        {"role": "system", "content": FEATURE_NARRATIVE_SYSTEM},
        {"role": "user", "content": build_multimodal_user_message(user, image_parts)},
    ]


def _is_rate_limit_result(result: dict) -> bool:
    err = (result.get("error") or "").lower()
    return "rate_limit" in err or "429" in err


async def _chat_feature_structured(
    *,
    feature_id: str,
    messages: list[dict],
    temperature: float,
    api_key: Optional[str],
    schema_suffix: str = "",
) -> dict:
    async with _FEATURE_SEMAPHORE:
        return await asyncio.to_thread(
            chat_structured_completion,
            schema_name=f"feature_{feature_id}{schema_suffix}",
            json_schema=feature_narrative_json_schema(feature_id),
            messages=messages,
            temperature=temperature,
            max_tokens=LLM_MAX_OUTPUT_TOKENS,
            api_key_override=api_key,
        )


async def _chat_feature_with_rate_limit_backoff(
    *,
    feature_id: str,
    messages: list[dict],
    temperature: float,
    api_key: Optional[str],
    attempt: int,
) -> dict:
    """One validation-slot LLM call; on 429, up to N extra tries with exponential backoff from 30s."""
    suffix = "" if attempt == 1 else f"_retry{attempt}"
    result = await _chat_feature_structured(
        feature_id=feature_id,
        messages=messages,
        temperature=temperature,
        api_key=api_key,
        schema_suffix=suffix,
    )
    if not _is_rate_limit_result(result):
        return result

    for extra in range(1, FEATURE_NARRATIVE_RATE_LIMIT_RETRIES + 1):
        delay = FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC * (2 ** (extra - 1))
        logger.info(
            "feature %s rate limited (429); backoff %ss then extra retry %s/%s",
            feature_id,
            delay,
            extra,
            FEATURE_NARRATIVE_RATE_LIMIT_RETRIES,
        )
        await asyncio.sleep(delay)
        result = await _chat_feature_structured(
            feature_id=feature_id,
            messages=messages,
            temperature=temperature,
            api_key=api_key,
            schema_suffix=f"{suffix}_rl{extra}",
        )
        if not _is_rate_limit_result(result):
            return result

    return result


async def generate_feature_narrative_async(
    feature_id: str,
    *,
    cv_report: dict,
    eye_analysis: Optional[dict],
    answers: dict,
    api_key: Optional[str] = None,
    assessment_id: Optional[str] = None,
    photos_meta: Optional[dict] = None,
) -> dict:
    ctx = build_feature_context(
        feature_id,
        cv_report=cv_report,
        eye_analysis=eye_analysis,
        answers=answers,
    )
    hints = get_deterministic_recommendation_hints(feature_id, ctx)
    messages = _build_feature_messages(
        feature_id,
        ctx,
        hints,
        assessment_id=assessment_id,
        photos_meta=photos_meta,
    )

    max_attempts = max(1, FEATURE_NARRATIVE_MAX_ATTEMPTS)
    for attempt in range(1, max_attempts + 1):
        temperature = 0.3 if attempt == 1 else 0.2
        result = await _chat_feature_with_rate_limit_backoff(
            feature_id=feature_id,
            messages=messages,
            temperature=temperature,
            api_key=api_key,
            attempt=attempt,
        )

        if _is_rate_limit_result(result):
            logger.info(
                "feature %s structured: TEMPLATE (rate limit after %s backoff retries)",
                feature_id,
                FEATURE_NARRATIVE_RATE_LIMIT_RETRIES,
            )
            return validate_or_template(None, feature_id, ctx, answers=answers)

        raw = result.get("content")
        if result.get("error") and not raw:
            logger.info(
                "feature %s structured: LLM error / empty (attempt %s/%s)",
                feature_id,
                attempt,
                max_attempts,
            )
            if attempt >= max_attempts:
                logger.info("feature %s structured: TEMPLATE (LLM error / empty)", feature_id)
                return validate_or_template(None, feature_id, ctx, answers=answers)
            messages = messages + [{"role": "user", "content": _RETRY_USER_HINT}]
            continue

        # Keep schema-valid LLM copy (including soft clinical warnings).
        # Hard reject / retry / template only when unparseable or banned terms.
        validated, usable = try_validate_feature_narrative(raw, feature_id, ctx, answers=answers)
        if usable and validated:
            label = "LLM accepted" if attempt == 1 else f"LLM accepted (attempt {attempt})"
            logger.info("feature %s structured: %s", feature_id, label)
            return validated

        logger.info(
            "feature %s structured: hard reject (attempt %s/%s)",
            feature_id,
            attempt,
            max_attempts,
        )
        if attempt >= max_attempts:
            break
        messages = messages + [{"role": "user", "content": _RETRY_USER_HINT}]

    logger.info("feature %s structured: TEMPLATE (schema/retry fail)", feature_id)
    return validate_or_template(None, feature_id, ctx, answers=answers)


def _is_generic_summary(text: str) -> bool:
    t = (text or "").strip().lower()
    return (
        not t
        or "non-surgical guidance for" in t
        or "based on stored measurements" in t
        or t.startswith("your ") and "assessment reflects the measured values" in t
        or t.startswith("the subject's ") and "assessment reflects the measured values" in t
    )


def stitch_closing_paragraphs(
    feature_narratives: dict[str, dict],
    ai_narrative: Optional[dict] = None,
    client_name: str = "Client",
    cv_report: Optional[dict] = None,
) -> list[str]:
    """Deterministic closing when LLM synthesis is unavailable — never concatenate generic templates."""
    paragraphs: list[str] = []
    subject = client_name if client_name and client_name != "Client" else "the subject"
    if client_name and client_name != "Client":
        possessive = f"{client_name}'" if client_name.endswith("s") else f"{client_name}'s"
    else:
        possessive = "The subject's"
    content = (ai_narrative or {}).get("content") if isinstance(ai_narrative, dict) else None
    if isinstance(content, dict) and content.get("summary") and not _is_generic_summary(content["summary"]):
        paragraphs.append(content["summary"])

    overall = None
    if isinstance(cv_report, dict):
        overall = (cv_report.get("overall") or {}).get("scoreLabel")
    if overall:
        paragraphs.append(
            f"{possessive} assessment shows overall facial harmony described as {overall} "
            "from facial measurements under the lighting and pose of this session, "
            "not a medical diagnosis."
        )

    priorities: list[str] = []
    for fid in PROTOCOL_FEATURE_IDS:
        fn = feature_narratives.get(fid) or {}
        summary = fn.get("summary") or ""
        if _is_generic_summary(summary):
            # Prefer first actionable sentence from a subsection body.
            for sub in fn.get("subsections") or []:
                body = (sub.get("body") or "").strip()
                if body and "evidence-aligned non-surgical care" not in body.lower():
                    first = body.split(". ")[0].strip()
                    if first and not _is_generic_summary(first):
                        priorities.append(f"{fid}: {first}.")
                        break
            continue
        priorities.append(f"{fid}: {summary}")
    if priorities:
        paragraphs.append(
            f"Feature-specific priorities for {subject} over the next 30 days: "
            + " ".join(priorities[:5])
        )

    if isinstance(content, dict):
        strengths = content.get("strengths") or []
        focus = content.get("focusAreas") or []
        if strengths:
            paragraphs.append(
                f"Measured strengths to preserve for {subject} include "
                + "; ".join(str(s) for s in strengths[:3])
                + ". Maintain grooming, SPF, and lifestyle habits that support these areas."
            )
        if focus:
            paragraphs.append(
                f"Primary opportunities for {subject} include "
                + "; ".join(str(s) for s in focus[:3])
                + ". Address these with conservative topical care, sleep, hydration, and posture/grooming before considering any in-office consultation."
            )
        for item in content.get("recommendations") or []:
            if isinstance(item, str) and item.strip() and not _is_generic_summary(item):
                paragraphs.append(item.strip())

    if len(paragraphs) < 3:
        paragraphs.append(
            f"A practical 30-day plan for {subject} is: daily broad-spectrum SPF 50 outdoors; "
            "gentle cleansing morning and night; adequate sleep and hydration; and feature-specific "
            "grooming noted on each protocol page. Avoid aggressive actives until tolerance is clear."
        )
        paragraphs.append(
            "Repeat analysis under consistent lighting, a neutral expression, and the same camera distance "
            "to compare progress. Discuss persistent or progressive concerns with a qualified clinician; "
            "this report does not replace clinical examination."
        )

    paragraphs.append(
        "This protocol is educational guidance from the subject's facial measurements, not medical diagnosis or treatment."
    )
    # Deduplicate while preserving order
    seen: set[str] = set()
    out: list[str] = []
    for p in paragraphs:
        key = p.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return [
        sanitize_report_ascii(rewrite_to_subject_voice(strip_score_language(p)))
        for p in out[:6]
    ]


def _feature_narratives_digest(feature_narratives: dict[str, dict]) -> str:
    """Compact digest of all feature narratives for closing synthesis."""
    import json

    parts: list[str] = []
    for fid in PROTOCOL_FEATURE_IDS:
        fn = feature_narratives.get(fid) or {}
        if not fn:
            continue
        block = {
            "featureId": fid,
            "summary": fn.get("summary"),
            "subsections": [
                {"title": s.get("title"), "body": (s.get("body") or "")[:400], "evidenceTier": s.get("evidenceTier")}
                for s in (fn.get("subsections") or [])
            ],
        }
        parts.append(json.dumps(block, default=str))
    return "\n".join(parts)[:12000]


CLOSING_SYNTHESIS_SYSTEM = (
    "You are MyFace's protocol closing writer. Synthesize a cohesive closing section for a facial analysis PDF.\n"
    + STRICT_NON_SURGICAL_RULES
    + _NL_STYLE_RULES
    + "\n\nWrite 3-5 dense paragraphs (100-160 words each) that:\n"
    "- Tie together priorities across ALL feature sections supplied with concrete measured cues\n"
    "- Reference the subject's stated goals when provided\n"
    "- Use magnitude/qualitative language only — NEVER numeric scores (no X/100)\n"
    "- Close with realistic non-surgical next steps in priority order (SPF, sleep, grooming, topical care)\n"
    "- Do NOT invent measurements or procedures\n"
    "- Do NOT paste generic lines like 'Non-surgical guidance for X based on stored measurements'\n"
    "- The phrase 'non-surgical' is allowed and preferred\n"
    "- Use only plain ASCII punctuation (hyphen -, apostrophe '). "
    "Never use soft hyphens, en/em dashes, or curly quotes."
)


async def generate_closing_synthesis_async(
    feature_narratives: dict[str, dict],
    *,
    cv_report: Optional[dict] = None,
    ai_narrative: Optional[dict] = None,
    answers: Optional[dict] = None,
    client_name: str = "Client",
    api_key: Optional[str] = None,
) -> list[str]:
    """LLM-synthesized closing paragraphs with deterministic fallback.

    Always returns a non-empty list suitable for persistence (LLM or measured stitch).
    """
    from .answer_summary import format_answers_summary
    from .clinical_guardrails import rewrite_to_subject_voice, sanitize_report_ascii, strip_score_language

    profile = format_answers_summary(answers or {})
    digest = _feature_narratives_digest(feature_narratives)
    cv_summary = cv_report_summary_for_narrative(cv_report or {}, None)
    exec_content = (ai_narrative or {}).get("content") if isinstance(ai_narrative, dict) else None

    user = (
        f"Reader name: {client_name}\n"
        f"Goals: {profile.get('goals')}\n"
        f"Measurement summary (qualitative):\n{cv_summary}\n\n"
        f"Feature narratives:\n{digest}\n\n"
    )
    if isinstance(exec_content, dict) and exec_content.get("summary"):
        user += f"Executive summary: {exec_content['summary']}\n"

    messages = [
        {"role": "system", "content": CLOSING_SYNTHESIS_SYSTEM},
        {"role": "user", "content": user + "\nReturn JSON with paragraphs array (3-5 items). Never include numeric scores."},
    ]

    try:
        result = await asyncio.to_thread(
            chat_structured_completion,
            schema_name="closing_synthesis",
            json_schema=closing_synthesis_json_schema(),
            messages=messages,
            temperature=0.35,
            max_tokens=LLM_MAX_OUTPUT_TOKENS,
            api_key_override=api_key,
        )
        if result.get("content"):
            parsed = ClosingSynthesis.model_validate(result["content"])
            paragraphs = [p for p in parsed.paragraphs if p.strip() and not _is_generic_summary(p)]
            if len(paragraphs) >= 3:
                paragraphs.append(
                    "This protocol is educational guidance from the subject's facial measurements, "
                    "not medical diagnosis or treatment."
                )
                return [
                    sanitize_report_ascii(rewrite_to_subject_voice(strip_score_language(p)))
                    for p in paragraphs[:6]
                ]
    except Exception:
        pass

    return stitch_closing_paragraphs(feature_narratives, ai_narrative, client_name, cv_report=cv_report)


def build_protocol_narrative_compat(
    *,
    feature_narratives: dict[str, dict],
    overview_summary: str,
    closing: Optional[list[str]] = None,
    source: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    features_compat = {}
    for fid, fn in feature_narratives.items():
        features_compat[fid] = {
            "summary": fn.get("summary"),
            "subsections": fn.get("subsections"),
            "description": fn.get("description"),
            "measuredFacts": fn.get("measuredFacts"),
            "limitations": fn.get("limitations"),
            "recommendations": fn.get("recommendations"),
        }
    out: dict[str, Any] = {
        "summary": overview_summary,
        "closing": closing or [],
        "features": features_compat,
    }
    if source:
        out["source"] = source
    if model:
        out["model"] = model
    return out


async def generate_protocol_overview_async(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    api_key: Optional[str] = None,
) -> dict:
    from .answer_summary import format_answers_summary

    profile = format_answers_summary(answers or {})
    cv_summary = cv_report_summary_for_narrative(cv_report, metrics)
    messages = [
        {
            "role": "system",
            "content": (
                "Write a 2-3 sentence protocol overview for a non-surgical facial aesthetic PDF.\n"
                + STRICT_NON_SURGICAL_RULES
                + _NL_STYLE_RULES
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goals: {profile.get('goals')}\n"
                f"Measurement summary (qualitative):\n{cv_summary}\n\n"
                "Return JSON with summary only. Never cite numeric scores; no procedural treatments."
            ),
        },
    ]
    result = await asyncio.to_thread(
        chat_structured_completion,
        schema_name="protocol_overview",
        json_schema=protocol_overview_json_schema(),
        messages=messages,
        temperature=0.35,
        max_tokens=LLM_MAX_OUTPUT_TOKENS,
        api_key_override=api_key,
    )
    if result.get("content"):
        try:
            from .clinical_guardrails import strip_score_language

            data = ProtocolOverview.model_validate(result["content"]).model_dump()
            data["summary"] = strip_score_language(data["summary"])
            return data
        except Exception:
            pass
    overall = (cv_report or {}).get("overall") or {}
    label = overall.get("scoreLabel") or "balanced"
    return {
        "summary": (
            f"This evidence-based non-surgical protocol is grounded in the subject's measured facial analysis "
            f"(overall harmony described as {label}), organised around key aesthetic features."
        )
    }


async def generate_all_protocol_text(
    assessment: dict,
    *,
    api_key: Optional[str] = None,
    skip_existing: bool = True,
) -> dict:
    """Generate featureNarratives and protocolNarrative compat bundle (latest-only)."""
    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    eye_analysis = analysis.get("eyeAnalysis")
    answers = assessment.get("answers") or {}
    metrics = analysis.get("metrics")

    existing_features = assessment.get("featureNarratives") or {}
    if isinstance(existing_features, dict) and skip_existing:
        to_generate = [f for f in FEATURE_NARRATIVE_IDS if f not in existing_features]
    else:
        to_generate = list(FEATURE_NARRATIVE_IDS)
        existing_features = {}

    assessment_id = assessment.get("id")
    photos_meta = assessment.get("photos") or {}

    async def _one(fid: str) -> tuple[str, dict]:
        narrative = await generate_feature_narrative_async(
            fid,
            cv_report=cv_report,
            eye_analysis=eye_analysis,
            answers=answers,
            api_key=api_key,
            assessment_id=assessment_id,
            photos_meta=photos_meta,
        )
        return fid, narrative

    if to_generate:
        results = await asyncio.gather(*[_one(fid) for fid in to_generate])
        for fid, narrative in results:
            existing_features[fid] = narrative

    overview = await generate_protocol_overview_async(
        answers=answers, cv_report=cv_report, metrics=metrics, api_key=api_key
    )

    client_name = answers.get("name") or answers.get("fullName") or "Client"
    closing = await generate_closing_synthesis_async(
        existing_features,
        cv_report=cv_report,
        ai_narrative=assessment.get("aiNarrative"),
        answers=answers,
        client_name=client_name,
        api_key=api_key,
    )
    if not closing:
        closing = stitch_closing_paragraphs(
            existing_features,
            assessment.get("aiNarrative"),
            client_name,
            cv_report=cv_report,
        )
        closing_source = "stitch"
    else:
        closing_source = "llm"

    protocol_narrative = build_protocol_narrative_compat(
        feature_narratives={
            fid: existing_features[fid]
            for fid in PROTOCOL_FEATURE_IDS
            if fid in existing_features
        },
        overview_summary=overview.get("summary", ""),
        closing=closing,
        source="orchestrator",
        model=None,
    )

    llm_features = [
        fid
        for fid in FEATURE_NARRATIVE_IDS
        if fid in existing_features and not is_template_feature_narrative(existing_features.get(fid))
    ]
    template_features = [
        fid
        for fid in FEATURE_NARRATIVE_IDS
        if fid in existing_features and is_template_feature_narrative(existing_features.get(fid))
    ]
    scoreboard = [
        "",
        "┌─ Narrative enrichment ─────────────────────────────────",
        f"│  features LLM      : {', '.join(llm_features) or '(none)'}",
        f"│  features TEMPLATE : {', '.join(template_features) or '(none)'}",
        f"│  llm / total       : {len(llm_features)}/{len(FEATURE_NARRATIVE_IDS)}",
        f"│  closing           : {closing_source}",
        "└────────────────────────────────────────────────────────",
    ]
    print("\n".join(scoreboard), file=sys.stderr, flush=True)
    logger.info(
        "narrative enrichment llm=%s/%s template=%s closing=%s",
        len(llm_features),
        len(FEATURE_NARRATIVE_IDS),
        template_features,
        closing_source,
    )

    return {
        "featureNarratives": existing_features,
        "protocolNarrative": protocol_narrative,
    }
