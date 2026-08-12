"""Unit tests for central CV model store (paths, downloads, timeouts)."""

from __future__ import annotations

import socket
import time
from pathlib import Path
from urllib.error import URLError

import pytest

from backend import model_store


def test_models_root_default(monkeypatch, tmp_path):
    monkeypatch.delenv("CV_MODELS_ROOT", raising=False)
    # Point default via env so we don't touch repo models/
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    root = model_store.models_root()
    assert root == (tmp_path / "models").resolve()
    assert root.is_dir()


def test_models_root_env_override(monkeypatch, tmp_path):
    custom = tmp_path / "custom_cv"
    monkeypatch.setenv("CV_MODELS_ROOT", str(custom))
    assert model_store.models_root() == custom.resolve()
    assert model_store.ear_weights_path() == custom.resolve() / "ear_landmarker.pth"
    assert model_store.hf_cache_dir() == custom.resolve() / "huggingface"


def test_download_url_to_file_atomic_and_size_gate(monkeypatch, tmp_path):
    dest = tmp_path / "ear_landmarker.pth"
    payload = b"x" * 1_500_000

    def _fake_retrieve(url, filename):
        Path(filename).write_bytes(payload)

    monkeypatch.setattr(model_store.urllib.request, "urlretrieve", _fake_retrieve)
    assert model_store.download_url_to_file("http://example/ear.pth", dest) is True
    assert dest.is_file()
    assert dest.stat().st_size == len(payload)
    assert not dest.with_suffix(".pth.download").exists()


def test_download_url_to_file_rejects_tiny(monkeypatch, tmp_path):
    dest = tmp_path / "ear_landmarker.pth"

    def _fake_retrieve(url, filename):
        Path(filename).write_bytes(b"tiny")

    monkeypatch.setattr(model_store.urllib.request, "urlretrieve", _fake_retrieve)
    assert model_store.download_url_to_file("http://example/ear.pth", dest) is False
    assert not dest.is_file()


def test_download_url_to_file_timeout(monkeypatch, tmp_path):
    dest = tmp_path / "ear_landmarker.pth"

    def _hang(url, filename):
        raise socket.timeout("timed out")

    monkeypatch.setattr(model_store.urllib.request, "urlretrieve", _hang)
    monkeypatch.setenv("CV_MODEL_DOWNLOAD_TIMEOUT_SEC", "1")
    assert model_store.download_url_to_file("http://example/ear.pth", dest, timeout_sec=1) is False
    assert not dest.is_file()


def test_download_url_to_file_network_error(monkeypatch, tmp_path):
    dest = tmp_path / "ear_landmarker.pth"

    def _boom(url, filename):
        raise URLError("network down")

    monkeypatch.setattr(model_store.urllib.request, "urlretrieve", _boom)
    assert model_store.download_url_to_file("http://example/ear.pth", dest) is False


def test_ensure_ear_legacy_copy_into_central(monkeypatch, tmp_path):
    """If central missing and REPO_ROOT/ear_landmarker.pth exists, copy into central."""
    models = tmp_path / "models"
    monkeypatch.setenv("CV_MODELS_ROOT", str(models))
    monkeypatch.delenv("EAR_LANDMARKER_PATH", raising=False)
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "true")

    monkeypatch.setattr(model_store, "REPO_ROOT", tmp_path)
    legacy = tmp_path / "ear_landmarker.pth"
    legacy.write_bytes(b"z" * 2_000_000)

    def _no_net(url, dest, timeout_sec=None, min_size_bytes=1_000_000):
        raise AssertionError("should not download when legacy exists")

    monkeypatch.setattr(model_store, "download_url_to_file", _no_net)
    got = model_store.ensure_ear_landmarker_weights()
    assert got == models / "ear_landmarker.pth"
    assert got.is_file()


def test_ensure_ear_path_override(monkeypatch, tmp_path):
    dest = tmp_path / "custom" / "ear.pth"
    payload = b"x" * 1_500_000

    def _fake_retrieve(url, filename):
        Path(filename).write_bytes(payload)

    monkeypatch.setattr(model_store.urllib.request, "urlretrieve", _fake_retrieve)
    monkeypatch.setenv("EAR_LANDMARKER_AUTO_DOWNLOAD", "true")
    got = model_store.ensure_ear_landmarker_weights(dest)
    assert got == dest
    assert dest.is_file()


def test_ensure_mivolo_uses_hf_cache_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    calls = {}

    def _fake_snapshot(**kwargs):
        calls.update(kwargs)
        if kwargs.get("local_files_only"):
            raise FileNotFoundError("not cached")
        return tmp_path / "snap"

    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", _fake_snapshot)

    assert model_store.ensure_mivolo_weights() is True
    assert calls["cache_dir"] == str(tmp_path / "models" / "huggingface")
    assert calls["repo_id"] == model_store.MIVOLO_MODEL_ID


def test_ensure_face_parsing_local_then_download(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    attempts = []

    def _fake_snapshot(**kwargs):
        attempts.append(dict(kwargs))
        if kwargs.get("local_files_only"):
            raise FileNotFoundError("not cached")
        return tmp_path / "snap"

    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", _fake_snapshot)
    assert model_store.ensure_face_parsing_weights() is True
    assert len(attempts) == 2
    assert attempts[0]["local_files_only"] is True
    assert attempts[1].get("local_files_only") is False
    assert attempts[1]["cache_dir"] == str(tmp_path / "models" / "huggingface")
    # Slim download: safetensors + configs only (not ONNX / pytorch_model.bin / demo).
    assert attempts[0]["allow_patterns"] == model_store._FACE_PARSING_ALLOW_PATTERNS
    assert attempts[1]["allow_patterns"] == model_store._FACE_PARSING_ALLOW_PATTERNS
    assert attempts[1]["max_workers"] == 1
    assert "model.safetensors" in attempts[1]["allow_patterns"]
    assert all("onnx" not in p for p in attempts[1]["allow_patterns"])


def test_snapshot_download_timeout(monkeypatch, tmp_path):
    monkeypatch.setenv("CV_MODELS_ROOT", str(tmp_path / "models"))
    monkeypatch.setenv("CV_MODEL_DOWNLOAD_TIMEOUT_SEC", "1")

    def _hang(**kwargs):
        if kwargs.get("local_files_only"):
            raise FileNotFoundError("not cached")
        time.sleep(5)

    import huggingface_hub

    monkeypatch.setattr(huggingface_hub, "snapshot_download", _hang)
    assert model_store.ensure_mivolo_weights() is False
