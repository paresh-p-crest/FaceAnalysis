"""Tests for pipeline ai_visuals stage."""

import asyncio

from backend.pipeline_stages import run_ai_visuals_stage


def test_run_ai_visuals_skips_when_after_not_ready():
    assessment = {"id": "skip-after-pending", "projectedAfter": {"status": "pending"}}
    result = asyncio.run(run_ai_visuals_stage(assessment))
    assert result is assessment


def test_run_ai_visuals_skips_when_after_skipped():
    assessment = {"id": "skip-after-off", "projectedAfter": {"status": "skipped"}}
    result = asyncio.run(run_ai_visuals_stage(assessment))
    assert result is assessment
