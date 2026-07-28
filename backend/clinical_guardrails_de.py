"""Hardcoded German feature narrative templates (mirror EN guardrail fallbacks)."""

from __future__ import annotations

from .clinical_guardrails import (
    FEATURE_DISPLAY,
    _facts_phrase,
    _rewrite_narrative_dict,
)
from .narrative_schemas import FEATURE_SUBSECTION_TITLES, FeatureNarrative


def _template_summary_de(feature_id: str, ctx: dict) -> str:
    facts = _facts_phrase(ctx, 100)
    label = FEATURE_DISPLAY.get(feature_id, feature_id)
    return (
        f"Priorisiere deine {label}-Befunde ({facts}). "
        "Konzentriere dich 30 Tage auf Pflege, topische Basisversorgung, SPF, Schlaf und Flüssigkeit, bevor du neu bewertest."
    )


def _template_subsection_body_de(feature_id: str, title: str, ctx: dict) -> str:
    facts = _facts_phrase(ctx, 80)
    label = FEATURE_DISPLAY.get(feature_id, feature_id)
    return (
        f"Deine {label}-Analyse ({title}) zeigt {facts}. "
        "Bleib bei konservativen, nicht-invasiven Gewohnheiten. "
        "Wiederhole die Messung nach 30 Tagen bei gleichbleibendem Licht."
    )


def template_feature_narrative_de(feature_id: str, ctx: dict) -> dict:
    titles = FEATURE_SUBSECTION_TITLES[feature_id]
    subsections = []
    for title in titles:
        body = _template_subsection_body_de(feature_id, title, ctx)
        if len(body) < 120:
            body += (
                " Nutze täglich SPF, ausreichend Schlaf und Flüssigkeit als Basis für deine Gesichtsgesundheit."
            )
        subsections.append(
            {
                "title": title,
                "body": body,
                "evidenceTier": "lifestyle" if "dermatolog" in body.lower() else "otc",
            }
        )
    data = FeatureNarrative(
        featureId=feature_id,
        measuredFacts=ctx.get("measuredFacts") or [],
        limitations=ctx.get("limitations") or [],
        summary=_template_summary_de(feature_id, ctx),
        description="",
        subsections=subsections,
        recommendations=[
            "Täglich breitbandigen SPF 50 im Freien.",
            "Regelmäßiger Schlaf und ausreichend Flüssigkeit.",
            "Nach 30 Tagen bei gleichbleibendem Licht neu bewerten.",
        ],
    ).model_dump()
    data["origin"] = "template"
    return _rewrite_narrative_dict(data)
