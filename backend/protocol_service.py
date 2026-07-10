"""Generate, load, and persist assessment protocols via storage + MongoDB."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from .narrative_orchestrator import generate_all_protocol_text
from .protocol_storage import StoredProtocol, get_protocol_storage
from .repositories.assessment_repository import update_assessment_protocol


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
