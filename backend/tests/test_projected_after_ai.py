"""Tests for the generative projected AFTER module (no network)."""

from __future__ import annotations

import os

from backend.projected_after_ai import (
    _focus_features,
    build_projected_after_prompt,
    projected_after_enabled,
    projection_strengths,
)


def test_projected_after_enabled_flag():
    old = os.environ.pop("PROJECTED_AFTER_ENABLED", None)
    try:
        assert projected_after_enabled() is False
        os.environ["PROJECTED_AFTER_ENABLED"] = "true"
        assert projected_after_enabled() is True
    finally:
        if old is None:
            os.environ.pop("PROJECTED_AFTER_ENABLED", None)
        else:
            os.environ["PROJECTED_AFTER_ENABLED"] = old


def test_projection_strengths_from_cv_report():
    strengths = projection_strengths(
        {"hair": {"score": 70}, "skin": {"score": 80}, "eyes": {"score": 75}},
        {"anthropometrics": {"deviations": {"symmetry": 12, "nose": 8}}},
    )
    assert 0.12 <= strengths["full"] <= 0.22
    assert strengths["hair"] >= strengths["skin"]


def test_focus_features_ranks_weakest_first():
    # Lower score → higher projection strength → higher priority.
    cv = {"hair": {"score": 55}, "skin": {"score": 90}, "eyes": {"score": 70}}
    focus = _focus_features(cv, None, top_n=2)
    assert focus[0] == "hair"
    assert "skin" not in focus  # strongest feature drops off the top-2


def test_build_prompt_is_identity_preserving_and_targets_weakness():
    cv = {"hair": {"score": 55}, "skin": {"score": 65}}
    prompt = build_projected_after_prompt(
        {"goals": "clearer skin", "age": 29},
        cv,
        {"anthropometrics": {"deviations": {"symmetry": 10}}},
    )
    lowered = prompt.lower()
    # Identity / measurement preservation guardrails.
    assert "same person" in lowered
    assert "do not reshape" in lowered
    assert "proportions" in lowered
    # No clinical / surgical imagery.
    assert "surgical" in lowered
    # Targets a flagged-weak feature.
    assert "skin" in lowered or "hair" in lowered
    # No text/watermark artifacts requested.
    assert "watermark" in lowered


def test_build_prompt_handles_empty_inputs():
    prompt = build_projected_after_prompt(None, None, None)
    assert isinstance(prompt, str) and len(prompt) > 50
    assert "same person" in prompt.lower()


if __name__ == "__main__":
    test_projected_after_enabled_flag()
    test_projection_strengths_from_cv_report()
    test_focus_features_ranks_weakest_first()
    test_build_prompt_is_identity_preserving_and_targets_weakness()
    test_build_prompt_handles_empty_inputs()
    print("all projected_after_ai tests passed")
