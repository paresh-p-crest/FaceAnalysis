"""Tests for AI visual source resolution and prompts."""

import base64

import pytest

from backend.media_storage import assessment_key, get_media_storage
from backend.visual_generation import (
    SHARED_VISUAL_OPENING,
    build_visual_prompt,
    resolve_source_image_bytes,
)

_CV = {
    "faceShape": {"shape": "oval"},
    "hair": {"hairline": "average"},
    "skin": {"tone": "medium"},
}


def test_build_visual_prompt_hair_is_identity_preserving():
    prompt = build_visual_prompt(
        "hair",
        {"ageRange": "25-34", "gender": "female", "goals": ["glow"]},
        _CV,
        {"visualAge": 28},
    )
    assert SHARED_VISUAL_OPENING in prompt
    assert "exact same person" in prompt
    assert "Change only the hairstyle" in prompt
    fence_idx = prompt.index("Change only the hairstyle")
    give_idx = prompt.index("Give this person")
    assert fence_idx < give_idx
    assert "this oval face" in prompt
    assert "a average hairline" in prompt
    assert "barbershop-or-salon" in prompt
    assert "Client:" not in prompt
    assert "Context:" not in prompt
    assert "surgical" in prompt.lower()


def test_build_visual_prompt_outfit_scope_and_anchors():
    prompt = build_visual_prompt("outfit", {}, _CV, None)
    assert SHARED_VISUAL_OPENING in prompt
    assert "Change only the clothing" in prompt
    fence_idx = prompt.index("Change only the clothing")
    dress_idx = prompt.index("Dress this person")
    assert fence_idx < dress_idx
    assert "their medium skin tone" in prompt
    assert "this oval face" in prompt
    assert "Client:" not in prompt
    assert "Context:" not in prompt


def test_build_visual_prompt_aging_skin_only():
    prompt = build_visual_prompt("aging", {}, _CV, None)
    assert SHARED_VISUAL_OPENING in prompt
    assert "8-12 years" in prompt
    assert "skin maturation only" in prompt
    assert "recognizable as themselves" in prompt
    assert "fear-based aging look" in prompt
    assert "hairstyle" not in prompt.lower()
    assert "clothing" not in prompt.lower()
    assert "Client:" not in prompt
    assert "Context:" not in prompt


def test_build_visual_prompt_empty_cv_uses_fallback_phrases():
    hair = build_visual_prompt("hair", {}, {}, None)
    assert "their face shape" in hair
    assert "their hairline" in hair
    assert "unknown" not in hair.lower()

    outfit = build_visual_prompt("outfit", {}, {"faceShape": {"shape": "unknown"}}, None)
    assert "their skin tone" in outfit
    assert "their face shape" in outfit
    assert "unknown" not in outfit.lower()


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
