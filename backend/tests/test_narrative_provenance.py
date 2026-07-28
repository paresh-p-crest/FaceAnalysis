"""Tests for narrative origin helpers."""

from backend.clinical_guardrails import template_feature_narrative
from backend.feature_context import build_feature_context
from backend.narrative_provenance import (
    resolve_feature_origin,
    should_llm_translate_en,
    stamp_origin,
)


def test_should_llm_translate_en_only_llm():
    assert should_llm_translate_en("llm") is True
    assert should_llm_translate_en("template") is False
    assert should_llm_translate_en("stitch") is False


def test_resolve_feature_origin_stamped():
    assert resolve_feature_origin({"origin": "llm", "summary": "x"}) == "llm"
    assert resolve_feature_origin({"origin": "template", "summary": "x"}) == "template"


def test_resolve_feature_origin_legacy_template():
    ctx = build_feature_context("skin", cv_report={"skin": {"score": 80}}, eye_analysis=None, answers={})
    tpl = template_feature_narrative("skin", ctx)
    assert resolve_feature_origin(tpl) == "template"


def test_stamp_origin():
    out = stamp_origin({"summary": "a"}, "llm")
    assert out["origin"] == "llm"
