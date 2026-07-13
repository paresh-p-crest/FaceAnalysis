"""Generate, load, and persist assessment protocols via storage + MongoDB."""

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
    }
    updated = await update_assessment_ai_narrative(assessment["id"], ai_narrative)
    if updated:
        assessment["aiNarrative"] = ai_narrative
    return ai_narrative


async def enrich_assessment_nl_content(assessment: dict) -> dict:
    """One-shot pipeline enrichment: executive narrative + protocol/feature text.

    Idempotent — skips work that is already stored. Failures are logged; CV
    assessment remains usable without NL content.
    """
    assessment_id = assessment.get("id")
    try:
        await ensure_ai_narrative(assessment, force=False)
    except Exception:
        logger.exception("AI narrative enrichment failed for %s", assessment_id)

    try:
        bundle = await generate_and_store_protocol(assessment)
        assessment["protocolNarrative"] = bundle.get("protocolNarrative")
        assessment["featureNarratives"] = bundle.get("featureNarratives")
        assessment["protocolStorage"] = bundle.get("protocolStorage")
    except Exception:
        logger.exception("Protocol enrichment failed for %s", assessment_id)

    return assessment


def _bundle_from_assessment(assessment: dict) -> Optional[dict]:
    if not _protocol_fields_present(assessment):
        # Allow partial Mongo loads when any narrative fields exist
        pn = assessment.get("protocolNarrative")
        features = assessment.get("featureNarratives")
        if not pn and not features:
            return None
    return {
        "protocolNarrative": assessment.get("protocolNarrative"),
        "featureNarratives": assessment.get("featureNarratives"),
        "protocolStorage": assessment.get("protocolStorage"),
        "source": "mongodb",
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
    """Load protocol — Mongo wins when complete; else file; else partial Mongo."""
    mongo_bundle = _bundle_from_assessment(assessment) if assessment else None
    if mongo_bundle and _bundle_complete(mongo_bundle):
        return mongo_bundle

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
        if _bundle_complete(file_bundle) or not mongo_bundle:
            return file_bundle

    return mongo_bundle


async def persist_protocol_bundle(
    assessment_id: str,
    *,
    protocol_narrative: Optional[dict],
    feature_narratives: Optional[dict] = None,
) -> dict:
    """Write protocol JSON to storage and sync denormalized fields to MongoDB."""
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

    pn["closing"] = closing
    if not pn.get("summary"):
        overall = (cv_report.get("overall") or {}).get("score", "N/A")
        pn["summary"] = (
            f"This evidence-based non-surgical protocol is grounded in the subject's measured facial analysis "
            f"(overall harmony {overall}/100), organised around key aesthetic features."
        )
    if not pn.get("features") and feature_map:
        from .narrative_orchestrator import build_protocol_narrative_compat

        pn = build_protocol_narrative_compat(
            feature_narratives=feature_map,
            overview_summary=pn.get("summary") or "",
            closing=closing,
            source=pn.get("source") or "orchestrator",
            model=pn.get("model"),
        )

    return await persist_protocol_bundle(
        assessment_id,
        protocol_narrative=pn,
        feature_narratives=features if features else None,
    )


async def generate_and_store_protocol(assessment: dict) -> dict:
    """Generate protocol via structured per-feature orchestrator and persist."""
    assessment_id = assessment["id"]
    existing = load_protocol_bundle(assessment_id, assessment)
    if existing and _bundle_complete(existing):
        return existing

    generated = await generate_all_protocol_text(assessment, skip_existing=True)

    # Merge with any partial existing feature narratives
    if existing and existing.get("featureNarratives"):
        merged = dict(existing.get("featureNarratives") or {})
        merged.update(generated.get("featureNarratives") or {})
        generated["featureNarratives"] = merged

    persisted = await persist_protocol_bundle(
        assessment_id,
        protocol_narrative=generated["protocolNarrative"],
        feature_narratives=generated.get("featureNarratives"),
    )
    persisted["source"] = "generated"
    return persisted


async def delete_stored_protocol(assessment_id: str) -> None:
    storage = get_protocol_storage()
    await asyncio.to_thread(storage.delete_protocol, assessment_id)


# Re-export for callers that want status without importing report_content
__all__ = [
    "ensure_ai_narrative",
    "enrich_assessment_nl_content",
    "load_protocol_bundle",
    "persist_protocol_bundle",
    "generate_and_store_protocol",
    "delete_stored_protocol",
    "refresh_protocol_closing_for_assessment",
    "report_content_status",
]
