"""Tests for pipeline retry, reclaim, and resume-stage helpers."""

import inspect

from backend.pipeline_status import claim_stage_from_pipeline, resolve_resume_stage
from backend.repositories import assessment_repository as repo


def test_resolve_resume_stage_from_real_stage():
    pipeline = {"stage": "narratives", "attempts": {"cv": 1, "narratives": 2}}
    assert resolve_resume_stage(pipeline) == "narratives"


def test_resolve_resume_stage_from_attempts():
    pipeline = {"stage": "done", "attempts": {"cv": 1, "parsing": 1}}
    assert resolve_resume_stage(pipeline) == "parsing"


def test_resolve_resume_stage_defaults_to_cv():
    assert resolve_resume_stage({"stage": "queued"}) == "cv"
    assert resolve_resume_stage(None) == "cv"


def test_claim_stage_from_pipeline_resumes_not_always_cv():
    assert claim_stage_from_pipeline({"stage": "ai_visuals"}) == "ai_visuals"
    assert claim_stage_from_pipeline({"stage": "queued"}) == "cv"


def test_requeue_pipeline_modes_present():
    src = inspect.getsource(repo.requeue_pipeline)
    assert 'mode == "full"' in src
    assert "forceRetry=True" in src
    assert "delete_stored_protocol" in src
    assert "resolve_resume_stage" in src


def test_reclaim_stale_running_pipelines_present():
    src = inspect.getsource(repo.reclaim_stale_running_pipelines)
    assert 'status"].astext == "running"' in src or "running" in src
    assert "resolve_resume_stage" in src
    assert '"queued"' in src or "'queued'" in src


def test_claim_next_pipeline_job_running_before_queued():
    src = inspect.getsource(repo.claim_next_pipeline_job)
    assert '("running", "queued")' in src or "('running', 'queued')" in src
    assert "claim_stage_from_pipeline" in src
    assert 'stage="cv"' not in src


def test_retry_endpoint_accepts_mode():
    from backend.routers import assessments as router_mod

    src = inspect.getsource(router_mod.post_retry_pipeline)
    assert "RetryPipelineBody" in src
    assert 'mode="resume"' in src or "resume" in src
    assert "requeue_pipeline" in src
