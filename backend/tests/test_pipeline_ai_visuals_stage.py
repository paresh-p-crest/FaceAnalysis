"""Tests for pipeline ai_visuals stage."""

import asyncio
from unittest.mock import AsyncMock, patch

from backend.media_storage import assessment_key, get_media_storage
from backend.pipeline_stages import run_ai_visuals_stage


def test_run_ai_visuals_skips_when_front_missing(monkeypatch):
    assessment = {
        "id": "skip-no-front",
        "analysis": {"cvReport": {"faceShape": {"shape": "Oval"}}},
        "projectedAfter": {"status": "pending"},
    }

    async def _fake_get(aid):
        return assessment

    monkeypatch.setattr("backend.pipeline_stages.get_assessment_by_id", _fake_get)
    result = asyncio.run(run_ai_visuals_stage(assessment))
    assert result is assessment


def test_run_ai_visuals_runs_without_projected_after_ready(monkeypatch):
    assessment_id = "viz-front-only"
    get_media_storage().put_bytes(
        assessment_key(assessment_id, "front.jpg"),
        b"\xff\xd8\xff" + b"0" * 200 + b"\xff\xd9",
    )
    assessment = {
        "id": assessment_id,
        "answers": {},
        "photos": {},
        "analysis": {"cvReport": {"faceShape": {"shape": "Oval"}}, "metrics": {}},
        "projectedAfter": {"status": "pending"},
    }

    async def _fake_get(aid):
        return assessment if aid == assessment_id else None

    called = {}

    async def _fake_generate(**kwargs):
        called["kwargs"] = kwargs
        return {"source": "openai", "variants": [], "sourceKind": "assessment_front_file"}

    monkeypatch.setattr("backend.pipeline_stages.get_assessment_by_id", _fake_get)
    monkeypatch.setattr(
        "backend.pipeline_stages.update_assessment_ai_visuals",
        AsyncMock(return_value=assessment),
    )
    with patch(
        "backend.visual_generation.generate_visual_variants",
        new=AsyncMock(side_effect=_fake_generate),
    ):
        result = asyncio.run(run_ai_visuals_stage(assessment))
    assert result is not None
    assert called["kwargs"].get("require_projected_after") is False
