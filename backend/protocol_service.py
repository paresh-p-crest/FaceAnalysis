"""Generate, load, and persist assessment protocols via storage + MongoDB."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from .protocol_storage import StoredProtocol, get_protocol_storage
from .repositories.assessment_repository import update_assessment_protocol
from .text_ai_service import generate_protocol, generate_protocol_narrative, template_protocol


def _bundle_from_assessment(assessment: dict) -> Optional[dict]:
    protocol_data = assessment.get("protocolData")
    if not protocol_data:
        return None
    return {
        "protocolData": protocol_data,
        "protocolNarrative": assessment.get("protocolNarrative"),
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
) -> dict:
    """Write protocol JSON to storage and sync denormalized fields to MongoDB."""
    storage = get_protocol_storage()
    stored: StoredProtocol = await asyncio.to_thread(
        storage.save_protocol,
        assessment_id,
        protocol_data=protocol_data,
        protocol_narrative=protocol_narrative,
    )
    updated = await update_assessment_protocol(
        assessment_id,
        protocol_data=protocol_data,
        protocol_narrative=protocol_narrative,
        protocol_storage=stored.to_dict(),
    )
    return {
        "protocolData": protocol_data,
        "protocolNarrative": protocol_narrative,
        "protocolStorage": stored.to_dict(),
        "assessment": updated,
    }


async def generate_and_store_protocol(assessment: dict) -> dict:
    """Generate protocol once (LLM + template fallback) and persist to storage."""
    assessment_id = assessment["id"]
    existing = load_protocol_bundle(assessment_id, assessment)
    if existing and existing.get("protocolData"):
        return existing

    analysis = assessment.get("analysis") or {}
    cv_report = analysis.get("cvReport") or {}
    answers = assessment.get("answers") or {}
    metrics = analysis.get("metrics")

    protocol_result, narrative_result = await asyncio.gather(
        asyncio.to_thread(
            generate_protocol,
            answers=answers,
            cv_report=cv_report,
            metrics=metrics,
        ),
        asyncio.to_thread(
            generate_protocol_narrative,
            answers=answers,
            cv_report=cv_report,
            metrics=metrics,
        ),
    )

    if protocol_result.get("content"):
        protocol_data: dict[str, Any] = {
            "source": protocol_result.get("source"),
            "model": protocol_result.get("model"),
            **protocol_result["content"],
        }
    else:
        protocol_data = {
            "source": "template",
            "model": None,
            **template_protocol(cv_report),
        }

    protocol_narrative = None
    if narrative_result.get("content"):
        protocol_narrative = {
            "source": narrative_result.get("source"),
            "model": narrative_result.get("model"),
            **narrative_result["content"],
        }

    persisted = await persist_protocol_bundle(
        assessment_id,
        protocol_data=protocol_data,
        protocol_narrative=protocol_narrative,
    )
    persisted["source"] = "generated"
    return persisted


async def delete_stored_protocol(assessment_id: str) -> None:
    storage = get_protocol_storage()
    await asyncio.to_thread(storage.delete_protocol, assessment_id)
