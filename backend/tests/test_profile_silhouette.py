"""Tests for profile silhouette extraction and cephalometric wiring."""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.profile_silhouette import extract_profile_silhouette_points
from backend.profile_cephalometrics import analyze_profile, build_profile_report


def _encode_bgr(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def _synthetic_right_profile() -> bytes:
    """Simple filled silhouette facing right (nose toward +x)."""
    img = np.full((400, 300, 3), 240, dtype=np.uint8)
    cv2.ellipse(img, (120, 200), (70, 140), 0, 0, 360, (40, 40, 40), -1)
    cv2.ellipse(img, (175, 180), (35, 40), 0, 0, 360, (40, 40, 40), -1)
    return _encode_bgr(img)


def test_extract_profile_silhouette_points():
    pts = extract_profile_silhouette_points(_synthetic_right_profile())
    assert pts is not None
    for key in ("glabella", "nasion", "pronasale", "subnasale", "pogonion", "menton"):
        assert key in pts
        assert "x" in pts[key] and "y" in pts[key]
    assert pts["dataSource"] == "silhouette_estimate"


def test_analyze_profile_prefers_silhouette_when_image_given():
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0} for _ in range(478)]
    lms[10] = {"x": 0.5, "y": 0.2, "z": 0}
    lms[6] = {"x": 0.52, "y": 0.30, "z": 0}
    lms[2] = {"x": 0.5, "y": 0.45, "z": 0}
    lms[1] = {"x": 0.55, "y": 0.42, "z": 0}
    lms[152] = {"x": 0.52, "y": 0.75, "z": 0}
    lms[13] = {"x": 0.53, "y": 0.48, "z": 0}
    lms[14] = {"x": 0.53, "y": 0.52, "z": 0}
    for idx in (356, 454, 323, 361, 288, 397, 365, 379):
        lms[idx] = {"x": 0.3, "y": 0.35, "z": 0}

    mesh_only = analyze_profile(lms, "rightProfile", mm_per_unit=100)
    assert mesh_only is not None
    assert mesh_only["landmarkSource"] == "facemesh"

    with_sil = analyze_profile(
        lms, "rightProfile", mm_per_unit=100, image_bytes=_synthetic_right_profile()
    )
    assert with_sil is not None
    assert with_sil["landmarkSource"] in ("silhouette", "silhouette+facemesh")
    assert with_sil["measurements"]["nasofrontalAngleDeg"] is not None
    assert with_sil["measurements"]["nasolabialAngleDeg"] is not None


def test_build_profile_report_passes_photos():
    report = build_profile_report(
        views={"rightProfile": {"success": False, "landmarks": []}},
        mm_per_unit=None,
        photos={"rightProfile": _synthetic_right_profile()},
    )
    assert report["dataSource"] == "measured"
    assert report["primary"] is not None
    assert report["primary"]["landmarkSource"] == "silhouette"
