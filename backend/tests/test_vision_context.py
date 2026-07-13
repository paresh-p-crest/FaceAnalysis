"""Tests for OpenAI Vision feature→pose mapping."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.config import FEATURE_VISION_POSES
from backend.vision_context import poses_for_feature


def test_hair_uses_front_and_top():
    assert poses_for_feature("hair") == ["front", "topHead"]


def test_lips_uses_front_and_smile():
    assert poses_for_feature("lips") == ["front", "smile"]


def test_mapping_covers_all_narrative_features():
    from backend.config import FEATURE_NARRATIVE_IDS

    for fid in FEATURE_NARRATIVE_IDS:
        poses = poses_for_feature(fid)
        assert poses, f"{fid} should have at least one pose"
        assert fid in FEATURE_VISION_POSES


def test_smile_uses_smile_and_front():
    assert poses_for_feature("smile") == ["smile", "front"]
