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


def test_mapping_covers_all_protocol_features():
    from backend.config import PROTOCOL_FEATURE_IDS

    for fid in PROTOCOL_FEATURE_IDS:
        poses = poses_for_feature(fid)
        assert poses, f"{fid} should have at least one pose"
        assert fid in FEATURE_VISION_POSES
