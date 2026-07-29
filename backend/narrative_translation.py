"""Post-hoc German translation for stored English narratives.

DE translation uses plain text per field (chat_text_completion). Structure is
reassembled in Python — no structured JSON translation for narratives.
"""

from __future__ import annotations

import asyncio
import copy
import logging
import os
import re
from typing import Any, Optional

from .clinical_guardrails import sanitize_report_ascii
from .clinical_guardrails_de import template_feature_narrative_de
from .config import FEATURE_NARRATIVE_IDS, LLM_MAX_OUTPUT_TOKENS
from .feature_context import build_feature_context
from .llm_client import chat_text_completion
from .narrative_orchestrator import _clamp_treatment_phases_raw, stitch_closing_paragraphs
from .narrative_provenance import resolve_feature_origin, should_llm_translate_en, stamp_origin

logger = logging.getLogger(__name__)

NARRATIVE_TRANSLATION_SYSTEM_PROMPT = (
    "Translate to German. Write per Du-form. Make sure it doesn't sound "
    "AI-generated. Do not use long hyphens, en dashes, or em dashes. "
    "Preserve medical/technical terms. Output only the translation, no preamble."
)

NARRATIVE_TRANSLATION_CONCURRENCY = max(
    1, int(os.environ.get("NARRATIVE_TRANSLATION_CONCURRENCY", "11") or "11")
)

_OVERVIEW_FALLBACK_DE = (
    "Dieses evidenzbasierte, nicht-invasive Protokoll basiert auf deinen gemessenen Gesichtsdaten."
)


def _sanitize_translation_text(text: str) -> str:
    if not text:
        return text
    cleaned = sanitize_report_ascii(text)
    if cleaned != text:
        logger.debug("DE translation sanitized dashes/ascii")
    return cleaned


async def translate_text_en_to_de(text_en: str, *, label: str = "narrative_translate_text") -> str:
    if not (text_en or "").strip():
        return ""
    result = await asyncio.to_thread(
        chat_text_completion,
        messages=[
            {"role": "system", "content": NARRATIVE_TRANSLATION_SYSTEM_PROMPT},
            {"role": "user", "content": text_en},
        ],
        temperature=0.3,
        max_tokens=LLM_MAX_OUTPUT_TOKENS,
        label=label,
    )
    if result.get("error") or not result.get("content"):
        raise RuntimeError(result.get("error") or "Empty translation")
    return _sanitize_translation_text(str(result["content"]).strip())


async def _translate_strings_parallel(
    texts: list[str],
    *,
    label_prefix: str,
    sem: Optional[asyncio.Semaphore] = None,
) -> list[str]:
    """Translate non-empty strings in parallel; empty inputs stay empty."""

    async def _one(i: int, text: str) -> tuple[int, str]:
        if not (text or "").strip():
            return i, ""
        if sem is None:
            out = await translate_text_en_to_de(text, label=f"{label_prefix}_{i}")
        else:
            async with sem:
                out = await translate_text_en_to_de(text, label=f"{label_prefix}_{i}")
        return i, out

    results = await asyncio.gather(
        *[_one(i, t) for i, t in enumerate(texts)],
        return_exceptions=True,
    )
    out: list[str] = [""] * len(texts)
    for i, item in enumerate(results):
        if isinstance(item, Exception):
            raise item
        idx, translated = item
        out[idx] = translated
    return out


def stitch_closing_paragraphs_de(
    feature_narratives: dict[str, dict],
    ai_narrative: Optional[dict] = None,
    client_name: str = "Client",
    cv_report: Optional[dict] = None,
) -> list[str]:
    """German deterministic closing (mirror EN stitch; hardcoded DE strings)."""
    en = stitch_closing_paragraphs(
        feature_narratives, ai_narrative, client_name, cv_report=cv_report
    )
    # ponytail: translate stitch boilerplate via fixed DE replacements for v1
    replacements = (
        ("the subject", "du"),
        ("The subject", "Du"),
        ("your ", "deine "),
        ("Your ", "Deine "),
        ("This protocol is educational guidance", "Dieses Protokoll ist Bildungsinhalt"),
        ("not medical diagnosis or treatment", "keine medizinische Diagnose oder Behandlung"),
        ("broad-spectrum SPF 50", "breitbandigen SPF 50"),
        ("Feature-specific priorities", "Merkmalsspezifische Prioritäten"),
        ("Measured strengths to preserve", "Gemessene Stärken, die du bewahren solltest"),
        ("Primary opportunities", "Wichtigste Chancen"),
        ("overall facial harmony described as", "gesamte Gesichtsharmonie beschrieben als"),
        ("from facial measurements", "aus den Gesichtsmessungen"),
        ("not a medical diagnosis", "keine medizinische Diagnose"),
    )
    out: list[str] = []
    for para in en:
        de = para
        for a, b in replacements:
            de = de.replace(a, b)
        out.append(_sanitize_translation_text(de))
    return out


async def _translate_list_fields(values: list, *, label_prefix: str) -> list:
    """Translate string list items; keep non-strings as-is."""
    texts = [v if isinstance(v, str) else "" for v in values]
    translated = await _translate_strings_parallel(texts, label_prefix=label_prefix)
    out = []
    for orig, de in zip(values, translated):
        if isinstance(orig, str):
            out.append(de)
        else:
            out.append(orig)
    return out


async def _translate_executive_content(content: dict) -> dict:
    """Plain-text per field for executive narrative content."""
    out: dict[str, Any] = {}
    if content.get("summary"):
        out["summary"] = await translate_text_en_to_de(
            content["summary"], label="executive_summary_de"
        )
    for list_key in ("strengths", "focusAreas", "recommendations"):
        vals = content.get(list_key)
        if isinstance(vals, list) and vals:
            out[list_key] = await _translate_list_fields(vals, label_prefix=f"executive_{list_key}_de")
        elif vals is not None:
            out[list_key] = vals
    if content.get("disclaimer"):
        out["disclaimer"] = await translate_text_en_to_de(
            content["disclaimer"], label="executive_disclaimer_de"
        )
    return stamp_origin(out, "llm")


async def _translate_feature_narrative_llm(narrative: dict, feature_id: str) -> dict:
    """Translate summary + each subsection body as plain text; keep EN titles."""
    summary_en = narrative.get("summary") or ""
    subs_en = [
        s for s in (narrative.get("subsections") or []) if isinstance(s, dict)
    ]

    async def _summary() -> str:
        if not summary_en.strip():
            return ""
        return await translate_text_en_to_de(summary_en, label=f"feature_{feature_id}_summary_de")

    bodies = [s.get("body") or "" for s in subs_en]
    summary_task = _summary()
    bodies_task = _translate_strings_parallel(
        bodies, label_prefix=f"feature_{feature_id}_body_de"
    )
    summary_de, bodies_de = await asyncio.gather(summary_task, bodies_task)

    subsections = [
        {"title": s.get("title"), "body": bodies_de[i]}
        for i, s in enumerate(subs_en)
    ]
    return stamp_origin({"summary": summary_de, "subsections": subsections}, "llm")


async def _translate_closing_paragraphs(closing: list) -> list[str]:
    texts = [p if isinstance(p, str) else "" for p in closing]
    return await _translate_strings_parallel(texts, label_prefix="closing_para_de")


_PHASE_FIELD_TAG_RE = re.compile(r"<<([a-zA-Z0-9_.]+)>>")

_PHASE_PACK_SYSTEM = (
    NARRATIVE_TRANSLATION_SYSTEM_PROMPT
    + " When the user message contains <<tag>> markers, keep every marker line "
    "unchanged and in the same order. Translate only the text between markers."
)


def _pack_phase_fields(phase: dict) -> tuple[str, list[str]]:
    """Build labeled plain-text block for one phase (title/duration/items)."""
    tags: list[str] = []
    chunks: list[str] = []

    def _add(tag: str, text: Any) -> None:
        if isinstance(text, str) and text.strip():
            tags.append(tag)
            chunks.append(f"<<{tag}>>\n{text.strip()}")

    _add("title", phase.get("title"))
    _add("duration", phase.get("duration"))
    for i, item in enumerate(phase.get("items") or []):
        if not isinstance(item, dict):
            continue
        _add(f"item.{i}.name", item.get("name"))
        _add(f"item.{i}.detail", item.get("detail"))
    return "\n\n".join(chunks), tags


def _unpack_phase_fields(translated: str, expected_tags: list[str]) -> dict[str, str]:
    """Parse <<tag>> values from a packed translation response."""
    matches = list(_PHASE_FIELD_TAG_RE.finditer(translated or ""))
    found: dict[str, str] = {}
    for i, match in enumerate(matches):
        tag = match.group(1)
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(translated)
        found[tag] = (translated[start:end] or "").strip()
    missing = [t for t in expected_tags if not (found.get(t) or "").strip()]
    if missing:
        raise RuntimeError(f"treatment phase pack missing tags: {missing}")
    return {t: found[t] for t in expected_tags}


def _apply_phase_field_map(phase: dict, field_map: dict[str, str]) -> dict:
    out = copy.deepcopy(phase)
    if "title" in field_map:
        out["title"] = field_map["title"]
    if "duration" in field_map:
        out["duration"] = field_map["duration"]
    items = list(out.get("items") or [])
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        item = dict(item)
        name_key = f"item.{i}.name"
        detail_key = f"item.{i}.detail"
        if name_key in field_map:
            item["name"] = field_map[name_key]
        if detail_key in field_map:
            item["detail"] = field_map[detail_key]
        items[i] = item
    out["items"] = items
    return out


async def _translate_phase_packed(phase: dict, *, label: str) -> dict:
    packed, tags = _pack_phase_fields(phase)
    if not tags:
        return copy.deepcopy(phase)
    result = await asyncio.to_thread(
        chat_text_completion,
        messages=[
            {"role": "system", "content": _PHASE_PACK_SYSTEM},
            {"role": "user", "content": packed},
        ],
        temperature=0.3,
        max_tokens=LLM_MAX_OUTPUT_TOKENS,
        label=label,
    )
    if result.get("error") or not result.get("content"):
        raise RuntimeError(result.get("error") or "Empty translation")
    raw = _sanitize_translation_text(str(result["content"]).strip())
    field_map = _unpack_phase_fields(raw, tags)
    return _apply_phase_field_map(phase, field_map)


async def _translate_treatment_phases_plain(phases: dict) -> dict:
    """Translate treatment phases: 1 call for summary + 1 packed call per phase."""
    slim = copy.deepcopy(phases)
    slim.pop("origin", None)

    async def _summary() -> Optional[str]:
        text = slim.get("summary")
        if not (isinstance(text, str) and text.strip()):
            return None
        return await translate_text_en_to_de(text, label="treatment_phases_de_summary")

    phase_keys = [k for k in ("phase01", "phase02", "phase03") if isinstance(slim.get(k), dict)]

    async def _one_phase(key: str) -> tuple[str, dict]:
        return key, await _translate_phase_packed(slim[key], label=f"treatment_phases_de_{key}")

    summary_task = _summary()
    phase_tasks = [_one_phase(k) for k in phase_keys]
    gathered = await asyncio.gather(summary_task, *phase_tasks, return_exceptions=True)

    summary_de = gathered[0]
    if isinstance(summary_de, Exception):
        raise summary_de

    out = copy.deepcopy(slim)
    if summary_de is not None:
        out["summary"] = summary_de
    for item in gathered[1:]:
        if isinstance(item, Exception):
            raise item
        key, phase_de = item
        out[key] = phase_de

    out["origin"] = "llm"
    return _clamp_treatment_phases_raw(out)


def count_treatment_phase_de_calls(phases: Optional[dict]) -> int:
    """How many chat_text calls _translate_treatment_phases_plain will make."""
    if not isinstance(phases, dict):
        return 0
    n = 1 if isinstance(phases.get("summary"), str) and phases["summary"].strip() else 0
    for key in ("phase01", "phase02", "phase03"):
        phase = phases.get(key)
        if not isinstance(phase, dict):
            continue
        _packed, tags = _pack_phase_fields(phase)
        if tags:
            n += 1
    return n


async def resolve_de_for_feature(
    feature_id: str,
    en_narrative: dict,
    *,
    cv_report: dict,
    eye_analysis: Optional[dict],
    answers: dict,
) -> dict:
    ctx = build_feature_context(
        feature_id, cv_report=cv_report, eye_analysis=eye_analysis, answers=answers
    )
    origin = resolve_feature_origin(en_narrative)
    if should_llm_translate_en(origin):
        try:
            return await _translate_feature_narrative_llm(en_narrative, feature_id)
        except Exception:
            logger.exception("DE LLM failed for feature %s; using hardcoded DE template", feature_id)
    return template_feature_narrative_de(feature_id, ctx)


async def translate_protocol_section_de(
    assessment: dict,
    section_id: str,
) -> dict:
    """Translate one section's EN → DE after regen."""
    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    answers = assessment.get("answers") or {}
    eye_analysis = analysis.get("eyeAnalysis")
    features = dict(assessment.get("featureNarratives") or {})
    pn = dict(assessment.get("protocolNarrative") or {})
    ai_narrative = assessment.get("aiNarrative")

    if section_id == "overview":
        de_block = dict(pn.get("de") or {})
        origin = pn.get("summaryOrigin")
        if should_llm_translate_en(origin) and pn.get("summary"):
            try:
                de_block["summary"] = await translate_text_en_to_de(
                    pn["summary"], label="overview_summary_de"
                )
                de_block["summaryOrigin"] = "llm"
            except Exception:
                logger.exception("DE overview translation failed")
                de_block["summary"] = _OVERVIEW_FALLBACK_DE
                de_block["summaryOrigin"] = "template"
        else:
            de_block["summary"] = _OVERVIEW_FALLBACK_DE
            de_block["summaryOrigin"] = "template"
        pn["de"] = de_block
    elif section_id == "closing":
        de_block = dict(pn.get("de") or {})
        closing_origin = pn.get("closingOrigin")
        closing = pn.get("closing") or []
        if closing_origin == "stitch":
            client_name = answers.get("name") or answers.get("fullName") or "Client"
            de_block["closing"] = stitch_closing_paragraphs_de(
                features, ai_narrative, client_name, cv_report=cv_report
            )
            de_block["closingOrigin"] = "template"
        elif should_llm_translate_en(closing_origin) and closing:
            try:
                de_block["closing"] = await _translate_closing_paragraphs(closing)
                de_block["closingOrigin"] = "llm"
            except Exception:
                logger.exception("DE closing LLM failed; using stitch DE")
                client_name = answers.get("name") or answers.get("fullName") or "Client"
                de_block["closing"] = stitch_closing_paragraphs_de(
                    features, ai_narrative, client_name, cv_report=cv_report
                )
                de_block["closingOrigin"] = "template"
        pn["de"] = de_block
    elif section_id in FEATURE_NARRATIVE_IDS:
        en_feat = features.get(section_id) or {}
        features[section_id] = en_feat
        de_feat = await resolve_de_for_feature(
            section_id,
            en_feat,
            cv_report=cv_report,
            eye_analysis=eye_analysis,
            answers=answers,
        )
        en_feat["de"] = de_feat

    assessment["protocolNarrative"] = pn
    assessment["featureNarratives"] = features
    return assessment


async def ensure_ai_narrative_de(ai_narrative: Optional[dict]) -> Optional[dict]:
    if not isinstance(ai_narrative, dict):
        return ai_narrative
    content = ai_narrative.get("content")
    if not isinstance(content, dict) or not content.get("summary"):
        return ai_narrative
    origin = ai_narrative.get("contentOrigin") or "llm"
    if not should_llm_translate_en(origin):
        return ai_narrative
    try:
        content_de = await _translate_executive_content(content)
        out = dict(ai_narrative)
        out["contentDe"] = content_de
        out["contentDeOrigin"] = "llm"
        return out
    except Exception:
        logger.exception("Executive DE translation failed")
        return ai_narrative


async def ensure_narrative_translations(assessment: dict, *, force: bool = False) -> dict:
    """After full EN bundle exists, attach DE blocks (LLM or hardcoded)."""
    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    if not cv_report:
        return assessment

    answers = assessment.get("answers") or {}
    eye_analysis = analysis.get("eyeAnalysis")
    ai_narrative = assessment.get("aiNarrative")
    features = dict(assessment.get("featureNarratives") or {})
    pn = dict(assessment.get("protocolNarrative") or {})

    sem = asyncio.Semaphore(NARRATIVE_TRANSLATION_CONCURRENCY)

    async def _one_feature(fid: str) -> tuple[str, dict]:
        en = features.get(fid) or {}
        if not force and isinstance(en.get("de"), dict) and en["de"].get("summary"):
            return fid, en
        async with sem:
            de = await resolve_de_for_feature(
                fid, en, cv_report=cv_report, eye_analysis=eye_analysis, answers=answers
            )
        en = dict(en)
        en["de"] = de
        return fid, en

    feature_results = await asyncio.gather(
        *[_one_feature(fid) for fid in FEATURE_NARRATIVE_IDS if fid in features],
        return_exceptions=True,
    )
    for item in feature_results:
        if isinstance(item, Exception):
            logger.exception("Feature DE translation gather error: %s", item)
            continue
        fid, en = item
        features[fid] = en

    # Executive
    if force or not (isinstance(ai_narrative, dict) and ai_narrative.get("contentDe")):
        updated_ai = await ensure_ai_narrative_de(ai_narrative)
        if updated_ai:
            assessment["aiNarrative"] = updated_ai
            ai_narrative = updated_ai

    de_pn = dict(pn.get("de") or {})
    client_name = answers.get("name") or answers.get("fullName") or "Client"

    # Overview
    summary_origin = pn.get("summaryOrigin")
    if force or not de_pn.get("summary"):
        if should_llm_translate_en(summary_origin) and pn.get("summary"):
            try:
                de_pn["summary"] = await translate_text_en_to_de(
                    pn["summary"], label="overview_summary_de"
                )
                de_pn["summaryOrigin"] = "llm"
            except Exception:
                logger.exception("DE overview batch translation failed")
                de_pn["summary"] = _OVERVIEW_FALLBACK_DE
                de_pn["summaryOrigin"] = "template"
        elif pn.get("summary"):
            de_pn["summary"] = _OVERVIEW_FALLBACK_DE
            de_pn["summaryOrigin"] = "template"

    # Closing
    closing_origin = pn.get("closingOrigin")
    closing = pn.get("closing") or []
    if force or not de_pn.get("closing"):
        if closing_origin == "stitch":
            de_pn["closing"] = stitch_closing_paragraphs_de(
                features, ai_narrative, client_name, cv_report=cv_report
            )
            de_pn["closingOrigin"] = "template"
        elif should_llm_translate_en(closing_origin) and closing:
            try:
                de_pn["closing"] = await _translate_closing_paragraphs(closing)
                de_pn["closingOrigin"] = "llm"
            except Exception:
                logger.exception("DE closing batch failed; stitch DE")
                de_pn["closing"] = stitch_closing_paragraphs_de(
                    features, ai_narrative, client_name, cv_report=cv_report
                )
                de_pn["closingOrigin"] = "template"

    # Treatment phases
    phases = pn.get("treatmentPhases")
    if isinstance(phases, dict) and phases.get("origin") == "llm":
        if force or not de_pn.get("treatmentPhases"):
            try:
                de_pn["treatmentPhases"] = await _translate_treatment_phases_plain(phases)
            except Exception:
                logger.exception("DE treatment phases translation failed")

    pn["de"] = de_pn
    assessment["featureNarratives"] = features
    assessment["protocolNarrative"] = pn
    return assessment
