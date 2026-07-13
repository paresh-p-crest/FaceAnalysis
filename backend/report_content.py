"""Report generated-content completeness helpers and envelope shapes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AiNarrativeContent(BaseModel):
    summary: str = ""
    strengths: list[str] = Field(default_factory=list)
    focusAreas: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    disclaimer: str = ""


class AiNarrativeEnvelope(BaseModel):
    source: Optional[str] = None
    model: Optional[str] = None
    generatedAt: Optional[str] = None
    content: AiNarrativeContent


class AiVisualVariant(BaseModel):
    type: str
    title: str
    prompt: str
    imageSrc: Optional[str] = None
    status: str
    error: Optional[str] = None


class AiVisualsEnvelope(BaseModel):
    source: Optional[str] = None
    model: Optional[str] = None
    sourceKind: Optional[str] = None
    generatedAt: Optional[str] = None
    variants: list[AiVisualVariant] = Field(default_factory=list)


def _has_ai_narrative(assessment: dict) -> bool:
    narrative = assessment.get("aiNarrative")
    if not isinstance(narrative, dict):
        return False
    content = narrative.get("content")
    if isinstance(content, dict) and (content.get("summary") or content.get("strengths")):
        return True
    return bool(narrative.get("summary") or narrative.get("content"))


def _has_feature_narratives(assessment: dict) -> bool:
    features = assessment.get("featureNarratives") or {}
    return isinstance(features, dict) and len(features) >= 10


def _has_protocol_narrative(assessment: dict) -> bool:
    pn = assessment.get("protocolNarrative") or {}
    if not isinstance(pn, dict):
        return False
    summary = (pn.get("summary") or "").strip()
    closing = pn.get("closing") or []
    has_closing = isinstance(closing, list) and any(isinstance(p, str) and p.strip() for p in closing)
    features = pn.get("features") or {}
    has_features = isinstance(features, dict) and len(features) >= 10
    return bool(summary and has_closing and (has_features or _has_feature_narratives(assessment)))


def _has_ai_visuals(assessment: dict) -> bool:
    visuals = assessment.get("aiVisuals")
    if not isinstance(visuals, dict):
        return False
    variants = visuals.get("variants") or []
    if not isinstance(variants, list) or not variants:
        return False
    return all(isinstance(v, dict) and isinstance(v.get("prompt"), str) and v.get("prompt") for v in variants)


def report_content_status(assessment: dict) -> dict[str, Any]:
    """Latest-only completeness flags for generated report text (no protocolData)."""
    return {
        "aiNarrative": _has_ai_narrative(assessment),
        "featureNarratives": _has_feature_narratives(assessment),
        "protocolNarrative": _has_protocol_narrative(assessment),
        "aiVisuals": _has_ai_visuals(assessment),
        "checkedAt": _utcnow_iso(),
    }
