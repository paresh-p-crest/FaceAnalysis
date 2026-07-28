"""Provenance (origin) helpers for EN/DE narrative blocks."""

from __future__ import annotations

from typing import Literal, Optional

from .clinical_guardrails import is_template_feature_narrative

NarrativeOrigin = Literal["llm", "template", "stitch", "admin"]
VALID_ORIGINS = frozenset({"llm", "template", "stitch", "admin"})


def should_llm_translate_en(origin: Optional[str]) -> bool:
    return origin == "llm"


def stamp_origin(data: dict, origin: NarrativeOrigin) -> dict:
    if not isinstance(data, dict):
        return data
    out = dict(data)
    out["origin"] = origin
    return out


def resolve_feature_origin(narrative: Optional[dict]) -> str:
    if not isinstance(narrative, dict):
        return "template"
    origin = narrative.get("origin")
    if origin in VALID_ORIGINS:
        return str(origin)
    return "template" if is_template_feature_narrative(narrative) else "llm"


def feature_origin_llm(narrative: Optional[dict]) -> bool:
    return resolve_feature_origin(narrative) == "llm"
