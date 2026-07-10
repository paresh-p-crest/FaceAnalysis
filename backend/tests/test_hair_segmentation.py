"""Tests for OpenCV hair-mask segmentation (always-on pipeline)."""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.hair_segmentation import analyze_hair_segmentation
from backend.hair_analysis import analyze_hair_photo


def _encode_bgr(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_hair_segmentation_returns_metrics_on_dark_crown():
    img = np.full((400, 400, 3), 200, dtype=np.uint8)
    img[40:300, 60:340] = (15, 15, 15)
    result = analyze_hair_segmentation(_encode_bgr(img))
    assert result is not None
    assert result["dataSource"] == "measured"
    assert result["segmentationMethod"] == "opencv_hsv"
    assert result["densityPct"] is not None
    assert result["densityPct"] > 10


def test_hair_segmentation_empty_bytes():
    assert analyze_hair_segmentation(b"") is None


def test_analyze_hair_photo_uses_segmentation_method():
    img = np.full((400, 400, 3), 200, dtype=np.uint8)
    img[40:300, 60:340] = (15, 15, 15)
    result = analyze_hair_photo(_encode_bgr(img))
    assert result["dataSource"] == "measured"
    assert result.get("segmentationMethod") == "opencv_hsv"
    assert result.get("norwoodStage") is not None
