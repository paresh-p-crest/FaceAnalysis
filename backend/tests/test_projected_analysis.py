"""Tests for projected AFTER CV analysis → projected_analysis column."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

from backend.projected_analysis_status import (
    merge_projected_analysis_update,
    new_projected_analysis_pending,
)
from backend.pipeline_stages import run_projected_analysis_now


def test_new_projected_analysis_pending():
    pa = new_projected_analysis_pending()
    assert pa["status"] == "pending"
    assert pa["source"] == "projected_full"
    assert pa["cvReport"] is None
    assert pa["error"] is None


def test_merge_projected_analysis_update():
    base = new_projected_analysis_pending()
    merged = merge_projected_analysis_update(base, status="ready", cvReport={"skin": {"score": 80}})
    assert merged["status"] == "ready"
    assert merged["cvReport"]["skin"]["score"] == 80
    assert merged["source"] == "projected_full"
    assert "updatedAt" in merged


def test_run_projected_analysis_now_writes_ready_and_leaves_analysis_untouched():
    assessment_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    before_analysis = {"cvReport": {"skin": {"score": 70}}, "landmarks": [{"id": 0, "x": 0.1, "y": 0.2}]}
    stored_updates = []

    async def fake_get(aid):
        return {
            "id": aid,
            "answers": {},
            "analysis": before_analysis,
            "projectedAfter": {
                "status": "ready",
                "full": {"relativePath": f"uploads/assessments/{aid}/projected/full.jpg"},
            },
            "projectedAnalysis": stored_updates[-1] if stored_updates else None,
        }

    async def fake_update_pa(aid, payload):
        stored_updates.append(dict(payload))
        return await fake_get(aid)

    async def fake_update_analysis(*_args, **_kwargs):
        raise AssertionError("BEFORE analysis must not be updated")

    with (
        patch("backend.pipeline_stages.get_assessment_by_id", side_effect=fake_get),
        patch("backend.pipeline_stages.update_assessment_projected_analysis", side_effect=fake_update_pa),
        patch("backend.pipeline_stages.update_assessment_analysis", side_effect=fake_update_analysis),
        patch("backend.pipeline_stages.load_projected_full", return_value=b"\xff\xd8fakejpeg"),
        patch(
            "backend.pipeline_stages.run_face_analysis",
            return_value={
                "success": True,
                "cvReport": {"skin": {"score": 88}},
                "landmarks": [{"id": 1, "x": 0.5, "y": 0.5}],
                "metrics": {"overall": 85},
                "eyeAnalysis": {"score": 80},
            },
        ),
    ):
        result = asyncio.run(run_projected_analysis_now({"id": assessment_id}))

    assert any(u.get("status") == "running" for u in stored_updates)
    ready = stored_updates[-1]
    assert ready["status"] == "ready"
    assert ready["cvReport"]["skin"]["score"] == 88
    assert ready["metrics"]["overall"] == 85
    assert ready["error"] is None
    # BEFORE analysis from get remains unchanged
    assert result["analysis"] is before_analysis
    assert result["analysis"]["cvReport"]["skin"]["score"] == 70


def test_run_projected_analysis_now_skips_when_projected_after_not_ready():
    assessment_id = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"
    stored = []

    async def fake_get(aid):
        return {
            "id": aid,
            "answers": {},
            "analysis": {"cvReport": {"ok": True}},
            "projectedAfter": {"status": "skipped"},
            "projectedAnalysis": stored[-1] if stored else None,
        }

    async def fake_update(aid, payload):
        stored.append(dict(payload))
        return await fake_get(aid)

    with (
        patch("backend.pipeline_stages.get_assessment_by_id", side_effect=fake_get),
        patch("backend.pipeline_stages.update_assessment_projected_analysis", side_effect=fake_update),
        patch("backend.pipeline_stages.run_face_analysis") as mock_cv,
    ):
        asyncio.run(run_projected_analysis_now({"id": assessment_id}))
        mock_cv.assert_not_called()

    assert stored[-1]["status"] == "skipped"


def test_run_projected_analysis_now_fails_soft_when_cv_fails():
    assessment_id = "cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee"
    stored = []

    async def fake_get(aid):
        return {
            "id": aid,
            "answers": {},
            "analysis": {"cvReport": {"before": True}},
            "projectedAfter": {
                "status": "ready",
                "full": {"relativePath": f"uploads/assessments/{aid}/projected/full.png"},
            },
            "projectedAnalysis": stored[-1] if stored else None,
        }

    async def fake_update(aid, payload):
        stored.append(dict(payload))
        return await fake_get(aid)

    with (
        patch("backend.pipeline_stages.get_assessment_by_id", side_effect=fake_get),
        patch("backend.pipeline_stages.update_assessment_projected_analysis", side_effect=fake_update),
        patch("backend.pipeline_stages.load_projected_full", return_value=b"\x89PNG\r\n\x1a\n"),
        patch(
            "backend.pipeline_stages.run_face_analysis",
            return_value={"success": False, "error": "No face detected"},
        ),
    ):
        asyncio.run(run_projected_analysis_now({"id": assessment_id}))

    assert stored[-1]["status"] == "failed"
    assert "No face" in (stored[-1].get("error") or "")


if __name__ == "__main__":
    test_new_projected_analysis_pending()
    test_merge_projected_analysis_update()
    test_run_projected_analysis_now_writes_ready_and_leaves_analysis_untouched()
    test_run_projected_analysis_now_skips_when_projected_after_not_ready()
    test_run_projected_analysis_now_fails_soft_when_cv_fails()
    print("all projected_analysis tests passed")
