"""Tests for scoped naso-aural nose guide sidecar (face-det crop path)."""

from __future__ import annotations

import copy
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.naso_aural_guide_overlay import (
    _guides_crown_plausible,
    nose_height_norm_from_guides,
    patch_naso_aural_guides,
    run_naso_aural_nose_guide_overlay,
)
from backend.tests.test_profile_silhouette import _synthetic_right_profile


def test_guides_crown_plausible_rejects_crown_lock():
    assert not _guides_crown_plausible({"x": 0.5, "y": 0.08}, {"x": 0.5, "y": 0.18})
    assert _guides_crown_plausible({"x": 0.5, "y": 0.35}, {"x": 0.5, "y": 0.52})


def test_guides_crown_plausible_allows_script_span_on_real_profile():
    """Same norms as profile_landmarks on 1500x2000 rightProfile (span ~0.025)."""
    assert _guides_crown_plausible({"x": 0.8, "y": 0.237}, {"x": 0.744667, "y": 0.2615})


def test_guides_crown_plausible_rejects_collapsed_span():
    assert not _guides_crown_plausible({"x": 0.5, "y": 0.30}, {"x": 0.5, "y": 0.302})


def test_guides_crown_plausible_allows_glabella_above_ear():
    assert _guides_crown_plausible({"x": 0.5, "y": 0.28}, {"x": 0.5, "y": 0.48})


def test_sidecar_returns_plausible_y_when_silhouette_resolves(monkeypatch):
    guides_in = [
        {"y": 35.0, "x1": 75.0, "x2": 42.0, "dashed": True},
        {"y": 52.0, "x1": 75.0, "x2": 40.0, "dashed": True},
    ]

    monkeypatch.setattr(
        "backend.naso_aural_guide_overlay.extract_glabella_subnasale",
        lambda _b, **kw: ({"x": 0.42, "y": 0.35}, {"x": 0.40, "y": 0.52}, []),
    )
    monkeypatch.setattr(
        "backend.naso_aural_guide_overlay.ear_vertical_x_pct",
        lambda **kw: 80.0,
    )
    monkeypatch.setattr(
        "backend.naso_aural_guide_overlay.build_nose_level_guides",
        lambda **kw: guides_in,
    )
    monkeypatch.setattr(
        "backend.naso_aural_guide_overlay.mediapipe_solutions_available",
        lambda: True,
    )

    patch = run_naso_aural_nose_guide_overlay(
        _synthetic_right_profile(),
        facing_right=True,
        ear_measurements={"xMinNorm": 0.65, "xMaxNorm": 0.78},
        pose_id="rightProfile",
    )
    assert patch is not None
    assert patch["guideGlabella"]["y"] > 0.25
    assert patch["guides"] == guides_in


def test_nose_height_norm_from_guides():
    naso = {
        "guideGlabella": {"x": 0.42, "y": 0.35},
        "guideNoseBottom": {"x": 0.40, "y": 0.52},
    }
    assert nose_height_norm_from_guides(naso) == pytest.approx(0.17)
    assert nose_height_norm_from_guides({"guideGlabella": {"y": 0.08}, "guideNoseBottom": {"y": 0.18}}) is None


def test_patch_naso_aural_guides_does_not_mutate_ratio_fields(monkeypatch):
    naso = {
        "yourValue": 1.02,
        "noseHeightNorm": 0.18,
        "earHeightNorm": 0.19,
        "noseTop": {"x": 0.55, "y": 0.32},
        "noseBottom": {"x": 0.54, "y": 0.50},
        "overlay": {
            "nasoLayout": "earOnly-v5",
            "brackets": [{"id": "earVertical", "x1": 75, "y1": 20, "x2": 75, "y2": 55}],
        },
    }
    before = copy.deepcopy(naso)

    monkeypatch.setattr(
        "backend.naso_aural_guide_overlay.run_naso_aural_nose_guide_overlay",
        lambda *a, **k: {
            "guideGlabella": {"x": 0.42, "y": 0.35},
            "guideNoseBottom": {"x": 0.40, "y": 0.52},
            "guides": [
                {"y": 35.0, "x1": 75.0, "x2": 42.0, "dashed": True},
                {"y": 52.0, "x1": 75.0, "x2": 40.0, "dashed": True},
            ],
        },
    )

    patched = patch_naso_aural_guides(
        naso,
        _synthetic_right_profile(),
        facing_right=True,
        ear_measurements={"xMinNorm": 0.15, "xMaxNorm": 0.28},
        pose_id="rightProfile",
    )

    assert patched["yourValue"] == before["yourValue"]
    assert patched["noseTop"] == before["noseTop"]
    assert len(patched["overlay"].get("guides") or []) == 2


def test_patch_leaves_naso_unchanged_when_no_photo():
    naso = {"yourValue": 1.0, "overlay": {}}
    assert patch_naso_aural_guides(naso, None, facing_right=True) is naso
