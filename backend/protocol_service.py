"""Generate, load, and persist assessment protocols via storage + MongoDB."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from .narrative_orchestrator import generate_all_protocol_text
from .protocol_storage import StoredProtocol, get_protocol_storage
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
        assessment["protocolData"] = bundle.get("protocolData")
        assessment["protocolNarrative"] = bundle.get("protocolNarrative")
        assessment["featureNarratives"] = bundle.get("featureNarratives")
        assessment["protocolStorage"] = bundle.get("protocolStorage")
    except Exception:
        logger.exception("Protocol enrichment failed for %s", assessment_id)

    return assessment


def _bundle_from_assessment(assessment: dict) -> Optional[dict]:
    protocol_data = assessment.get("protocolData")
    if not protocol_data:
        return None
    return {
        "protocolData": protocol_data,
        "protocolNarrative": assessment.get("protocolNarrative"),
        "featureNarratives": assessment.get("featureNarratives"),
        "protocolStorage": assessment.get("protocolStorage"),
        "source": "mongodb",
    }


def load_protocol_bundle(assessment_id: str, assessment: Optional[dict] = None) -> Optional[dict]:
    """Load protocol from local/cloud storage, then MongoDB fallback."""
    storage = get_protocol_storage()
    stored = storage.load_protocol(assessment_id)
    if stored and stored.get("protocolData"):
        return {
            "protocolData": stored.get("protocolData"),
            "protocolNarrative": stored.get("protocolNarrative"),
            "featureNarratives": stored.get("featureNarratives"),
            "protocolStorage": assessment.get("protocolStorage") if assessment else None,
            "storedAt": stored.get("storedAt"),
            "source": "storage",
        }
    if assessment:
        return _bundle_from_assessment(assessment)
    return None


async def persist_protocol_bundle(
    assessment_id: str,
    *,
    protocol_data: dict,
    protocol_narrative: Optional[dict],
    feature_narratives: Optional[dict] = None,
) -> dict:
    """Write protocol JSON to storage and sync denormalized fields to MongoDB."""
    storage = get_protocol_storage()
    stored: StoredProtocol = await asyncio.to_thread(
        storage.save_protocol,
        assessment_id,
        protocol_data=protocol_data,
        protocol_narrative=protocol_narrative,
        feature_narratives=feature_narratives,
    )
    updated = await update_assessment_protocol(
        assessment_id,
        protocol_data=protocol_data,
        protocol_narrative=protocol_narrative,
        feature_narratives=feature_narratives,
        protocol_storage=stored.to_dict(),
    )
    return {
        "protocolData": protocol_data,
        "protocolNarrative": protocol_narrative,
        "featureNarratives": feature_narratives,
        "protocolStorage": stored.to_dict(),
        "assessment": updated,
    }


def _bundle_complete(bundle: Optional[dict]) -> bool:
    if not bundle or not bundle.get("protocolData"):
        return False
    features = bundle.get("featureNarratives") or {}
    if isinstance(features, dict) and len(features) >= 10:
        return True
    pn = bundle.get("protocolNarrative") or {}
    return bool(isinstance(pn, dict) and pn.get("features") and len(pn.get("features")) >= 10)


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
        protocol_data=generated["protocolData"],
        protocol_narrative=generated["protocolNarrative"],
        feature_narratives=generated.get("featureNarratives"),
    )
    persisted["source"] = "generated"
    return persisted


async def delete_stored_protocol(assessment_id: str) -> None:
    storage = get_protocol_storage()
    await asyncio.to_thread(storage.delete_protocol, assessment_id)
