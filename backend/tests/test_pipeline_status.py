"""Tests for pipeline status helpers."""

from backend.pipeline_status import (
    is_stage_complete,
    new_queued_pipeline,
    next_pipeline_stage,
    pipeline_is_processing,
)


def test_new_queued_pipeline_defaults():
    p = new_queued_pipeline()
    assert p["status"] == "queued"
    assert p["stage"] == "queued"
    assert p["attempts"]["cv"] == 0


def test_next_pipeline_stage_order():
    assert next_pipeline_stage("queued") == "cv"
    assert next_pipeline_stage("cv") == "narratives"
    assert next_pipeline_stage("narratives") == "parsing"
    assert next_pipeline_stage("parsing") == "projected_after"
    assert next_pipeline_stage("projected_after") == "ai_visuals"
    assert next_pipeline_stage("ai_visuals") == "done"


def test_resolve_resume_stage():
    from backend.pipeline_status import claim_stage_from_pipeline, resolve_resume_stage

    assert resolve_resume_stage({"stage": "parsing"}) == "parsing"
    assert claim_stage_from_pipeline({"stage": "narratives"}) == "narratives"


def test_pipeline_is_processing():
    assert pipeline_is_processing({"status": "queued"})
    assert pipeline_is_processing({"status": "running"})
    assert not pipeline_is_processing({"status": "ready"})


def test_is_stage_complete_when_ready():
    p = {"status": "ready", "stage": "done"}
    assert is_stage_complete(p, "cv")
    assert is_stage_complete(p, "parsing")
