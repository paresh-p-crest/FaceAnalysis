"""Post-hoc German translation for stored English narratives.

DE translation uses structured flat-batch translation (chat_structured_completion) per logical block.
Structure is reassembled in Python — EN titles are preserved. Per-field plain-text fallback runs on key mismatch or API errors.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
import os
import re
from typing import Any, Optional

from .clinical_guardrails import sanitize_report_latin1
from .clinical_guardrails_de import template_feature_narrative_de
from .config import FEATURE_NARRATIVE_IDS, LLM_MAX_OUTPUT_TOKENS, PROTOCOL_FEATURE_IDS
from .feature_context import build_feature_context
from .llm_client import chat_structured_completion, chat_text_completion
from .narrative_orchestrator import _clamp_summary_keep_sentence, _clamp_treatment_phases_raw
from .narrative_schemas import FEATURE_SUMMARY_MAX_LENGTHS, subsection_body_limits
from .narrative_provenance import resolve_feature_origin, should_llm_translate_en, stamp_origin

logger = logging.getLogger(__name__)

NARRATIVE_TRANSLATION_SYSTEM_PROMPT = (
    "Localize the provided report content into native German. Write Du-form "
    "(du/dein/deine; dein lowercase mid-sentence). Do not use Sie/Ihr. "
    "Do not use long hyphens, en dashes, or em dashes. "
    "This is localization, not a literal translation: rewrite so a German aesthetic "
    "consultant would say it. Use native terms (Nasenflügelbasis, Mittelgesicht, "
    "Querbreite, Amorbogen, Ohrmuscheln, Feuchtigkeitsversorgung, Styling). "
    "Do not keep English anatomy (alar base, dorsal hump, transverse span, cupid's bow, "
    "vermilion, malar, midface, auricle, hydration, grooming, peers). "
    "Allowed tokens: MyFace, SPF, AHA, OTC, Retinol, Niacinamid, Vitamin C. "
    "Gloss exercise names once if needed (Kinn-zurück-Übungen (Chin Tucks)). "
    "Output only the German text, no preamble.\n\n"
    "EXAMPLES (compact):\n"
    "EN: The nose is balanced overall. The nostril base is relatively wide, while "
    "width-to-length keeps facial proportions. In profile the brow-to-root transition "
    "is rather blunt and the nose-lip angle is acute, so the profile is gently convex "
    "with only a slight bump on the bridge.\n"
    "DE: Die Form deiner Nase wirkt insgesamt ausgewogen. Die Nasenflügelbasis ist "
    "relativ breit, während das Verhältnis von Breite zu Länge die Gesichtsproportionen "
    "wahrt. Im Profil zeigt sich ein eher stumpfer Übergang zwischen Brauenbereich und "
    "Nasenwurzel sowie ein spitzer Nasen-Lippen-Winkel. Dadurch entsteht ein sanft "
    "konvexes Profil mit einem nur leicht ausgeprägten Höcker auf dem Nasenrücken.\n\n"
    "EN: The lower face shows a defined jaw with an angular jawline and a wide span "
    "that gives the lower third presence from the side.\n"
    "DE: Dein Untergesicht zeigt einen deutlich ausgeprägten Kiefer mit einer kantigen "
    "Unterkieferkante, kombiniert mit einer breiten Querbreite, die dem Untergesicht "
    "seitliche Präsenz verleiht.\n\n"
    "EN: The brows look balanced compared with typical faces. They show a soft arch, "
    "a centered position, dense structure, and a slightly upward direction.\n"
    "DE: Deine Augenbrauen wirken im Vergleich zu Gleichaltrigen ausgewogen. Sie zeigen "
    "einen weichen Bogen, eine mittige Position, eine dichte Struktur und eine leicht "
    "nach oben gerichtete Ausrichtung."
)

_CHAR_LIMIT_GUIDANCE = (
    "\n\nHard character limits for your German output — do not exceed: "
    "feature summary <=500 (chin target ~160, but keep a full sentence); subsection body <=2000 (shorter for brief sections); "
    "treatment item name <=100; item detail <=150; phase summary <=280; "
    "executive summary <=600; disclaimer <=300; list items <=200; closing paragraph <=900."
)

NARRATIVE_TRANSLATION_SYSTEM_PROMPT += _CHAR_LIMIT_GUIDANCE

FLAT_TRANSLATION_BATCH_SUFFIX = (
    " You will receive a flat JSON object. Localize each string value into native German. "
    "Return the exact same keys, same count. Do not merge, split, add, rename, or omit any key. "
    "Values must remain plain strings."
)

NARRATIVE_TRANSLATION_FLAT_SYSTEM = (
    NARRATIVE_TRANSLATION_SYSTEM_PROMPT + FLAT_TRANSLATION_BATCH_SUFFIX
)

NARRATIVE_TRANSLATION_CONCURRENCY = max(
    1, int(os.environ.get("NARRATIVE_TRANSLATION_CONCURRENCY", "11") or "11")
)

_OVERVIEW_FALLBACK_DE = (
    "Dieses evidenzbasierte, nicht-invasive Protokoll basiert auf deinen gemessenen Gesichtsdaten."
)

# Longest-first exact phrases only. Never substring-replace "base".
DE_EXACT_GLOSSARY: tuple[tuple[str, str], ...] = (
    ("alar base", "Nasenflügelbasis"),
    ("dorsal hump", "Höcker auf dem Nasenrücken"),
    ("transverse span", "Querbreite"),
    ("cupid's bow", "Amorbogen"),
    ("cupids bow", "Amorbogen"),
    ("width-to-length", "Verhältnis von Breite zu Länge"),
    ("width to length", "Verhältnis von Breite zu Länge"),
    ("malar projection", "Wangenprojektion"),
    ("malar display", "Wangenprojektion"),
    ("canthal tilt", "Lidachsenneigung"),
    ("structural presentation", "Ausprägung"),
)

_LEAK_DETECT_PHRASES: tuple[str, ...] = tuple(en for en, _de in DE_EXACT_GLOSSARY) + (
    "vermilion",
    "midface",
    "photoprotection",
    "auricle",
    "aurikel",
    "hydration",
    "grooming",
    "the subject",
    "relative strength",
    "edukativ",
)

_DECIMAL_RE = re.compile(r"(?<!SPF )(?<!SPF)(?<!\d)\b(\d+)\.(\d+)\b")
_LEAK_RE = re.compile(
    r"(?:" + "|".join(re.escape(p) for p in sorted(_LEAK_DETECT_PHRASES, key=len, reverse=True)) + r")",
    re.I,
)


def apply_exact_de_glossary(text: str) -> str:
    """Deterministic full-phrase replacements only."""
    if not text:
        return text
    out = text
    for en, de in DE_EXACT_GLOSSARY:
        out = re.sub(re.escape(en), de, out, flags=re.I)
    return out


def localize_de_decimals(text: str) -> str:
    """1.29 → 1,29. Leaves SPF 30+ alone (no decimal)."""
    if not text:
        return text
    return _DECIMAL_RE.sub(r"\1,\2", text)


def find_en_leaks(text: str) -> list[str]:
    if not text:
        return []
    found = []
    seen: set[str] = set()
    for m in _LEAK_RE.finditer(text):
        key = m.group(0).lower()
        if key not in seen:
            seen.add(key)
            found.append(m.group(0))
    return found


def finalize_de_text(text: str) -> str:
    cleaned = sanitize_report_latin1(text)
    cleaned = apply_exact_de_glossary(cleaned)
    return localize_de_decimals(cleaned)


_LEAK_REPAIR_SYSTEM = (
    "The German report field still contains leftover English. Rewrite ONLY those "
    "English terms into native German (Du-form). Keep every other sentence. "
    "Output only the rewritten German, no preamble."
)


async def repair_de_english_leaks(text: str, leaks: list[str], *, label: str) -> str:
    """Targeted LLM repair for leftover English after exact glossary."""
    if not text or not leaks:
        return text
    result = await asyncio.to_thread(
        chat_text_completion,
        messages=[
            {"role": "system", "content": _LEAK_REPAIR_SYSTEM},
            {
                "role": "user",
                "content": f"Leftover English: {', '.join(leaks)}\n\nGerman:\n{text}",
            },
        ],
        temperature=0.2,
        max_tokens=min(LLM_MAX_OUTPUT_TOKENS, max(800, len(text) + 400)),
        label=f"{label}_leak_repair",
    )
    if result.get("error") or not result.get("content"):
        logger.warning("DE leak repair failed for %s: %s", label, result.get("error"))
        return text
    return str(result["content"]).strip()


async def finalize_de_text_async(text: str, *, label: str = "de_finalize") -> str:
    cleaned = finalize_de_text(text)
    leaks = find_en_leaks(cleaned)
    if not leaks:
        return cleaned
    repaired = await repair_de_english_leaks(cleaned, leaks, label=label)
    return finalize_de_text(repaired)


def _batch_max_tokens(
    field_count: int,
    *,
    base: int = LLM_MAX_OUTPUT_TOKENS,
    per_field: int = 2000,
    ceiling: int = 16000,
) -> int:
    """Scale max_tokens for batched translation blocks.

    - Floor: `base` (short blocks keep standard budget).
    - Scale: `per_field * field_count` up to `ceiling`.
    """
    return min(ceiling, max(base, per_field * field_count))


def build_flat_translation_schema(keys: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {k: {"type": "string"} for k in keys},
        "required": keys,
        "additionalProperties": False,
    }


def build_flat_translation_schema_with_limits(keys_and_limits: dict[str, int]) -> dict:
    return {
        "type": "object",
        "properties": {k: {"type": "string", "maxLength": lim} for k, lim in keys_and_limits.items()},
        "required": list(keys_and_limits.keys()),
        "additionalProperties": False,
    }


def _reassemble_indexed_list(
    de_map: dict[str, str],
    prefix: str,
    expected_count: int,
    en_fallback: list[str],
    *,
    label: str = "indexed_list",
) -> list[str]:
    """Reconstruct a list from indexed flat keys. Missing slots use EN fallback."""
    out: list[str] = []
    for i in range(expected_count):
        key = f"{prefix}_{i}"
        val = de_map.get(key)
        if val and isinstance(val, str) and val.strip():
            out.append(val.strip())
        else:
            logger.warning(
                "Indexed list gap for %s at %s; using EN fallback", label, key
            )
            out.append(en_fallback[i] if i < len(en_fallback) else "")
    return out


async def _translate_flat_batch_with_limits(
    en_fields: dict[str, str],
    *,
    keys_and_limits: dict[str, int],
    label: str,
    schema_name: str,
    limit_hint: str = "",
) -> dict[str, str]:
    """Like _translate_flat_batch but uses maxLength-constrained schema."""
    return await _translate_flat_batch(
        en_fields, label=label, schema_name=schema_name,
        keys_and_limits=keys_and_limits, user_suffix=limit_hint,
    )


async def _translate_flat_batch(
    en_fields: dict[str, str],
    *,
    label: str,
    schema_name: str,
    keys_and_limits: dict[str, int] | None = None,
    user_suffix: str = "",
) -> dict[str, str]:
    """Translate a flat dictionary of strings using chat_structured_completion in 1 batch call."""
    keys = list(en_fields.keys())
    if not keys:
        return {}

    max_tokens = _batch_max_tokens(len(keys))
    if keys_and_limits:
        schema = build_flat_translation_schema_with_limits(keys_and_limits)
    else:
        schema = build_flat_translation_schema(keys)
    user_content = json.dumps(en_fields, ensure_ascii=False) + user_suffix
    messages = [
        {"role": "system", "content": NARRATIVE_TRANSLATION_FLAT_SYSTEM},
        {"role": "user", "content": user_content},
    ]

    for attempt in range(2):
        res = await asyncio.to_thread(
            chat_structured_completion,
            schema_name=schema_name,
            json_schema=schema,
            messages=messages,
            temperature=0.15,
            max_tokens=max_tokens,
            require_strict=True,
        )

        content = res.get("content")
        if not res.get("error") and isinstance(content, dict):
            res_keys = set(content.keys())
            expected_keys = set(keys)
            if res_keys == expected_keys and all(
                isinstance(v, str) and v.strip() for v in content.values()
            ):
                return {k: await finalize_de_text_async(content[k].strip(), label=f"{label}_{k}") for k in keys}
            logger.warning(
                "Flat translation batch key mismatch for %s (attempt %d/2). Expected: %s, got: %s, raw: %s",
                label,
                attempt + 1,
                sorted(keys),
                sorted(res_keys),
                str(content)[:200],
            )
        else:
            logger.warning(
                "Flat translation batch API error for %s (attempt %d/2): %s",
                label,
                attempt + 1,
                res.get("error"),
            )

    raise RuntimeError(f"Flat translation batch failed after 2 attempts for {label}")


def _sanitize_translation_text(text: str) -> str:
    if not text:
        return text
    return finalize_de_text(text)


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
    return await finalize_de_text_async(str(result["content"]).strip(), label=label)


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


_OVERALL_LABEL_DE = {
    "average": "durchschnittlich",
    "balanced": "ausgewogen",
    "high": "hoch",
    "low": "niedrig",
    "good": "gut",
    "excellent": "sehr gut",
}


def _de_feature_summary(fn: dict) -> str:
    de = fn.get("de") if isinstance(fn, dict) else None
    if isinstance(de, dict) and isinstance(de.get("summary"), str) and de["summary"].strip():
        return de["summary"].strip()
    return ""


def stitch_closing_paragraphs_de(
    feature_narratives: dict[str, dict],
    ai_narrative: Optional[dict] = None,
    client_name: str = "Client",
    cv_report: Optional[dict] = None,
) -> list[str]:
    """German deterministic closing — native du-form boilerplate, not word-swap Denglisch."""
    paragraphs: list[str] = []
    content_de = None
    if isinstance(ai_narrative, dict):
        raw = ai_narrative.get("contentDe")
        if isinstance(raw, dict):
            content_de = raw
        else:
            content = ai_narrative.get("content") if isinstance(ai_narrative.get("content"), dict) else None
            if isinstance(content, dict) and isinstance(content.get("summaryDe"), str):
                content_de = content

    if isinstance(content_de, dict):
        summary = content_de.get("summary")
        if isinstance(summary, str) and summary.strip() and not _is_generic_summary_local(summary):
            paragraphs.append(summary.strip())

    overall = None
    if isinstance(cv_report, dict):
        overall = (cv_report.get("overall") or {}).get("scoreLabel")
    if overall:
        label = _OVERALL_LABEL_DE.get(str(overall).strip().lower(), str(overall))
        paragraphs.append(
            f"Deine Bewertung zeigt insgesamt eine als {label} beschriebene Gesichtsharmonie "
            "aus den Messungen unter den Licht- und Posebedingungen dieser Sitzung, "
            "keine medizinische Diagnose."
        )

    priorities: list[str] = []
    for fid in PROTOCOL_FEATURE_IDS:
        fn = (feature_narratives or {}).get(fid) or {}
        summary = _de_feature_summary(fn)
        if summary and not _is_generic_summary_local(summary):
            priorities.append(f"{fid}: {summary}")
            continue
        de = fn.get("de") if isinstance(fn, dict) else None
        subs = (de or {}).get("subsections") if isinstance(de, dict) else None
        if isinstance(subs, list):
            for sub in subs:
                body = (sub.get("body") or "").strip() if isinstance(sub, dict) else ""
                if body and "evidence-aligned" not in body.lower():
                    first = body.split(". ")[0].strip()
                    if first and not _is_generic_summary_local(first):
                        priorities.append(f"{fid}: {first}.")
                        break
    if priorities:
        paragraphs.append(
            "Merkmalsspezifische Prioritäten für dich in den nächsten 30 Tagen: "
            + " ".join(priorities[:5])
        )

    if isinstance(content_de, dict):
        strengths = content_de.get("strengths") or []
        focus = content_de.get("focusAreas") or []
        if strengths:
            paragraphs.append(
                "Gemessene Stärken, die du bewahren solltest, sind "
                + "; ".join(str(s) for s in strengths[:3])
                + ". Pflege, Sonnenschutz und Alltagsgewohnheiten, die diese Bereiche stützen, beibehalten."
            )
        if focus:
            paragraphs.append(
                "Die wichtigsten Ansatzpunkte für dich sind "
                + "; ".join(str(s) for s in focus[:3])
                + ". Gehe sie zuerst mit zurückhaltender topischer Pflege, Schlaf, Feuchtigkeitsversorgung "
                "und Haltung bzw. Styling an, bevor du eine Praxisberatung in Betracht ziehst."
            )

    if len(paragraphs) < 3:
        paragraphs.append(
            "Ein praktischer 30-Tage-Plan für dich: täglicher breitbandiger Sonnenschutz SPF 50 im Freien; "
            "sanfte Reinigung morgens und abends; ausreichend Schlaf und Feuchtigkeitsversorgung; "
            "sowie die merkmalsbezogene Pflege auf den einzelnen Protokollseiten. "
            "Vermeide aggressive Wirkstoffe, bis die Verträglichkeit klar ist."
        )
        paragraphs.append(
            "Wiederhole die Analyse bei gleichbleibender Beleuchtung, neutralem Gesichtsausdruck "
            "und gleichem Kameraabstand, um Fortschritte zu vergleichen. "
            "Besprich anhaltende oder zunehmende Anliegen mit einer qualifizierten medizinischen Fachkraft; "
            "dieser Bericht ersetzt keine klinische Untersuchung."
        )

    paragraphs.append(
        "Dieses Protokoll ist Bildungsinhalt auf Grundlage deiner Gesichtsmessungen, "
        "keine medizinische Diagnose oder Behandlung."
    )
    seen: set[str] = set()
    out: list[str] = []
    for p in paragraphs:
        key = p.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out[:6]


def _is_generic_summary_local(text: str) -> bool:
    t = (text or "").strip().lower()
    return (
        not t
        or "non-surgical guidance for" in t
        or "based on stored measurements" in t
        or "nicht-chirurgische empfehlung" in t
    )


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


async def _translate_executive_content_plain(content: dict) -> dict:
    """Plain-text per field fallback for executive narrative content."""
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


async def _translate_executive_content(content: dict) -> dict:
    """Flat-batch translation for executive narrative content with per-field fallback."""
    en_fields: dict[str, str] = {}
    if content.get("summary") and isinstance(content["summary"], str) and content["summary"].strip():
        en_fields["summary"] = content["summary"].strip()

    for list_key in ("strengths", "focusAreas", "recommendations"):
        vals = content.get(list_key)
        if isinstance(vals, list):
            for i, v in enumerate(vals):
                if isinstance(v, str) and v.strip():
                    prefix_map = {
                        "strengths": "strength",
                        "focusAreas": "focus",
                        "recommendations": "recommendation",
                    }
                    en_fields[f"{prefix_map[list_key]}_{i}"] = v.strip()

    if content.get("disclaimer") and isinstance(content["disclaimer"], str) and content["disclaimer"].strip():
        en_fields["disclaimer"] = content["disclaimer"].strip()

    if not en_fields:
        return stamp_origin(copy.deepcopy(content), "llm")

    # Build per-field limits matching EN caps
    exec_limits: dict[str, int] = {}
    for k in en_fields:
        if k == "summary":
            exec_limits[k] = 600
        elif k == "disclaimer":
            exec_limits[k] = 300
        else:
            exec_limits[k] = 200

    try:
        de_map = await _translate_flat_batch(
            en_fields, label="executive_content_de", schema_name="executive_content_de_flat",
            keys_and_limits=exec_limits,
        )
        out: dict[str, Any] = {}
        if "summary" in de_map:
            out["summary"] = de_map["summary"]

        for list_key, prefix in (
            ("strengths", "strength"),
            ("focusAreas", "focus"),
            ("recommendations", "recommendation"),
        ):
            vals = content.get(list_key)
            if isinstance(vals, list):
                out[list_key] = _reassemble_indexed_list(
                    de_map, prefix, len(vals), vals, label=f"executive_{list_key}"
                )
            elif vals is not None:
                out[list_key] = vals

        if "disclaimer" in de_map:
            out["disclaimer"] = de_map["disclaimer"]

        return stamp_origin(out, "llm")
    except Exception as exc:
        logger.warning(
            "Flat translation batch failed for executive content; falling back to plain per-field [tone-mismatch risk]: %s",
            exc,
        )
        return await _translate_executive_content_plain(content)


async def _translate_feature_narrative_llm_plain(narrative: dict, feature_id: str) -> dict:
    """Plain-text per field fallback for feature narrative."""
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
    summary_cap = FEATURE_SUMMARY_MAX_LENGTHS.get(feature_id)
    if summary_cap:
        summary_de = _clamp_summary_keep_sentence(summary_de, summary_cap)

    subsections = [
        {"title": s.get("title"), "body": bodies_de[i]}
        for i, s in enumerate(subs_en)
    ]
    return stamp_origin({"summary": summary_de, "subsections": subsections}, "llm")


async def _translate_feature_narrative_llm(narrative: dict, feature_id: str) -> dict:
    """Translate summary + each subsection body as flat batch; keep EN titles."""
    summary_en = narrative.get("summary") or ""
    subs_en = [
        s for s in (narrative.get("subsections") or []) if isinstance(s, dict)
    ]

    en_fields: dict[str, str] = {}
    if summary_en.strip():
        en_fields["summary"] = summary_en.strip()

    for i, s in enumerate(subs_en):
        body = s.get("body") or ""
        if body.strip():
            en_fields[f"subsection_{i}"] = body.strip()

    if not en_fields:
        subsections = [{"title": s.get("title"), "body": ""} for s in subs_en]
        return stamp_origin({"summary": "", "subsections": subsections}, "llm")

    # Build schema with per-field maxLength caps (same as EN)
    keys_and_limits: dict[str, int] = {}
    if "summary" in en_fields:
        # Keep translation schema wide; apply feature-specific summary caps post-translation.
        keys_and_limits["summary"] = 500
    for i, s in enumerate(subs_en):
        key = f"subsection_{i}"
        if key in en_fields:
            title = s.get("title") or ""
            _min, max_len = subsection_body_limits(feature_id, title)
            keys_and_limits[key] = max_len

    # Per-field limit hint in user message
    limit_parts = []
    if "summary" in keys_and_limits:
        limit_parts.append(f"summary <={keys_and_limits['summary']}")
    for i, s in enumerate(subs_en):
        key = f"subsection_{i}"
        if key in keys_and_limits:
            limit_parts.append(f"{s.get('title', key)} <={keys_and_limits[key]}")
    limit_hint = f"\n\nMax chars: {'; '.join(limit_parts)}." if limit_parts else ""

    try:
        de_map = await _translate_flat_batch_with_limits(
            en_fields,
            keys_and_limits=keys_and_limits,
            label=f"feature_{feature_id}_de",
            schema_name=f"feature_{feature_id}_de_flat",
            limit_hint=limit_hint,
        )
        summary_de = de_map.get("summary", "")
        summary_cap = FEATURE_SUMMARY_MAX_LENGTHS.get(feature_id)
        if summary_cap:
            summary_de = _clamp_summary_keep_sentence(summary_de, summary_cap)
        subsections = []
        for i, s in enumerate(subs_en):
            key = f"subsection_{i}"
            body_de = de_map.get(key) or (s.get("body") if key not in en_fields else "")
            subsections.append({"title": s.get("title"), "body": body_de})
        return stamp_origin({"summary": summary_de, "subsections": subsections}, "llm")
    except Exception as exc:
        logger.warning(
            "Flat translation batch failed for feature %s; falling back to plain per-field [tone-mismatch risk]: %s",
            feature_id,
            exc,
        )
        return await _translate_feature_narrative_llm_plain(narrative, feature_id)


async def _translate_closing_paragraphs(closing: list) -> list[str]:
    """Flat-batch translation for closing paragraphs with per-field fallback."""
    en_fields: dict[str, str] = {}
    for i, p in enumerate(closing):
        if isinstance(p, str) and p.strip():
            en_fields[f"paragraph_{i}"] = p.strip()

    if not en_fields:
        return [p if isinstance(p, str) else "" for p in closing]

    try:
        de_map = await _translate_flat_batch(
            en_fields, label="closing_paragraphs_de", schema_name="closing_paragraphs_de_flat",
        )
        fallback_texts = [p if isinstance(p, str) else "" for p in closing]
        return _reassemble_indexed_list(
            de_map, "paragraph", len(closing), fallback_texts, label="closing_paragraphs"
        )
    except Exception as exc:
        logger.warning(
            "Flat translation batch failed for closing paragraphs; falling back to parallel per-field [tone-mismatch risk]: %s",
            exc,
        )
        texts = [p if isinstance(p, str) else "" for p in closing]
        return await _translate_strings_parallel(texts, label_prefix="closing_para_de")


_PHASE_FIELD_TAG_RE = re.compile(r"<<([a-zA-Z0-9_.]+)>>")

_PHASE_PACK_SYSTEM = (
    NARRATIVE_TRANSLATION_SYSTEM_PROMPT
    + " When the user message contains <<tag>> markers, keep every marker line "
    "unchanged and in the same order. Localize only the text between markers."
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
