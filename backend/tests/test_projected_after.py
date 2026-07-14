"""Tests for projected AFTER generation and pipeline stage gating."""

from __future__ import annotations

import os

import numpy as np

from backend.projected_after import projected_after_enabled, project_full_face_after, projection_strengths
from backend.projected_after_status import new_projected_after_pending


def test_projected_after_disabled_by_default():
    old = os.environ.pop("PROJECTED_AFTER_ENABLED", None)
    try:
        assert projected_after_enabled() is False
    finally:
        if old is not None:
            os.environ["PROJECTED_AFTER_ENABLED"] = old


def test_projected_after_enabled_when_set():
    old = os.environ.get("PROJECTED_AFTER_ENABLED")
    os.environ["PROJECTED_AFTER_ENABLED"] = "true"
    try:
        assert projected_after_enabled() is True
    finally:
        if old is None:
            os.environ.pop("PROJECTED_AFTER_ENABLED", None)
        else:
            os.environ["PROJECTED_AFTER_ENABLED"] = old


def test_new_projected_after_pending():
    pa = new_projected_after_pending()
    assert pa["status"] == "pending"
    assert pa["full"] is None


def test_projection_strengths_from_cv_report():
    strengths = projection_strengths(
        {"hair": {"score": 70}, "skin": {"score": 80}, "eyes": {"score": 75}},
        {"anthropometrics": {"deviations": {"symmetry": 12, "nose": 8}}},
    )
    assert 0.12 <= strengths["full"] <= 0.22
    assert strengths["hair"] >= strengths["skin"]


def _minimal_jpeg() -> bytes:
  import cv2
  img = np.zeros((120, 90, 3), dtype=np.uint8)
  img[:, :] = (180, 160, 140)
  ok, buf = cv2.imencode(".jpg", img)
  assert ok
  return buf.tobytes()


def _sample_landmarks():
    pts = []
    for i in range(478):
        pts.append({"id": i, "x": 0.5, "y": 0.5, "z": 0})
    pts[10] = {"id": 10, "x": 0.5, "y": 0.15, "z": 0}
    pts[152] = {"id": 152, "x": 0.5, "y": 0.85, "z": 0}
    pts[105] = {"id": 105, "x": 0.35, "y": 0.28, "z": 0}
    pts[334] = {"id": 334, "x": 0.65, "y": 0.28, "z": 0}
    return pts


def test_project_full_face_after_returns_jpeg():
    out = project_full_face_after(
        _minimal_jpeg(),
        _sample_landmarks(),
        {"skin": {"score": 72}, "hair": {"score": 68}},
        {"anthropometrics": {"deviations": {"symmetry": 15}}},
    )
    assert out.startswith(b"\xff\xd8")
    assert len(out) > 200


if __name__ == "__main__":
    test_projected_after_disabled_by_default()
    test_projected_after_enabled_when_set()
    test_new_projected_after_pending()
    test_projection_strengths_from_cv_report()
    test_project_full_face_after_returns_jpeg()
    print("all projected_after tests passed")
