"""Unit tests for CV model preload orchestrator."""

from __future__ import annotations

import asyncio
import time

from backend import model_preload


def test_run_model_preload_disabled(monkeypatch):
    monkeypatch.setenv("CV_MODEL_PRELOAD", "false")
    model_preload._preload_done = asyncio.Event()
    model_preload._preload_result = None

    asyncio.run(model_preload.run_model_preload_background())
    assert model_preload._preload_done.is_set()
    assert model_preload._preload_result == {"status": "disabled"}


def test_run_model_preload_calls_ensure(monkeypatch):
    monkeypatch.setenv("CV_MODEL_PRELOAD", "true")
    model_preload._preload_done = asyncio.Event()
    model_preload._preload_result = None

    called = {"n": 0}

    def _fake_ensure():
        called["n"] += 1
        return {"ear_landmarker": "ready", "mivolo": "skipped", "face_parsing": "skipped"}

    monkeypatch.setattr(model_preload, "ensure_all_cv_weights", _fake_ensure)
    asyncio.run(model_preload.run_model_preload_background())
    assert called["n"] == 1
    assert model_preload._preload_result["ear_landmarker"] == "ready"


def test_run_model_preload_isolates_exception(monkeypatch):
    monkeypatch.setenv("CV_MODEL_PRELOAD", "true")
    model_preload._preload_done = asyncio.Event()
    model_preload._preload_result = None

    def _boom():
        raise RuntimeError("explode")

    monkeypatch.setattr(model_preload, "ensure_all_cv_weights", _boom)
    asyncio.run(model_preload.run_model_preload_background())
    assert model_preload._preload_done.is_set()
    assert model_preload._preload_result["status"] == "error"


def test_run_model_preload_overall_timeout_soft_fails(monkeypatch):
    monkeypatch.setenv("CV_MODEL_PRELOAD", "true")
    monkeypatch.setenv("CV_MODEL_PRELOAD_TIMEOUT_SEC", "1")
    model_preload._preload_done = asyncio.Event()
    model_preload._preload_result = None

    def _slow():
        time.sleep(5)
        return {"ear_landmarker": "ready"}

    monkeypatch.setattr(model_preload, "ensure_all_cv_weights", _slow)
    monkeypatch.setattr(model_preload, "preload_timeout_sec", lambda: 1)
    asyncio.run(model_preload.run_model_preload_background())
    assert model_preload._preload_done.is_set()
    assert model_preload._preload_result == {"status": "timeout"}


def test_ensure_all_isolates_per_model(monkeypatch, tmp_path):
    from backend import model_store

    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    monkeypatch.setenv("FACE_PARSING_ENABLED", "false")
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "false")

    def _boom():
        raise RuntimeError("mivolo boom")

    monkeypatch.setattr(model_store, "ensure_mivolo_weights", _boom)
    status = model_store.ensure_all_cv_weights()
    assert status["ear_landmarker"] == "skipped"
    assert status["mivolo"] == "error"
    assert status["face_parsing"] == "skipped"
