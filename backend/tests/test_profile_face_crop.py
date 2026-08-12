"""Tests for shared profile face-det crop + silhouette mapping."""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.profile_face_crop import (
    detect_profile_face_box,
    expanded_face_crop,
    extract_glabella_subnasale,
    mediapipe_solutions_available,
    resolve_face_det_and_canvas,
    silhouette_points_full_norm,
)
from backend.tests.test_profile_silhouette import _synthetic_right_profile


@pytest.mark.skipif(not mediapipe_solutions_available(), reason="needs mediapipe solutions")
def test_extract_glabella_subnasale_span_on_synthetic():
    g, s, _anchors = extract_glabella_subnasale(_synthetic_right_profile(), bg_remove=False)
    if not g or not s:
        pytest.skip("face-det did not hit synthetic ellipse")
    assert g["y"] > 0.20
    assert s["y"] > g["y"] + 0.06


@pytest.mark.skipif(not mediapipe_solutions_available(), reason="needs mediapipe solutions")
def test_no_bg_remove_uses_original_canvas():
    raw = _synthetic_right_profile()
    bgr = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    face_det, canvas, mask = resolve_face_det_and_canvas(bgr, bg_remove=False)
    assert mask is None
    assert canvas is bgr
    if not face_det:
        pytest.skip("no face det on synthetic")
    g, s, anchors = extract_glabella_subnasale(raw, bg_remove=False)
    if not g or not s:
        pytest.skip("silhouette did not resolve on synthetic")
    assert s["y"] > g["y"] + 0.06
    assert len(anchors) >= 2


@pytest.mark.skipif(not mediapipe_solutions_available(), reason="needs mediapipe solutions")
def test_extract_prefers_facemesh_over_silhouette_on_real_profile():
    """Same plate as UI bug: FaceMesh glabella ~0.37, silhouette locks ~0.29 forehead."""
    path = (
        Path(__file__).resolve().parents[2]
        / "var"
        / "media"
        / "assessments"
        / "9e5fc073-298b-422a-af35-4d4b56283183"
        / "rightProfile.jpg"
    )
    if not path.is_file():
        pytest.skip("fixture profile photo not on disk")
    raw = path.read_bytes()
    g, s, _ = extract_glabella_subnasale(raw, bg_remove=True)
    assert g and s
    # Script FaceMesh glabella y≈0.372; silhouette was ≈0.290 (hairline).
    assert g["y"] > 0.33
    assert s["y"] > g["y"] + 0.10
    assert s["y"] - g["y"] < 0.28


def test_extract_uses_facemesh_when_available(monkeypatch):
    from backend import profile_face_crop as pfc

    raw = _synthetic_right_profile()

    monkeypatch.setattr(
        pfc,
        "_try_facemesh_glabella_subnasale",
        lambda _imgs: ({"x": 0.81, "y": 0.37}, {"x": 0.85, "y": 0.57}),
    )
    monkeypatch.setattr(
        pfc,
        "resolve_face_det_and_canvas",
        lambda bgr, **kw: (None, bgr, None),
    )

    g, s, anchors = pfc.extract_glabella_subnasale(raw, bg_remove=False)
    assert g == {"x": 0.81, "y": 0.37}
    assert s == {"x": 0.85, "y": 0.57}
    assert anchors == [0.81, 0.85]