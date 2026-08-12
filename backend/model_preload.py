"""Model preload orchestrator — background, timeout-bounded, never blocks boot."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from .model_store import (
    ensure_all_cv_weights,
    preload_enabled,
    preload_timeout_sec,
)

logger = logging.getLogger(__name__)

_preload_task: Optional[asyncio.Task] = None
_preload_result: Optional[dict[str, str]] = None
_preload_done = asyncio.Event()


async def run_model_preload_background() -> None:
    """Run the CV model weight preload in a background thread with overall timeout.

    This is called after deferred boot completes. It never raises to the caller;
    failures are logged and the per-model status is stored in _preload_result.
    """
    global _preload_result

    if not preload_enabled():
        logger.info("Model preload disabled via CV_MODEL_PRELOAD=false")
        _preload_result = {"status": "disabled"}
        _preload_done.set()
        return

    timeout = preload_timeout_sec()
    logger.info("Starting background CV model preload (timeout=%ss)...", timeout)

    try:
        # Run the synchronous ensure in a thread pool with overall timeout
        result = await asyncio.wait_for(
            asyncio.to_thread(ensure_all_cv_weights),
            timeout=timeout,
        )
        _preload_result = result
        logger.info("Model preload completed: %s", result)
    except asyncio.TimeoutError:
        logger.warning("Model preload timed out after %ss (soft-fail)", timeout)
        _preload_result = {"status": "timeout"}
    except Exception as exc:
        logger.warning("Model preload failed: %s", exc)
        _preload_result = {"status": "error", "error": str(exc)}
    finally:
        _preload_done.set()


def get_preload_status() -> dict:
    """Return the preload status for health/debug endpoints."""
    return {
        "done": _preload_done.is_set(),
        "result": _preload_result,
    }


async def start_preload_if_booted(boot_done: asyncio.Event) -> None:
    """Start the preload task once boot_done is set.

    Call this from main.py lifespan after _boot_done.set().
    """
    global _preload_task
    await boot_done.wait()
    if _preload_task is None or _preload_task.done():
        _preload_task = asyncio.create_task(run_model_preload_background())
        logger.debug("Background model preload task created")


async def cancel_preload() -> None:
    """Cancel the preload task on shutdown."""
    global _preload_task
    if _preload_task and not _preload_task.done():
        _preload_task.cancel()
        try:
            await _preload_task
        except asyncio.CancelledError:
            pass
    _preload_task = None