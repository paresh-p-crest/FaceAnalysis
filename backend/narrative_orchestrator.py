"""Per-feature structured narrative generation for PDF protocol bundle."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from .clinical_guardrails import rewrite_to_subject_voice, validate_or_template
from .config import PROTOCOL_FEATURE_IDS
from .feature_context import build_feature_context, feature_context_as_prompt_text
from .llm_client import chat_structured_completion
from .narrative_schemas import (
    FEATURE_SUBSECTION_TITLES,
    ClosingSynthesis,
    FeatureNarrative,
    ProtocolActionCards,
    ProtocolOverview,
    closing_synthesis_json_schema,
    feature_narrative_json_schema,
    protocol_action_cards_json_schema,
    protocol_overview_json_schema,
)
from .recommendation_rules import get_deterministic_recommendation_hints
from .text_ai_service import (
    NARRATIVE_VOICE_RULES,
    NO_TECH_JARGON_RULES,
    STRICT_NON_SURGICAL_RULES,
    cv_report_summary,
    template_protocol,
)
from .vision_context import (
    build_multimodal_user_message,
    load_feature_vision_bundle,
    vision_instruction_for_feature,
)

_FEATURE_SEMAPHORE = asyncio.Semaphore(4)

_NL_STYLE_RULES = "\n\n" + NARRATIVE_VOICE_RULES + "\n" + NO_TECH_JARGON_RULES

FEATURE_NARRATIVE_SYSTEM = (
    "You are MyFace's clinical aesthetic protocol writer for ONE facial feature page.\n"
    + STRICT_NON_SURGICAL_RULES
    + _NL_STYLE_RULES
    + "\n\nWrite conservative, biologically plausible non-surgical guidance grounded ONLY in supplied measurements. "
    "Acknowledge limitations. Use subsection titles exactly as required by schema. "
    "Each subsection body: 100-140 words with concrete measured facts woven into the prose. "
    "Summary: 1-2 sentences naming the measured priorities for this feature (not a generic placeholder). "
    "Description: 2-4 sentences explaining what was measured and what was not. "
    "Assign evidenceTier per subsection: lifestyle (routine/topical/skincare-only), "
    "otc (non-invasive OTC/at-home), refer_clinician (in-office consultation referral only). "
    "Escalate tier only when supplied deviationFacts warrant it. "
    "End each subsection body with one clear recommendation sentence matching its evidenceTier. "
    "The phrase 'non-surgical' is allowed and preferred; do not recommend surgery or injectables."
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
        "\nmeasuredFacts must copy or paraphrase ONLY the supplied measured facts. "
        "limitations must restate supplied limitations, not invent new measurements."
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

    async with _FEATURE_SEMAPHORE:
        result = await asyncio.to_thread(
            chat_structured_completion,
            schema_name=f"feature_{feature_id}",
            json_schema=feature_narrative_json_schema(feature_id),
            messages=messages,
            temperature=0.3,
            max_tokens=1400,
            api_key_override=api_key,
        )

    raw = result.get("content")
    if result.get("error") and not raw:
        return validate_or_template(None, feature_id, ctx, answers=answers)

    validated = validate_or_template(raw, feature_id, ctx, answers=answers)
    if raw and validated != raw:
        try:
            retry_messages = _build_feature_messages(
                feature_id,
                ctx,
                hints,
                assessment_id=assessment_id,
                photos_meta=photos_meta,
            ) + [
                {
                    "role": "user",
                    "content": (
                        "Previous output failed clinical validation. Be more conservative and "
                        "strictly grounded. Prefer the phrase non-surgical. Do not invent procedures."
                    ),
                }
            ]
            retry = await asyncio.to_thread(
                chat_structured_completion,
                schema_name=f"feature_{feature_id}_retry",
                json_schema=feature_narrative_json_schema(feature_id),
                messages=retry_messages,
                temperature=0.2,
                max_tokens=1400,
                api_key_override=api_key,
            )
            if retry.get("content"):
                validated = validate_or_template(retry["content"], feature_id, ctx, answers=answers)
        except Exception:
            pass

    if isinstance(validated, dict):
        validated = dict(validated)
    return validated


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
        overall = (cv_report.get("overall") or {}).get("score")
    if overall is not None:
        paragraphs.append(
            f"{possessive} assessment shows an overall harmony score of {overall}/100 "
            "from facial measurements. Treat the score as a relative "
            "baseline under the lighting and pose of this session, not a medical diagnosis."
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
    return [rewrite_to_subject_voice(p) for p in out[:6]]


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
    "- Use magnitude language only from supplied summaries and facts\n"
    "- Close with realistic non-surgical next steps in priority order (SPF, sleep, grooming, topical care)\n"
    "- Do NOT invent measurements or procedures\n"
    "- Do NOT paste generic lines like 'Non-surgical guidance for X based on stored measurements'\n"
    "- The phrase 'non-surgical' is allowed and preferred"
)


async def generate_closing_synthesis_async(
    feature_narratives: dict[str, dict],
    *,
    protocol_data: Optional[dict] = None,
    cv_report: Optional[dict] = None,
    ai_narrative: Optional[dict] = None,
    answers: Optional[dict] = None,
    client_name: str = "Client",
    api_key: Optional[str] = None,
) -> list[str]:
    """LLM-synthesized closing paragraphs with deterministic fallback."""
    from .answer_summary import format_answers_summary

    profile = format_answers_summary(answers or {})
    digest = _feature_narratives_digest(feature_narratives)
    cv_summary = cv_report_summary(cv_report or {}, None)
    action_cards = (protocol_data or {}).get("recommendations") or []
    exec_content = (ai_narrative or {}).get("content") if isinstance(ai_narrative, dict) else None

    user = (
        f"Reader name: {client_name}\n"
        f"Goals: {profile.get('goals')}\n"
        f"Measurement summary:\n{cv_summary}\n\n"
        f"Feature narratives:\n{digest}\n\n"
    )
    if action_cards:
        user += f"Action cards: {action_cards[:6]}\n"
    if isinstance(exec_content, dict) and exec_content.get("summary"):
        user += f"Executive summary: {exec_content['summary']}\n"

    messages = [
        {"role": "system", "content": CLOSING_SYNTHESIS_SYSTEM},
        {"role": "user", "content": user + "\nReturn JSON with paragraphs array (3-5 items)."},
    ]

    try:
        result = await asyncio.to_thread(
            chat_structured_completion,
            schema_name="closing_synthesis",
            json_schema=closing_synthesis_json_schema(),
            messages=messages,
            temperature=0.35,
            max_tokens=1200,
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
                return [rewrite_to_subject_voice(p) for p in paragraphs[:6]]
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
    cv_summary = cv_report_summary(cv_report, metrics)
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
                f"Measurement summary:\n{cv_summary}\n\n"
                "Return JSON with summary only. Ground in scores; no procedural treatments."
            ),
        },
    ]
    result = await asyncio.to_thread(
        chat_structured_completion,
        schema_name="protocol_overview",
        json_schema=protocol_overview_json_schema(),
        messages=messages,
        temperature=0.35,
        max_tokens=200,
        api_key_override=api_key,
    )
    if result.get("content"):
        try:
            return ProtocolOverview.model_validate(result["content"]).model_dump()
        except Exception:
            pass
    overall = (cv_report or {}).get("overall") or {}
    score = overall.get("score", "N/A")
    return {
        "summary": (
            f"This evidence-based non-surgical protocol is grounded in the subject's measured facial analysis "
            f"(overall harmony {score}/100), organised around key aesthetic features."
        )
    }


async def generate_protocol_action_cards_async(
    *,
    answers: dict,
    cv_report: dict,
    metrics: Optional[dict],
    api_key: Optional[str] = None,
) -> dict:
    from .answer_summary import format_answers_summary

    profile = format_answers_summary(answers or {})
    cv_summary = cv_report_summary(cv_report, metrics)
    messages = [
        {
            "role": "system",
            "content": (
                "Generate non-surgical protocol action cards as JSON.\n"
                + STRICT_NON_SURGICAL_RULES
                + _NL_STYLE_RULES
            ),
        },
        {
            "role": "user",
            "content": (
                f"Goals: {profile.get('goals')}\n"
                f"Skin: {profile.get('skinType')}, concerns: {profile.get('concerns')}\n"
                f"Measurement summary:\n{cv_summary}\n"
                "Prioritize lowest scores. 5-8 recommendations."
            ),
        },
    ]
    result = await asyncio.to_thread(
        chat_structured_completion,
        schema_name="protocol_action_cards",
        json_schema=protocol_action_cards_json_schema(),
        messages=messages,
        temperature=0.4,
        max_tokens=900,
        api_key_override=api_key,
    )
    if result.get("content"):
        try:
            return {
                **ProtocolActionCards.model_validate(result["content"]).model_dump(),
                "source": result.get("source"),
                "model": result.get("model"),
            }
        except Exception:
            pass
    tpl = template_protocol(cv_report)
    return {**tpl, "source": "template", "model": None}


async def generate_all_protocol_text(
    assessment: dict,
    *,
    api_key: Optional[str] = None,
    skip_existing: bool = True,
) -> dict:
    """Generate featureNarratives, protocolData, and protocolNarrative compat bundle."""
    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    eye_analysis = analysis.get("eyeAnalysis")
    answers = assessment.get("answers") or {}
    metrics = analysis.get("metrics")

    existing_features = assessment.get("featureNarratives") or {}
    if isinstance(existing_features, dict) and skip_existing:
        to_generate = [f for f in PROTOCOL_FEATURE_IDS if f not in existing_features]
    else:
        to_generate = list(PROTOCOL_FEATURE_IDS)
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

    overview_task = generate_protocol_overview_async(
        answers=answers, cv_report=cv_report, metrics=metrics, api_key=api_key
    )
    cards_task = generate_protocol_action_cards_async(
        answers=answers, cv_report=cv_report, metrics=metrics, api_key=api_key
    )
    overview, cards = await asyncio.gather(overview_task, cards_task)

    client_name = answers.get("name") or answers.get("fullName") or "Client"
    protocol_data_preview = {
        "summary": cards.get("summary") or overview.get("summary"),
        "recommendations": cards.get("recommendations") or [],
    }
    closing = await generate_closing_synthesis_async(
        existing_features,
        protocol_data=protocol_data_preview,
        cv_report=cv_report,
        ai_narrative=assessment.get("aiNarrative"),
        answers=answers,
        client_name=client_name,
        api_key=api_key,
    )

    protocol_narrative = build_protocol_narrative_compat(
        feature_narratives=existing_features,
        overview_summary=overview.get("summary", ""),
        closing=closing,
        source=cards.get("source") or "orchestrator",
        model=cards.get("model"),
    )

    protocol_data = {
        "summary": cards.get("summary") or overview.get("summary"),
        "recommendations": cards.get("recommendations") or [],
        "source": cards.get("source"),
        "model": cards.get("model"),
    }

    return {
        "featureNarratives": existing_features,
        "protocolData": protocol_data,
        "protocolNarrative": protocol_narrative,
    }
