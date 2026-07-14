"""Pipeline job state helpers for async assessment processing."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

PIPELINE_STATUSES = frozenset({"queued", "running", "ready", "failed"})
PIPELINE_STAGES = ("queued", "cv", "narratives", "parsing", "projected_after", "done")
STAGE_ORDER = ("cv", "narratives", "parsing", "projected_after")

STAGE_LABELS = {
    "cv": "Facial Data Processing",
    "parsing": "Aesthetic Assessment",
    "narratives": "Protocol Preparation",
    "projected_after": "Projected Preview",
}

WORKFLOW_STAGE_LABELS = {
    "pending_review": "Care Team Review",
    "approved": "Report Finalisation",
}

DEFAULT_MAX_ATTEMPTS = 3
RETRY_BACKOFF_SEC = (2, 8, 30)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_queued_pipeline() -> dict:
    now = _utcnow_iso()
    return {
        "status": "queued",
        "stage": "queued",
        "attempts": {"cv": 0, "narratives": 0, "parsing": 0, "projected_after": 0},
        "maxAttempts": DEFAULT_MAX_ATTEMPTS,
        "lastError": None,
        "queuedAt": now,
        "startedAt": None,
        "completedAt": None,
        "stageStartedAt": None,
        "estimatedMinutesRemaining": 5,
    }


def new_feature_parsing_pending() -> dict:
    return {
        "status": "pending",
        "attempts": 0,
        "maxAttempts": DEFAULT_MAX_ATTEMPTS,
        "lastError": None,
        "modelId": "jonathandinu/face-parsing",
        "scaleNote": "Assumed IPD 63.5mm for Qoves-aligned display; not clinical measurement",
        "updatedAt": _utcnow_iso(),
        "crops": {},
        "metrics": {},
    }


def pipeline_is_processing(pipeline: Optional[dict]) -> bool:
    if not isinstance(pipeline, dict):
        return False
    return pipeline.get("status") in ("queued", "running")


def pipeline_is_ready(pipeline: Optional[dict]) -> bool:
    return isinstance(pipeline, dict) and pipeline.get("status") == "ready"


def pipeline_is_failed(pipeline: Optional[dict]) -> bool:
    return isinstance(pipeline, dict) and pipeline.get("status") == "failed"


def next_pipeline_stage(current: str) -> Optional[str]:
    if current == "queued":
        return "cv"
    if current == "cv":
        return "narratives"
    if current == "narratives":
        return "parsing"
    if current == "parsing":
        return "projected_after"
    if current == "projected_after":
        return "done"
    return None


def stage_index(stage: str) -> int:
    if stage == "queued":
        return -1
    if stage == "done":
        return len(STAGE_ORDER)
    try:
        return STAGE_ORDER.index(stage)
    except ValueError:
        return -1


def is_stage_complete(pipeline: Optional[dict], stage: str) -> bool:
    if not isinstance(pipeline, dict):
        return False
    current = pipeline.get("stage") or "queued"
    if pipeline.get("status") == "ready":
        return True
    return stage_index(current) > stage_index(stage)


def format_pipeline_for_api(pipeline: Optional[dict]) -> Optional[dict]:
    if not isinstance(pipeline, dict):
        return None
    out = dict(pipeline)
    out["stageLabel"] = STAGE_LABELS.get(out.get("stage"), out.get("stage"))
    return out


def merge_pipeline_update(existing: Optional[dict], **updates: Any) -> dict:
    base = dict(existing or new_queued_pipeline())
    base.update(updates)
    return base
