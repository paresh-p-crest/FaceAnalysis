"""Tests for clinical guardrails on feature narratives."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.clinical_guardrails import validate_feature_narrative, template_feature_narrative
from backend.feature_context import build_feature_context
from backend.narrative_schemas import FeatureNarrative


def _ctx():
    cv = {
        "skin": {"score": 72, "redness": "Elevated", "texture": "Dry", "skinTone": "Medium"},
    }
    return build_feature_context("skin", cv_report=cv, answers={"skinType": "sensitive"})


def test_banned_term_fails_validation():
    ctx = _ctx()
    narrative = FeatureNarrative(
        featureId="skin",
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx["limitations"],
        summary="Skin maintenance summary based on measured redness and texture.",
        description="Your skin metrics indicate dryness with elevated redness on photographic analysis.",
        subsections=[
            {
                "title": "Skincare Protocol",
                "body": (
                    "Consider Botox and laser for improvement. " + "x" * 80
                ),
                "evidenceTier": "otc",
            },
            {
                "title": "Further Skin Enhancement",
                "body": (
                    "Maintain SPF and gentle cleansing while monitoring redness. " + "y" * 80
                ),
                "evidenceTier": "lifestyle",
            },
        ],
        recommendations=[],
    )
    ok, errors = validate_feature_narrative(narrative, ctx)
    assert not ok
    assert errors


def test_template_fallback_has_no_banned_terms():
    ctx = _ctx()
    tpl = template_feature_narrative("skin", ctx)
    blob = str(tpl).lower()
    assert "botox" not in blob
    assert "laser" not in blob
    assert "mediapipe" not in blob
    assert "opencv" not in blob
    assert "computer-vision" not in blob
    assert "computer vision" not in blob
    assert "assessment of the" not in blob
    assert "the client" not in blob
    assert "the subject" in blob
    assert tpl["featureId"] == "skin"
    assert "non-surgical guidance for skin based on stored measurements" not in tpl["summary"].lower()
    assert "your" not in tpl["summary"].lower()
    assert "your" not in tpl["description"].lower()
    assert len(tpl["summary"]) > 40
    for sub in tpl["subsections"]:
        assert "your" not in sub["body"].lower()
        assert "the subject" in sub["body"].lower()


def test_non_surgical_phrase_is_allowed():
    ctx = _ctx()
    narrative = FeatureNarrative(
        featureId="skin",
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx["limitations"],
        summary="Conservative non-surgical skin care based on measured redness and texture.",
        description="Your skin metrics indicate dryness with elevated redness on photographic analysis.",
        subsections=[
            {
                "title": "Skincare Protocol",
                "body": (
                    "Use gentle non-surgical cleansing and niacinamide while monitoring redness under SPF. "
                    + "x" * 80
                ),
                "evidenceTier": "lifestyle",
            },
            {
                "title": "Further Skin Enhancement",
                "body": (
                    "Maintain SPF and gentle cleansing while monitoring redness. " + "y" * 80
                ),
                "evidenceTier": "lifestyle",
            },
        ],
        recommendations=["Daily SPF 50."],
    )
    ok, errors = validate_feature_narrative(narrative, ctx)
    assert ok, errors
    assert not any("banned" in e.lower() for e in errors)
