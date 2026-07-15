"""Shared test fixtures for the backend suite."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend import media_storage


@pytest.fixture(autouse=True)
def _local_media_storage(tmp_path, monkeypatch):
    """Force the filesystem media backend at a per-test temp root.

    Keeps tests hermetic and independent of any Replit environment / env vars.
    """
    monkeypatch.setenv("MEDIA_STORAGE_BACKEND", "local")
    monkeypatch.setattr(media_storage, "MEDIA_LOCAL_ROOT", tmp_path / "media")
    media_storage.reset_media_storage_cache()
    yield
    media_storage.reset_media_storage_cache()
