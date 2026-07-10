"""Tests for narrative JSON schemas and Pydantic validation."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.narrative_schemas import (
    FEATURE_SUBSECTION_TITLES,
    FeatureNarrative,
    feature_narrative_json_schema,
)


def _sample_subsections(feature_id: str):
    return [
        {
            "title": title,
            "body": (
                "Based on your stored measurements, maintain gentle non-surgical habits including "
                "daily SPF, sleep, and hydration. Discuss persistent concerns with a qualified clinician."
            ),
            "evidenceTier": "otc",
        }
        for title in FEATURE_SUBSECTION_TITLES[feature_id]
    ]


def test_feature_narrative_validates_eyes_subsections():
    narrative = FeatureNarrative(
        featureId="eyes",
        measuredFacts=["scleraColor: Natural White", "eyeTilt: Neutral"],
        limitations=["2D photo only"],
        summary="Periorbital guidance grounded in measured tilt and sclera appearance.",
        description="Your eye metrics reflect stored periorbital analysis without iris colour measurement.",
        subsections=_sample_subsections("eyes"),
        recommendations=["Daily SPF around eyes"],
    )
    assert len(narrative.subsections) == 4


def test_feature_narrative_rejects_wrong_subsection_title():
    subs = _sample_subsections("nose")
    subs[0]["title"] = "Wrong Title"
    with pytest.raises(ValueError):
        FeatureNarrative(
            featureId="nose",
            measuredFacts=["score 74/100"],
            limitations=[],
            summary="Nasal proportions summary for protocol page.",
            description="Nasal width and length ratios inform conservative framing guidance only.",
            subsections=subs,
            recommendations=[],
        )


def test_json_schema_eyes_has_four_subsections():
    schema = feature_narrative_json_schema("eyes")
    subs = schema["properties"]["subsections"]
    assert subs["minItems"] == 4
    assert subs["maxItems"] == 4
