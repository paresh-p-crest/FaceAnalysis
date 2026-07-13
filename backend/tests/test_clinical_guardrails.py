"""Tests for clinical guardrails on feature narratives."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.clinical_guardrails import (
    is_template_feature_narrative,
    normalize_feature_narrative_raw,
    strip_score_language,
    template_feature_narrative,
    try_validate_feature_narrative,
    validate_feature_narrative,
)
from backend.feature_context import build_feature_context
from backend.narrative_schemas import FeatureNarrative, feature_narrative_json_schema


def _ctx():
    cv = {
        "skin": {"score": 72, "redness": "Elevated", "texture": "Dry", "skinTone": "Medium"},
    }
    return build_feature_context("skin", cv_report=cv, answers={"skinType": "sensitive"})


def _qual_body(prefix: str) -> str:
    return (
        f"{prefix} Daily SPF and gentle cleansing support barrier repair over 30 days "
        "while monitoring redness under consistent lighting conditions for the subject. "
        + "x" * 20
    )


def test_banned_term_fails_validation():
    ctx = _ctx()
    narrative = FeatureNarrative(
        featureId="skin",
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx["limitations"],
        summary="Skin maintenance summary based on measured redness and texture.",
        description="Skin metrics indicate dryness with elevated redness on photographic analysis.",
        subsections=[
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
        recommendations=[],
    )
    ok, errors = validate_feature_narrative(narrative, ctx)
    assert not ok
    assert errors


def test_template_fallback_has_no_banned_terms_or_scores():
    ctx = _ctx()
    tpl = template_feature_narrative("skin", ctx)
    prose = " ".join(
        [tpl["summary"], tpl.get("description") or ""]
        + [s["body"] for s in tpl["subsections"]]
    ).lower()
    assert "botox" not in prose
    assert "laser" not in prose
    assert "/100" not in prose
    assert "the current score is" not in prose
    assert "the subject" in prose
    assert tpl["featureId"] == "skin"
    assert is_template_feature_narrative(tpl)


def test_non_surgical_phrase_is_allowed():
    ctx = _ctx()
    narrative = FeatureNarrative(
        featureId="skin",
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx["limitations"],
        summary="Conservative non-surgical skin care based on measured redness and texture.",
        description="Photographic cues show dryness with elevated redness on analysis.",
        subsections=[
            {
                "title": "Skincare Protocol",
                "body": _qual_body(
                    "Use gentle non-surgical cleansing and niacinamide while monitoring redness under SPF."
                ),
                "evidenceTier": "lifestyle",
            },
            {
                "title": "Further Skin Enhancement",
                "body": _qual_body("Maintain SPF and gentle cleansing while monitoring redness."),
                "evidenceTier": "lifestyle",
            },
        ],
        recommendations=["Daily SPF 50."],
    )
    ok, errors = validate_feature_narrative(narrative, ctx)
    assert ok, errors


def test_score_language_hard_rejects_before_strip_path():
    ctx = _ctx()
    narrative = FeatureNarrative(
        featureId="skin",
        measuredFacts=ctx["measuredFacts"],
        limitations=ctx["limitations"],
        summary="Skin clarity needs attention based on measured tone and texture.",
        description="Photographic cues show uneven tone with textured surface on analysis.",
        subsections=[
            {
                "title": "Skincare Protocol",
                "body": _qual_body("The subject's skin quality shows score 91/100 with textured surface."),
                "evidenceTier": "otc",
            },
            {
                "title": "Further Skin Enhancement",
                "body": _qual_body("Keep routines conservative and reassess under consistent lighting."),
                "evidenceTier": "lifestyle",
            },
        ],
        recommendations=["Daily SPF 50."],
    )
    ok, errs = validate_feature_narrative(narrative, ctx)
    assert not ok
    assert any("Banned score" in e for e in errs)


def test_slim_llm_payload_hydrates_and_strips_scores():
    ctx = _ctx()
    raw = {
        "featureId": "skin",
        "summary": "Skin clarity needs attention based on measured tone and texture.",
        "subsections": [
            {
                "title": "Skincare Protocol",
                "body": _qual_body(
                    "The subject's skin quality shows score 72/100 with textured surface."
                ),
            },
            {
                "title": "Further Skin Enhancement",
                "body": _qual_body("Keep routines conservative and reassess under consistent lighting."),
            },
        ],
    }
    kept, usable = try_validate_feature_narrative(raw, "skin", ctx)
    assert usable and kept
    assert kept["measuredFacts"]
    assert "/100" not in kept["subsections"][0]["body"]
    assert "score 72" not in kept["subsections"][0]["body"].lower()


def test_banned_term_hard_rejects_llm_copy():
    ctx = _ctx()
    raw = {
        "featureId": "skin",
        "summary": "Skin maintenance summary based on measured redness and texture.",
        "subsections": [
            {
                "title": "Skincare Protocol",
                "body": "Consider Botox and laser for improvement. " + "x" * 80,
            },
            {
                "title": "Further Skin Enhancement",
                "body": "Maintain SPF and gentle cleansing while monitoring redness. " + "y" * 80,
            },
        ],
    }
    kept, usable = try_validate_feature_narrative(raw, "skin", ctx)
    assert not usable and kept is None


def test_normalize_free_model_feature_alias():
    ctx = _ctx()
    raw = {
        "feature": "skin",
        "summary": "Skin clarity needs attention based on measured tone and texture.",
        "subsections": {
            "Skincare Protocol": {
                "description": _qual_body(
                    "The subject's skin quality shows textured surface with elevated redness."
                ),
            },
            "Further Skin Enhancement": {
                "body": _qual_body("Keep routines conservative and reassess under consistent lighting."),
            },
        },
    }
    normalized = normalize_feature_narrative_raw(raw, "skin", ctx)
    assert normalized["featureId"] == "skin"
    assert isinstance(normalized["subsections"], list)
    kept, usable = try_validate_feature_narrative(raw, "skin", ctx)
    assert usable and kept
    assert not is_template_feature_narrative(kept)


def test_json_schema_is_slim_summary_and_subsections_only():
    schema = feature_narrative_json_schema("eyes")
    props = schema["properties"]
    assert set(props.keys()) == {"featureId", "summary", "subsections"}
    assert "measuredFacts" not in props
    assert "body" in props["subsections"]["items"]["properties"]
    assert "evidenceTier" not in props["subsections"]["items"]["properties"]


def test_strip_score_language():
    assert "/100" not in strip_score_language("Overall harmony score 77/100 looks balanced.")
    assert "score 12" not in strip_score_language("The score 12 is noted.").lower()
