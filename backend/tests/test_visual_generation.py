"""Tests for AI visual source resolution and prompts."""

import base64

import pytest

from backend.media_storage import assessment_key, get_media_storage
from backend.visual_generation import (
    build_visual_prompt,
    resolve_source_image_bytes,
)


def test_build_visual_prompt_hair_is_identity_preserving():
    prompt = build_visual_prompt(
        "hair",
        {"ageRange": "25-34", "gender": "female", "goals": ["glow"]},
        {"faceShape": {"shape": "oval"}, "hair": {"hairline": "average"}, "skin": {"tone": "medium"}},
        {"visualAge": 28},
    )
    assert "Preserve identity" in prompt or "same person" in prompt
    assert "hairstyle" in prompt.lower()
    assert "surgical" not in prompt.lower() or "No medical" in prompt
    assert "oval" in prompt


def test_build_visual_prompt_rejects_unknown_type():
    with pytest.raises(ValueError):
        build_visual_prompt("laser", {}, {}, None)


def test_resolve_prefers_assessment_front_file():
    assessment_id = "abc123"
    get_media_storage().put_bytes(
        assessment_key(assessment_id, "front.jpg"),
        b"\xff\xd8\xff" + b"0" * 200 + b"\xff\xd9",
    )

    data, kind = resolve_source_image_bytes(assessment_id=assessment_id)
    assert data is not None
    assert kind == "assessment_front_file"
    assert data.startswith(b"\xff\xd8")


def test_resolve_data_url():
    raw = b"\xff\xd8\xff" + b"1" * 120 + b"\xff\xd9"
    data_url = "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")

    data, kind = resolve_source_image_bytes(source_image=data_url)
    assert kind == "data_url"
    assert data.startswith(b"\xff\xd8")


def test_resolve_rejects_public_url_as_base64():
    """Regression: /uploads/... (missing object) must not be base64-decoded."""
    data, kind = resolve_source_image_bytes(
        source_image="/api/media/assessments/missing-assessment-id/front.jpg"
    )
    assert data is None
    assert kind is None


def test_resolve_public_url_from_storage():
    assessment_id = "viztest01"
    get_media_storage().put_bytes(
        assessment_key(assessment_id, "front.jpg"),
        b"\xff\xd8\xff" + b"2" * 80 + b"\xff\xd9",
    )

    data, kind = resolve_source_image_bytes(
        source_image=f"/api/media/assessments/{assessment_id}/front.jpg"
    )
    assert kind == "cv_report_url_file"
    assert data.startswith(b"\xff\xd8")
