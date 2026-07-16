"""Tests for the generative projected AFTER module (no network)."""

from __future__ import annotations

import os

from backend.projected_after_ai import (
    PROJECTED_AFTER_PROMPT,
    build_projected_after_prompt,
    projected_after_enabled,
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


def test_build_prompt_returns_constant():
    cv = {
        "hair": {"score": 55, "textureType": "Straight"},
        "skin": {"score": 65, "rednessIndex": 24.9},
        "jaw": {"jawWidthClass": "Wide"},
    }
    assert build_projected_after_prompt(
        {"goals": "clearer skin", "growBeard": "yes"},
        cv,
        {"anthropometrics": {"deviations": {"symmetry": 10}}},
    ) == PROJECTED_AFTER_PROMPT
    assert build_projected_after_prompt(None, None, None) == PROJECTED_AFTER_PROMPT


def test_prompt_best_groomed_invariants():
    lowered = PROJECTED_AFTER_PROMPT.lower()
    assert "visible improvement" in lowered
    assert "pores" in lowered
    assert "not airbrushed" in lowered
    assert "change length and style" in lowered
    assert "full beard, stubble, or clean-shaven" in lowered
    assert "same face shape" in lowered
    assert "same person" in lowered


def test_prompt_excludes_legacy_patterns():
    lowered = PROJECTED_AFTER_PROMPT.lower()
    assert "client:" not in lowered
    assert "context:" not in lowered
    assert "projection_strengths" not in lowered
    assert "jawline without changing" not in lowered
    assert "apply only natural" not in lowered


if __name__ == "__main__":
    test_projected_after_enabled_flag()
    test_build_prompt_returns_constant()
    test_prompt_best_groomed_invariants()
    test_prompt_excludes_legacy_patterns()
    print("all projected_after_ai tests passed")
