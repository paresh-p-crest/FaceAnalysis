"""Tests for narrative JSON schemas and Pydantic validation."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.narrative_schemas import (
    FEATURE_SUBSECTION_TITLES,
    FeatureNarrative,
    TreatmentPhases,
    feature_narrative_json_schema,
    subsection_body_limits,
    treatment_phases_json_schema,
)


def _sample_subsections(feature_id: str):
    return [
        {
            "title": title,
            "body": (
                "Based on stored measurements, maintain gentle non-surgical habits including "
                "daily SPF, sleep, and hydration. Discuss persistent concerns with a qualified clinician."
            ),
        }
        for title in FEATURE_SUBSECTION_TITLES[feature_id]
    ]


def test_feature_narrative_validates_eyes_subsections():
    narrative = FeatureNarrative(
        featureId="eyes",
        summary="Periorbital guidance grounded in measured tilt and sclera appearance.",
        subsections=_sample_subsections("eyes"),
    )
    assert len(narrative.subsections) == 4
    assert all(s.evidenceTier == "otc" for s in narrative.subsections)


def test_feature_narrative_rejects_wrong_subsection_title():
    subs = _sample_subsections("nose")
    subs[0]["title"] = "Wrong Title"
    with pytest.raises(ValueError):
        FeatureNarrative(
            featureId="nose",
            summary="Nasal proportions summary for protocol page.",
            subsections=subs,
        )


def test_json_schema_eyes_has_four_subsections():
    schema = feature_narrative_json_schema("eyes")
    subs = schema["properties"]["subsections"]
    assert subs["minItems"] == 4
    assert subs["maxItems"] == 4
    assert set(schema["required"]) == {"featureId", "summary", "subsections"}


def test_hair_subsection_body_limits():
    assert subsection_body_limits("hair", "Hair Style") == (80, 2000)
    assert subsection_body_limits("hair", "Hair Health") == (80, 1000)
    assert subsection_body_limits("skin", "Skincare Protocol") == (80, 2000)
    assert subsection_body_limits("skin", "Further Skin Enhancement") == (80, 1000)
    assert subsection_body_limits("jaw", "Further Enhancement") == (80, 1500)
    assert subsection_body_limits("eyes", "Eyebrows") == (80, 2000)
    assert subsection_body_limits("eyes", "Under eye") == (80, 2000)
    assert subsection_body_limits("neck", "Neck Skin") == (80, 2000)
    assert subsection_body_limits("ears", "Ear Structure") == (80, 2000)


def test_every_feature_title_has_explicit_limits():
    from backend.narrative_schemas import FEATURE_SUBSECTION_BODY_LIMITS

    for feature_id, titles in FEATURE_SUBSECTION_TITLES.items():
        assert feature_id in FEATURE_SUBSECTION_BODY_LIMITS
        for title in titles:
            assert title in FEATURE_SUBSECTION_BODY_LIMITS[feature_id]
            lo, hi = subsection_body_limits(feature_id, title)
            assert lo == 80 and hi in (1000, 1500, 2000)


def test_hair_narrative_rejects_overlong_health_body():
    from pydantic import ValidationError

    subs = _sample_subsections("hair")
    # Over Hair Health max (1000) but under FeatureSubsection shared ceiling (2000).
    subs[2]["body"] = "x" * 1001
    assert len(subs[2]["body"]) > 1000
    with pytest.raises(ValidationError):
        FeatureNarrative(
            featureId="hair",
            summary="Hair priorities focused on framing and scalp care for 30 days.",
            subsections=subs,
        )


def test_treatment_phases_schema_and_validation():
    schema = treatment_phases_json_schema()
    assert set(schema["required"]) == {"phase01", "phase02", "phase03", "summary"}
    sample = {
        "phase01": {
            "title": "Foundation & Photoprotection",
            "duration": "Immediate · Weeks 1–12",
            "items": [
                {"name": "Broad-spectrum SPF 50+", "detail": "Daily · UV photoprotection"},
                {"name": "Niacinamide 10%", "detail": "Morning · sebum regulation"},
            ],
        },
        "phase02": {
            "title": "Barrier Reinforcement",
            "duration": "Weeks 12–24 · maintenance cycle",
            "items": [
                {"name": "Antioxidant serum", "detail": "Morning · oxidative stress"},
                {"name": "Ceramide emollient", "detail": "Evening · barrier repair"},
            ],
        },
        "phase03": {
            "title": "Long-Term Support",
            "duration": "6+ months · sustained regimen",
            "items": [
                {"name": "Retinoid rotation", "detail": "Cycled evenings"},
                {"name": "Collagen nutrition", "detail": "Daily micronutrients"},
            ],
        },
        "summary": (
            "Harmonic indices indicate a favorable baseline with localized refinement in periorbital "
            "and mandibular zones; staged OTC topical protocol emphasises photoprotection first."
        ),
    }
    validated = TreatmentPhases.model_validate(sample)
    assert validated.phase01.items[0].name.startswith("Broad-spectrum")


def test_parse_treatment_phases_normalizes():
    from backend.narrative_orchestrator import _parse_treatment_phases

    raw = {
        "phase01": {
            "title": "Foundation",
            "duration": "Weeks 1-12",
            "items": [
                {"name": "SPF 50+", "detail": "Daily photoprotection"},
                {"name": "Niacinamide", "detail": "Morning serum"},
            ],
        },
        "phase02": {
            "title": "Barrier",
            "duration": "Weeks 12-24",
            "items": [
                {"name": "Ceramide cream", "detail": "Evening barrier"},
                {"name": "Antioxidant", "detail": "Morning defense"},
            ],
        },
        "phase03": {
            "title": "Maintenance",
            "duration": "6+ months",
            "items": [
                {"name": "Retinoid cycle", "detail": "Evenings only"},
                {"name": "Hydration", "detail": "Daily moisture"},
            ],
        },
        "summary": "Staged non-surgical plan grounded in measured priority regions and baseline harmony.",
    }
    parsed = _parse_treatment_phases(raw)
    assert parsed["phase01"]["items"][0]["name"] == "SPF 50+"
    assert len(parsed["summary"]) >= 40
