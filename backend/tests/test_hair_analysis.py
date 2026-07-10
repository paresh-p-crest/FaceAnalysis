"""Tests for top-of-head hair analysis."""

from __future__ import annotations

import cv2
import numpy as np

from backend.hair_analysis import analyze_hair_photo, _norwood_stage


def _encode_bgr(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_analyze_hair_photo_succeeds_on_dark_crown():
    # Dark crown region should trigger color sampling without crashing.
    img = np.full((400, 400, 3), 200, dtype=np.uint8)
    img[60:300, 80:320] = (20, 20, 20)  # dark BGR hair region
    result = analyze_hair_photo(_encode_bgr(img))
    assert result["dataSource"] == "measured"
    assert "Top-of-head hair analysis failed" not in (result.get("explanation") or "")
    assert result.get("norwoodStage") is not None
    assert result.get("densityPct") is not None
    assert result.get("hairColor")


def test_analyze_hair_photo_empty_bytes_returns_estimated():
    result = analyze_hair_photo(b"")
    assert result["dataSource"] == "estimated"


def test_norwood_stage_buckets():
    assert _norwood_stage(50, "Full", "None detected") == 1
    assert _norwood_stage(10, "Receding", "Crown thinning") >= 5
