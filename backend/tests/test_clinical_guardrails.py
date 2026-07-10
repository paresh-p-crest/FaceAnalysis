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
    assert tpl["featureId"] == "skin"
