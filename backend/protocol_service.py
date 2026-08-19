"""Generate, load, and persist assessment protocols via storage + database."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from .narrative_orchestrator import (
    generate_all_protocol_text,
    generate_closing_synthesis_async,
    stitch_closing_paragraphs,
)
from .protocol_storage import StoredProtocol, get_protocol_storage
from .report_content import report_content_status
from .repositories.assessment_repository import (
    update_assessment_ai_narrative,
    update_assessment_protocol,
)
from .narrative_provenance import resolve_feature_origin
from .narrative_translation import (
    ensure_ai_narrative_de,
    ensure_narrative_translations,
    translate_protocol_section_de,
)
from .text_ai_service import generate_cv_narrative

logger = logging.getLogger(__name__)


def _has_ai_narrative(assessment: dict) -> bool:
    narrative = assessment.get("aiNarrative")
    if not isinstance(narrative, dict):
        return False
    content = narrative.get("content")
    if isinstance(content, dict) and (content.get("summary") or content.get("strengths")):
        return True
    return bool(narrative.get("summary") or narrative.get("content"))


def _protocol_fields_present(assessment: Optional[dict]) -> bool:
    if not assessment:
        return False
    features = assessment.get("featureNarratives") or {}
    pn = assessment.get("protocolNarrative") or {}
    if isinstance(features, dict) and len(features) >= 10:
        return bool(isinstance(pn, dict) and (pn.get("summary") or pn.get("closing")))
    return bool(
        isinstance(pn, dict)
        and pn.get("features")
        and len(pn.get("features") or {}) >= 10
        and (pn.get("summary") or pn.get("closing"))
    )


async def ensure_ai_narrative(assessment: dict, *, force: bool = False) -> Optional[dict]:
    """Generate and persist executive AI narrative once (unless force=True)."""
    if not force and _has_ai_narrative(assessment):
        return assessment.get("aiNarrative")

    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport")
    if not cv_report:
        return assessment.get("aiNarrative")

    result = await asyncio.to_thread(
        generate_cv_narrative,
        answers=assessment.get("answers") or {},
        cv_report=cv_report,
        metrics=analysis.get("metrics"),
        assessment_id=assessment.get("id"),
        photos_meta=assessment.get("photos") or {},
    )
    if result.get("error"):
        logger.warning("AI narrative generation failed for %s: %s", assessment.get("id"), result["error"])
        return None

    ai_narrative = {
        "source": result.get("source"),
        "model": result.get("model"),
        "content": result.get("content"),
        "contentOrigin": "llm",
    }
    ai_narrative = await ensure_ai_narrative_de(ai_narrative) or ai_narrative
    updated = await update_assessment_ai_narrative(assessment["id"], ai_narrative)
    if updated:
        assessment["aiNarrative"] = ai_narrative
    return ai_narrative


async def enrich_assessment_nl_content(assessment: dict, *, force: bool = False) -> dict:
    """One-shot pipeline enrichment: executive narrative + protocol/feature text.

    Idempotent — skips work that is already stored unless force=True. Failures are
    logged; CV assessment remains usable without NL content.
    """
    assessment_id = assessment.get("id")
    try:
        await ensure_ai_narrative(assessment, force=force)
    except Exception:
        logger.exception("AI narrative enrichment failed for %s", assessment_id)

    try:
        bundle = await generate_and_store_protocol(assessment, force=force)
        assessment["protocolNarrative"] = bundle.get("protocolNarrative")
        assessment["featureNarratives"] = bundle.get("featureNarratives")
        assessment["protocolStorage"] = bundle.get("protocolStorage")
    except Exception:
        logger.exception("Protocol enrichment failed for %s", assessment_id)

    return assessment


def is_narratives_complete(assessment: dict) -> bool:
    """True when executive narrative and all feature narratives are non-template."""
    if not _has_ai_narrative(assessment):
        return False
    bundle = _bundle_from_assessment(assessment)
    if not _bundle_complete(bundle):
        return False
    from .config import FEATURE_NARRATIVE_IDS

    features = assessment.get("featureNarratives") or {}
    if not isinstance(features, dict):
        return False
    for fid in FEATURE_NARRATIVE_IDS:
        entry = features.get(fid)
        if not entry or resolve_feature_origin(entry) != "llm":
            return False
    return True


def _bundle_from_assessment(assessment: dict) -> Optional[dict]:
    if not _protocol_fields_present(assessment):
        # Allow partial DB loads when any narrative fields exist
        pn = assessment.get("protocolNarrative")
        features = assessment.get("featureNarratives")
        if not pn and not features:
            return None
    return {
        "protocolNarrative": assessment.get("protocolNarrative"),
        "featureNarratives": assessment.get("featureNarratives"),
        "protocolStorage": assessment.get("protocolStorage"),
        "source": "database",
    }


def _bundle_complete(bundle: Optional[dict]) -> bool:
    if not bundle:
        return False
    features = bundle.get("featureNarratives") or {}
    pn = bundle.get("protocolNarrative") or {}
    if not isinstance(pn, dict):
        return False
    has_features = (
        (isinstance(features, dict) and len(features) >= 10)
        or (isinstance(pn.get("features"), dict) and len(pn.get("features") or {}) >= 10)
    )
    has_summary = bool((pn.get("summary") or "").strip())
    closing = pn.get("closing") or []
    has_closing = isinstance(closing, list) and any(isinstance(p, str) and p.strip() for p in closing)
    return bool(has_features and has_summary and has_closing)


def load_protocol_bundle(assessment_id: str, assessment: Optional[dict] = None) -> Optional[dict]:
    """Load protocol — DB wins when complete; else file; else partial DB."""
    db_bundle = _bundle_from_assessment(assessment) if assessment else None
    if db_bundle and _bundle_complete(db_bundle):
        return db_bundle

    storage = get_protocol_storage()
    stored = storage.load_protocol(assessment_id)
    if stored and (stored.get("protocolNarrative") or stored.get("featureNarratives")):
        file_bundle = {
            "protocolNarrative": stored.get("protocolNarrative"),
            "featureNarratives": stored.get("featureNarratives"),
            "protocolStorage": assessment.get("protocolStorage") if assessment else None,
            "storedAt": stored.get("storedAt"),
            "source": "storage",
        }
        if _bundle_complete(file_bundle) or not db_bundle:
            return file_bundle

    return db_bundle


async def persist_protocol_bundle(
    assessment_id: str,
    *,
    protocol_narrative: Optional[dict],
    feature_narratives: Optional[dict] = None,
) -> dict:
    """Write protocol JSON to storage and sync denormalized fields to the database."""
    storage = get_protocol_storage()
    stored: StoredProtocol = await asyncio.to_thread(
        storage.save_protocol,
        assessment_id,
        protocol_narrative=protocol_narrative,
        feature_narratives=feature_narratives,
    )
    updated = await update_assessment_protocol(
        assessment_id,
        protocol_narrative=protocol_narrative,
        feature_narratives=feature_narratives,
        protocol_storage=stored.to_dict(),
        unset_protocol_data=True,
    )
    return {
        "protocolNarrative": protocol_narrative,
        "featureNarratives": feature_narratives,
        "protocolStorage": stored.to_dict(),
        "assessment": updated,
    }


async def refresh_protocol_closing_for_assessment(assessment: dict) -> Optional[dict]:
    """Rewrite and persist protocolNarrative.closing after aiNarrative changes."""
    assessment_id = assessment.get("id")
    if not assessment_id:
        return None
    features = assessment.get("featureNarratives") or {}
    pn = dict(assessment.get("protocolNarrative") or {})
    if not features and not pn.get("features"):
        return None

    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    answers = assessment.get("answers") or {}
    client_name = answers.get("name") or answers.get("fullName") or "Client"

    # Prefer canonical featureNarratives; fall back to compat shim features
    feature_map = features if isinstance(features, dict) and features else (pn.get("features") or {})

    closing = await generate_closing_synthesis_async(
        feature_map,
        cv_report=cv_report,
        ai_narrative=assessment.get("aiNarrative"),
        answers=answers,
        client_name=client_name,
    )
    if not closing:
        closing = stitch_closing_paragraphs(
            feature_map,
            assessment.get("aiNarrative"),
            client_name,
            cv_report=cv_report,
        )
        pn["closingOrigin"] = "stitch"
    else:
        pn["closingOrigin"] = "llm"

    pn["closing"] = closing
    if not pn.get("summary"):
        overall = (cv_report.get("overall") or {}).get("score", "N/A")
        pn["summary"] = (
            f"This evidence-based non-surgical protocol is grounded in the subject's measured facial analysis "
            f"(overall harmony {overall}/100), organised around key aesthetic features."
        )
    if not pn.get("features") and feature_map:
        from .narrative_orchestrator import build_protocol_narrative_compat

        rebuilt = build_protocol_narrative_compat(
            feature_narratives=feature_map,
            overview_summary=pn.get("summary") or "",
            closing=closing,
            treatment_phases=pn.get("treatmentPhases"),
            source=pn.get("source") or "orchestrator",
            model=pn.get("model"),
            summary_origin=pn.get("summaryOrigin"),
            closing_origin=pn.get("closingOrigin"),
        )
        # Preserve already stored locale/custom keys when rebuilding compat shape.
        pn = {**pn, **rebuilt}
        if pn.get("model") is None and (assessment.get("protocolNarrative") or {}).get("model") is not None:
            pn["model"] = (assessment.get("protocolNarrative") or {}).get("model")

    assessment["protocolNarrative"] = pn
    assessment["featureNarratives"] = features if features else feature_map
    await translate_protocol_section_de(assessment, "closing")
    return await persist_protocol_bundle(
        assessment_id,
        protocol_narrative=assessment["protocolNarrative"],
        feature_narratives=assessment.get("featureNarratives"),
    )


async def generate_and_store_protocol(assessment: dict, *, force: bool = False) -> dict:
    """Generate protocol via structured per-feature orchestrator and persist.

    When force=True (admin), regenerate all features + overview + closing even if
    a complete bundle already exists.
    """
    assessment_id = assessment["id"]
    existing = load_protocol_bundle(assessment_id, assessment)
    if not force and existing and _bundle_complete(existing):
        return existing

    generated = await generate_all_protocol_text(assessment, skip_existing=not force)

    if not force and existing and existing.get("featureNarratives"):
        merged = dict(existing.get("featureNarratives") or {})
        merged.update(generated.get("featureNarratives") or {})
        generated["featureNarratives"] = merged

    assessment["protocolNarrative"] = generated["protocolNarrative"]
    assessment["featureNarratives"] = generated.get("featureNarratives")
    await ensure_narrative_translations(assessment, force=force)

    persisted = await persist_protocol_bundle(
        assessment_id,
        protocol_narrative=assessment["protocolNarrative"],
        feature_narratives=assessment.get("featureNarratives"),
    )
    persisted["source"] = "generated"
    return persisted


async def regenerate_protocol_section(assessment: dict, section_id: str) -> dict:
    """Regenerate one protocol section (overview | closing | feature id) and persist."""
    from .config import FEATURE_NARRATIVE_IDS, PROTOCOL_FEATURE_IDS
    from .narrative_orchestrator import (
        build_protocol_narrative_compat,
        generate_closing_synthesis_async,
        generate_feature_narrative_async,
        generate_protocol_overview_async,
        stitch_closing_paragraphs,
    )

    section_id = (section_id or "").strip().lower()
    valid = {"overview", "closing", *FEATURE_NARRATIVE_IDS}
    if section_id not in valid:
        raise ValueError(
            f"Invalid sectionId '{section_id}'. Expected one of: overview, closing, "
            + ", ".join(FEATURE_NARRATIVE_IDS)
        )

    assessment_id = assessment["id"]
    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    if not cv_report:
        raise ValueError("Stored cvReport is required for protocol section generation")

    answers = assessment.get("answers") or {}
    metrics = analysis.get("metrics")
    eye_analysis = analysis.get("eyeAnalysis")
    client_name = answers.get("name") or answers.get("fullName") or "Client"
    photos_meta = assessment.get("photos") or {}

    features = dict(assessment.get("featureNarratives") or {})
    pn = dict(assessment.get("protocolNarrative") or {})
    overview_summary = (pn.get("summary") or "").strip()
    closing = list(pn.get("closing") or []) if isinstance(pn.get("closing"), list) else []
    summary_origin = pn.get("summaryOrigin")
    closing_origin = pn.get("closingOrigin")

    if section_id == "overview":
        overview = await generate_protocol_overview_async(
            answers=answers, cv_report=cv_report, metrics=metrics
        )
        overview_summary = overview.get("summary") or overview_summary
        summary_origin = overview.get("origin") or "template"
    elif section_id == "closing":
        closing = await generate_closing_synthesis_async(
            features,
            cv_report=cv_report,
            ai_narrative=assessment.get("aiNarrative"),
            answers=answers,
            client_name=client_name,
        )
        if not closing:
            closing = stitch_closing_paragraphs(
                features,
                assessment.get("aiNarrative"),
                client_name,
                cv_report=cv_report,
            )
            closing_origin = "stitch"
        else:
            closing_origin = "llm"
    else:
        narrative = await generate_feature_narrative_async(
            section_id,
            cv_report=cv_report,
            eye_analysis=eye_analysis,
            answers=answers,
            assessment_id=assessment_id,
            photos_meta=photos_meta,
        )
        features[section_id] = narrative

    protocol_narrative = build_protocol_narrative_compat(
        feature_narratives={
            fid: features[fid] for fid in PROTOCOL_FEATURE_IDS if fid in features
        },
        overview_summary=overview_summary,
        closing=closing,
        # Preserve existing treatment phases when regenerating only one section.
        treatment_phases=pn.get("treatmentPhases"),
        source="admin_section",
        model=None,
        summary_origin=summary_origin,
        closing_origin=closing_origin,
    )
    # Preserve previously stored protocol payload keys (not regenerated in this call),
    # including locale blocks such as protocolNarrative.de and any custom metadata.
    protocol_narrative = {**pn, **protocol_narrative}
    if protocol_narrative.get("model") is None and pn.get("model") is not None:
        protocol_narrative["model"] = pn.get("model")

    assessment["protocolNarrative"] = protocol_narrative
    assessment["featureNarratives"] = features
    await translate_protocol_section_de(assessment, section_id)

    persisted = await persist_protocol_bundle(
        assessment_id,
        protocol_narrative=assessment["protocolNarrative"],
        feature_narratives=assessment.get("featureNarratives"),
    )
    persisted["source"] = "section"
    persisted["sectionId"] = section_id
    return persisted


# Locales that have a post-hoc translation layer from English source narratives.
SUPPORTED_TRANSLATION_LOCALES = frozenset({"de"})


async def regenerate_narrative_translations(
    assessment: dict,
    *,
    locale: str,
) -> dict:
    """Force re-translate stored EN narratives into ``locale`` and persist.

    English is the source language — there is no EN translation step.
    Currently only ``de`` is supported (ADR-044).
    """
    locale = (locale or "").strip().lower()
    if locale in ("", "en"):
        raise ValueError(
            "English is the source narrative language; there is no translation to regenerate. "
            "Use locale=de to force German translation."
        )
    if locale not in SUPPORTED_TRANSLATION_LOCALES:
        raise ValueError(
            f"Unsupported translation locale '{locale}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_TRANSLATION_LOCALES))}"
        )

    assessment_id = assessment["id"]
    analysis = assessment.get("analysis") or {}
    if not analysis.get("cvReport"):
        raise ValueError("Stored cvReport is required for narrative translation.")

    features = assessment.get("featureNarratives") or {}
    pn = assessment.get("protocolNarrative") or {}
    if not features and not (isinstance(pn, dict) and (pn.get("summary") or pn.get("closing"))):
        raise ValueError("No English protocol/feature narratives to translate.")

    # Always force — this endpoint exists to redo translations.
    await ensure_narrative_translations(assessment, force=True)

    persisted = await persist_protocol_bundle(
        assessment_id,
        protocol_narrative=assessment["protocolNarrative"],
        feature_narratives=assessment.get("featureNarratives"),
    )

    ai = assessment.get("aiNarrative")
    if isinstance(ai, dict) and ai.get("contentDe"):
        updated = await update_assessment_ai_narrative(assessment_id, ai)
        if updated:
            persisted["assessment"] = updated

    persisted["source"] = "translation"
    persisted["locale"] = locale
    return persisted


async def delete_stored_protocol(assessment_id: str) -> None:
    storage = get_protocol_storage()
    await asyncio.to_thread(storage.delete_protocol, assessment_id)


# Re-export for callers that want status without importing report_content
__all__ = [
    "ensure_ai_narrative",
    "enrich_assessment_nl_content",
    "is_narratives_complete",
    "load_protocol_bundle",
    "persist_protocol_bundle",
    "generate_and_store_protocol",
    "regenerate_protocol_section",
    "regenerate_narrative_translations",
    "SUPPORTED_TRANSLATION_LOCALES",
    "delete_stored_protocol",
    "refresh_protocol_closing_for_assessment",
    "report_content_status",
]