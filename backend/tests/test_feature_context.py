"""Tests for per-feature context builder."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.feature_context import build_feature_context, build_measured_facts


def test_eyes_not_measured_iris():
    ctx = build_feature_context(
        "eyes",
        cv_report={},
        eye_analysis={"metrics": {"scleraColor": "Natural White", "eyeTilt": "Neutral"}},
        answers={},
    )
    assert any("Iris" in item or "iris" in item for item in ctx["notMeasured"])


def test_hair_estimated_without_top_head():
    ctx = build_feature_context(
        "hair",
        cv_report={"hair": {"score": 70, "dataSource": "estimated", "densityEstimate": "Moderate"}},
        answers={},
    )
    assert ctx["measuredFacts"]
    assert any("top-of-head" in lim.lower() or "estimated" in lim.lower() for lim in ctx["limitations"])
