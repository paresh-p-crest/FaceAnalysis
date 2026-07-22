"""Background worker — claims queued assessments and runs pipeline stages."""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from .pipeline_status import (
    RETRY_BACKOFF_SEC,
    merge_pipeline_update,
    next_pipeline_stage,
    _utcnow_iso,
)
from .repositories.assessment_repository import (
    claim_next_queued_assessment,
    get_assessment_by_id,
    update_assessment_pipeline,
)
# ponytail: pipeline_stages pulls mediapipe/torch — import only when a job runs.

logger = logging.getLogger(__name__)

_worker_task: Optional[asyncio.Task] = None
_stop_event: Optional[asyncio.Event] = None


def pipeline_worker_enabled() -> bool:
    return os.environ.get("PIPELINE_WORKER_ENABLED", "true").lower() not in ("0", "false", "no", "off")


def pipeline_poll_interval_sec() -> float:
    try:
        return float(os.environ.get("PIPELINE_POLL_INTERVAL_SEC", "3"))
    except ValueError:
        return 3.0


async def _run_stage_with_retry(assessment: dict, stage: str) -> dict:
    from .pipeline_stages import (
        run_ai_visuals_stage,
        run_cv_stage,
        run_narratives_stage,
        run_parsing_stage,
        run_projected_after_stage,
    )

    pipeline = dict(assessment.get("pipeline") or {})
    attempts = dict(pipeline.get("attempts") or {})
    max_attempts = int(pipeline.get("maxAttempts") or 3)
    stage_attempts = int(attempts.get(stage) or 0)

    runners = {
        "cv": run_cv_stage,
        "narratives": run_narratives_stage,
        "parsing": run_parsing_stage,
        "projected_after": run_projected_after_stage,
        "ai_visuals": run_ai_visuals_stage,
    }
    runner = runners[stage]

    while stage_attempts < max_attempts:
        try:
            result = await runner(assessment)
            attempts[stage] = stage_attempts + 1
            pipeline["attempts"] = attempts
            pipeline["lastError"] = None
            await update_assessment_pipeline(assessment["id"], pipeline)
            return result
        except Exception as exc:
            stage_attempts += 1
            attempts[stage] = stage_attempts
            pipeline["attempts"] = attempts
            pipeline["lastError"] = str(exc)
            logger.exception("Pipeline stage %s failed (attempt %s) for %s", stage, stage_attempts, assessment["id"])
            if stage_attempts >= max_attempts:
                pipeline["status"] = "failed"
                pipeline["completedAt"] = _utcnow_iso()
                await update_assessment_pipeline(assessment["id"], pipeline)
                raise
            backoff = RETRY_BACKOFF_SEC[min(stage_attempts - 1, len(RETRY_BACKOFF_SEC) - 1)]
            await asyncio.sleep(backoff)
            assessment = await get_assessment_by_id(assessment["id"]) or assessment

    raise RuntimeError(f"Stage {stage} exhausted retries")


async def _process_assessment(assessment: dict) -> None:
    from .pipeline_stages import finalize_pipeline

    assessment_id = assessment["id"]
    pipeline = dict(assessment.get("pipeline") or {})
    current_stage = pipeline.get("stage") or "cv"

    stage_sequence = ("cv", "narratives", "parsing", "projected_after", "ai_visuals")
    start_idx = stage_sequence.index(current_stage) if current_stage in stage_sequence else 0

    for stage in stage_sequence[start_idx:]:
        pipeline = merge_pipeline_update(
            pipeline,
            status="running",
            stage=stage,
            stageStartedAt=_utcnow_iso(),
        )
        await update_assessment_pipeline(assessment_id, pipeline)
        assessment = await _run_stage_with_retry(assessment, stage)
        pipeline = dict((await get_assessment_by_id(assessment_id) or assessment).get("pipeline") or pipeline)
        next_stage = next_pipeline_stage(stage)
        if next_stage:
            pipeline = merge_pipeline_update(pipeline, stage=next_stage, stageStartedAt=_utcnow_iso())

    await finalize_pipeline(assessment_id)
    logger.info("Pipeline complete for assessment %s", assessment_id)


async def pipeline_worker_loop() -> None:
    global _stop_event
    _stop_event = asyncio.Event()
    logger.info("Pipeline worker started (poll=%ss)", pipeline_poll_interval_sec())
    while not _stop_event.is_set():
        try:
            claimed = await claim_next_queued_assessment()
            if claimed:
                await _process_assessment(claimed)
            else:
                try:
                    await asyncio.wait_for(
                        _stop_event.wait(),
                        timeout=pipeline_poll_interval_sec(),
                    )
                except asyncio.TimeoutError:
                    pass
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Pipeline worker loop error")
            await asyncio.sleep(pipeline_poll_interval_sec())
    logger.info("Pipeline worker stopped")


def start_pipeline_worker() -> Optional[asyncio.Task]:
    global _worker_task
    if not pipeline_worker_enabled():
        logger.info("Pipeline worker disabled (PIPELINE_WORKER_ENABLED=false)")
        return None
    if _worker_task and not _worker_task.done():
        return _worker_task
    _worker_task = asyncio.create_task(pipeline_worker_loop())
    return _worker_task


async def stop_pipeline_worker() -> None:
    global _worker_task, _stop_event
    if _stop_event:
        _stop_event.set()
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None
