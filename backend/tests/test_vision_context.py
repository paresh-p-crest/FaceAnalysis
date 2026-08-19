"""Tests for OpenAI Vision feature→pose mapping."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.config import FEATURE_VISION_POSES
from backend.vision_context import poses_for_feature


import os
from unittest.mock import patch

from backend.config import FEATURE_VISION_POSES
from backend.vision_context import openai_vision_narrative_enabled, poses_for_feature


def test_hair_uses_front():
    assert poses_for_feature("hair") == ["front"]


def test_ears_uses_front_and_right_profile():
    assert poses_for_feature("ears") == ["front", "rightProfile"]


def test_mapping_covers_all_narrative_features():
    from backend.config import FEATURE_NARRATIVE_IDS

    for fid in FEATURE_NARRATIVE_IDS:
        poses = poses_for_feature(fid)
        assert poses, f"{fid} should have at least one pose"
        assert fid in FEATURE_VISION_POSES
        if fid == "ears":
            assert len(poses) == 2
        else:
            assert len(poses) == 1


def test_openrouter_vision_enabled():
    env = {
        "LLM_PROVIDER": "openrouter",
        "OPENROUTER_MODEL": "openai/gpt-5.6-luna",
        "OPENROUTER_API_KEY": "sk-or-test",
        "OPENAI_VISION_NARRATIVE": "1",
    }
    with patch.dict(os.environ, env, clear=True):
        assert openai_vision_narrative_enabled() is True

    # Non-allowlisted OpenRouter model should return False
    env_non_vision = dict(env, OPENROUTER_MODEL="meta-llama/llama-3.3-70b-instruct:free")
    with patch.dict(os.environ, env_non_vision, clear=True):
        assert openai_vision_narrative_enabled() is False

