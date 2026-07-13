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
