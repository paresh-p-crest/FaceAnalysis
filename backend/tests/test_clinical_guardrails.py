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


def test_soft_clinical_fail_keeps_llm_copy():
    """Ungrounded score fails strict validation but still usable for PDF (not templated)."""
    from backend.clinical_guardrails import try_validate_feature_narrative

    ctx = _ctx()
    raw = {
        "featureId": "skin",
        "measuredFacts": ctx["measuredFacts"],
        "limitations": ctx["limitations"],
        "summary": "Skin clarity needs attention based on measured tone and texture.",
        "description": "Photographic cues show uneven tone with textured surface on analysis.",
        "subsections": [
            {
                "title": "Skincare Protocol",
                "body": (
                    "The subject's skin quality shows score 91/100 with textured surface. "
                    "Daily SPF and gentle cleansing support barrier repair over 30 days. "
                    + "x" * 40
                ),
                "evidenceTier": "otc",
            },
            {
                "title": "Further Skin Enhancement",
                "body": (
                    "Keep routines conservative and reassess under consistent lighting. " + "y" * 80
                ),
                "evidenceTier": "lifestyle",
            },
        ],
        "recommendations": ["Daily SPF 50."],
    }
    parsed = FeatureNarrative.model_validate(raw)
    ok, errs = validate_feature_narrative(parsed, ctx)
    assert not ok
    assert any("Numeric claim" in e or "evidenceTier" in e for e in errs)

    kept, usable = try_validate_feature_narrative(raw, "skin", ctx)
    assert usable and kept
    assert "91/100" in kept["subsections"][0]["body"]
    assert "botox" not in str(kept).lower()


def test_banned_term_hard_rejects_llm_copy():
    from backend.clinical_guardrails import try_validate_feature_narrative

    ctx = _ctx()
    raw = {
        "featureId": "skin",
        "measuredFacts": ctx["measuredFacts"],
        "limitations": ctx["limitations"],
        "summary": "Skin maintenance summary based on measured redness and texture.",
        "description": "Photographic cues show dryness with elevated redness.",
        "subsections": [
            {
                "title": "Skincare Protocol",
                "body": "Consider Botox and laser for improvement. " + "x" * 80,
                "evidenceTier": "otc",
            },
            {
                "title": "Further Skin Enhancement",
                "body": "Maintain SPF and gentle cleansing while monitoring redness. " + "y" * 80,
                "evidenceTier": "lifestyle",
            },
        ],
        "recommendations": [],
    }
    kept, usable = try_validate_feature_narrative(raw, "skin", ctx)
    assert not usable and kept is None


def test_normalize_free_model_feature_alias_and_string_lists():
    from backend.clinical_guardrails import (
        is_template_feature_narrative,
        normalize_feature_narrative_raw,
        try_validate_feature_narrative,
    )

    ctx = _ctx()
    raw = {
        "feature": "skin",
        "measuredFacts": "score 72/100",
        "limitations": "2D photograph analysis only.",
        "summary": "Skin clarity needs attention based on measured tone and texture.",
        "description": "Photographic cues show uneven tone with textured surface on analysis.",
        "subsections": {
            "Skincare Protocol": {
                "description": (
                    "The subject's skin quality shows textured surface with elevated redness. "
                    "Daily SPF and gentle cleansing support barrier repair over 30 days. "
                    + "x" * 40
                ),
                "evidenceTier": "otc",
            },
            "Further Skin Enhancement": {
                "body": (
                    "Keep routines conservative and reassess under consistent lighting. " + "y" * 80
                ),
                "evidenceTier": "lifestyle",
            },
        },
        "recommendations": "Daily SPF 50.",
    }
    normalized = normalize_feature_narrative_raw(raw, "skin", ctx)
    assert normalized["featureId"] == "skin"
    assert normalized["measuredFacts"] == ["score 72/100"]
    assert isinstance(normalized["subsections"], list)
    assert normalized["subsections"][0]["title"] == "Skincare Protocol"
    assert "body" in normalized["subsections"][0]

    kept, usable = try_validate_feature_narrative(raw, "skin", ctx)
    assert usable and kept
    assert not is_template_feature_narrative(kept)


def test_normalize_unwraps_nested_feature_object_and_truncates_body():
    from backend.clinical_guardrails import normalize_feature_narrative_raw, try_validate_feature_narrative
    from backend.feature_context import build_feature_context

    cv = {"nose": {"score": 75, "widthLengthRatio": 1.5}}
    ctx = build_feature_context("nose", cv_report=cv, answers={})
    long_body = "The subject's nasal proportions are balanced on photographic analysis. " + ("word " * 200)
    raw = {
        "Nose": {
            "summary": "Nasal proportions are balanced on measured width and angle.",
            "description": "Frontal and profile cues support a conservative non-surgical plan.",
            "measuredFacts": ctx["measuredFacts"],
            "limitations": ctx["limitations"],
            "subsections": [
                {
                    "title": "Wrong Title",
                    "body": long_body,
                    "evidenceTier": "otc",
                }
            ],
            "recommendations": [],
        }
    }
    normalized = normalize_feature_narrative_raw(raw, "nose", ctx)
    assert normalized["featureId"] == "nose"
    assert normalized["subsections"][0]["title"] == "Nose"
    assert len(normalized["subsections"][0]["body"]) <= 700

    kept, usable = try_validate_feature_narrative(raw, "nose", ctx)
    assert usable and kept


def test_is_template_feature_narrative_detects_guardrail_copy():
    from backend.clinical_guardrails import is_template_feature_narrative

    ctx = _ctx()
    tpl = template_feature_narrative("skin", ctx)
    assert is_template_feature_narrative(tpl)
    assert not is_template_feature_narrative(
        {"summary": "Skin clarity needs attention based on measured tone and texture."}
    )
