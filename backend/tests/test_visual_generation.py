"""Tests for AI visual source resolution and prompts."""

import asyncio
import base64

import pytest

from backend.media_storage import assessment_key, get_media_storage
from backend.visual_style_banks import (
    AgingTierSpec,
    HairStyleSpec,
    OutfitStyleSpec,
    OUTFIT_STYLES,
    AGING_TIERS,
    hair_styles_for,
)
from backend.visual_generation import (
    SHARED_VISUAL_OPENING,
    build_visual_prompt,
    generate_visual_variants,
    resolve_source_image_bytes,
)

_CV = {
    "faceShape": {"shape": "oval"},
    "hair": {"hairline": "average", "hairColor": "Brown", "textureType": "Wavy"},
    "skin": {"skinTone": "medium", "tone": "Noticeably uneven"},
}


def test_build_visual_prompt_hair_is_identity_preserving():
    style = HairStyleSpec(
        style_id="textured_crop",
        display_name="Textured Crop",
        descriptor="short, choppy layers with natural movement on top and clean tapered sides",
    )
    prompt = build_visual_prompt(
        "hair",
        style,
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
    assert "brown wavy hair" in prompt
    assert "keep the same color and natural texture" in prompt
    assert "Keep the same hair color as the source" not in prompt
    assert "Textured Crop" in prompt
    assert "Client:" not in prompt
    assert "Context:" not in prompt
    assert "surgical" in prompt.lower()


def test_build_visual_prompt_outfit_scope_and_anchors():
    style = OUTFIT_STYLES[0]
    prompt = build_visual_prompt("outfit", style, {}, _CV, None)
    assert SHARED_VISUAL_OPENING in prompt
    assert "Change only the clothing" in prompt
    fence_idx = prompt.index("Change only the clothing")
    dress_idx = prompt.index("Dress this person")
    assert fence_idx < dress_idx
    assert "their medium skin tone" in prompt
    assert "noticeably uneven" not in prompt.lower()
    assert "this oval face" in prompt
    assert "Client:" not in prompt
    assert "Context:" not in prompt


def test_build_visual_prompt_aging_multi_axis_dark_hair():
    style = AGING_TIERS[1]
    prompt = build_visual_prompt("aging", style, {}, _CV, None)
    assert SHARED_VISUAL_OPENING in prompt
    assert "about 5 years" in prompt
    assert "skin, hair, and soft tissue" in prompt
    assert "Skin: fine lines beginning at eyes and forehead" in prompt
    assert "Hair: subtle early graying at temples" in prompt
    assert "Soft tissue: very subtle softening under the eyes only" in prompt
    assert "preserve bone structure, eye shape, and facial proportions exactly" in prompt
    assert "recognizable as themselves" in prompt
    assert "fear-based aging look" in prompt
    assert "Skin maturation only" not in prompt
    assert "hairstyle" not in prompt.lower()
    assert "clothing" not in prompt.lower()
    assert "Client:" not in prompt
    assert "Context:" not in prompt


def test_build_visual_prompt_aging_light_hair_skips_graying():
    style = AGING_TIERS[1]
    cv = {
        **_CV,
        "hair": {"hairline": "average", "hairColor": "Blonde", "textureType": "Straight"},
    }
    prompt = build_visual_prompt("aging", style, {}, cv, None)
    assert "Hair: no change to hair color or density" in prompt
    assert "graying" not in prompt.lower()


def test_build_visual_prompt_aging_ten_year_guards():
    style = AGING_TIERS[2]
    prompt = build_visual_prompt("aging", style, {}, _CV, None)
    assert "no sagging or jowls" in prompt
    assert "baldness patterns not already present" in prompt


def test_build_visual_prompt_empty_cv_uses_fallback_phrases():
    style = HairStyleSpec(
        style_id="any",
        display_name="Textured Crop",
        descriptor="short, choppy layers",
    )
    hair = build_visual_prompt("hair", style, {}, {}, None)
    assert "their face shape" in hair
    assert "their hairline" in hair
    assert "keep the same color and natural texture" in hair
    assert "unknown" not in hair.lower()

    outfit = build_visual_prompt(
        "outfit",
        OUTFIT_STYLES[0],
        {},
        {"faceShape": {"shape": "unknown"}},
        None,
    )
    assert "their skin tone" in outfit
    assert "their face shape" in outfit
    assert "unknown" not in outfit.lower()


def test_build_visual_prompt_outfit_ignores_skin_evenness_label():
    """Regression: skin.tone is evenness, not color — must not surface in outfit."""
    cv = {
        "faceShape": {"shape": "oval"},
        "skin": {"skinTone": "Medium", "tone": "Noticeably uneven"},
    }
    prompt = build_visual_prompt("outfit", OUTFIT_STYLES[0], {}, cv, None)
    assert "their medium skin tone" in prompt
    assert "noticeably uneven" not in prompt.lower()


def test_build_visual_prompt_rejects_unknown_type():
    with pytest.raises(ValueError):
        build_visual_prompt(
            "laser",
            HairStyleSpec("x", "X", "x"),
            {},
            {},
            None,
        )


def test_hair_styles_for_covers_all_cv_face_shapes():
    shapes = ["Oval", "Round", "Square", "Heart", "Oblong"]
    for shape in shapes:
        styles = hair_styles_for({"faceShape": {"shape": shape}})
        assert len(styles) == 5
        assert len({s.style_id for s in styles}) == 5


def test_hair_styles_for_heart_not_oval_bank():
    heart_styles = hair_styles_for({"faceShape": {"shape": "Heart"}})
    oval_styles = hair_styles_for({"faceShape": {"shape": "Oval"}})

    heart_ids = {s.style_id for s in heart_styles}
    oval_ids = {s.style_id for s in oval_styles}

    # Regression guard: we should never silently map Heart -> Oval bank.
    assert heart_ids != oval_ids


def test_outfit_bank_has_five_distinct_occasions():
    assert len(OUTFIT_STYLES) == 5
    occasions = {s.occasion_name for s in OUTFIT_STYLES}
    assert len(occasions) == 5


def test_aging_tiers_have_distinct_skin_and_soft_tissue():
    assert [t.years for t in AGING_TIERS] == [3, 5, 10]
    skins = {t.skin_text for t in AGING_TIERS}
    soft = {t.soft_tissue_text for t in AGING_TIERS}
    assert len(skins) == 3
    assert len(soft) == 3


def test_style_specs_respect_env_variant_counts(monkeypatch):
    import backend.visual_generation as vg

    monkeypatch.setattr(
        vg,
        "_VARIANT_COUNT_BY_TYPE",
        {"hair": 2, "outfit": 1, "aging": 1},
    )
    cv = {"faceShape": {"shape": "Oval"}}
    assert len(vg._style_specs_for_type("hair", cv)) == 2
    assert len(vg._style_specs_for_type("outfit", cv)) == 1
    assert len(vg._style_specs_for_type("aging", cv)) == 1


def test_generate_visual_variants_all_thirteen(monkeypatch):
    import backend.visual_generation as vg

    assessment_id = "viztest13"
    get_media_storage().put_bytes(
        assessment_key(assessment_id, "front.jpg"),
        b"\xff\xd8\xff" + b"3" * 250 + b"\xff\xd9",
    )

    cv_report = {
        "faceShape": {"shape": "Oval"},
        "hair": {"hairline": "average", "hairColor": "Brown", "textureType": "Wavy"},
        "skin": {"skinTone": "medium", "tone": "Noticeably uneven"},
    }

    async def _fake_generate_image_edit(prompt, image_bytes, *, log_label=None):
        return {"dataUrl": "data:image/png;base64,AAA", "error": None}

    monkeypatch.setattr(vg, "generate_image_edit", _fake_generate_image_edit)
    monkeypatch.setattr(vg, "resolve_image_provider", lambda: "openai")
    monkeypatch.setattr(vg, "has_image_api_key", lambda provider=None: True)
    monkeypatch.setattr(vg, "_image_model", lambda *args, **kwargs: "mock-model")

    result = asyncio.run(
        vg.generate_visual_variants(
            answers={},
            cv_report=cv_report,
            metrics=None,
            variant_types=["hair", "outfit", "aging"],
            assessment_id=assessment_id,
            require_projected_after=False,
        )
    )

    variants = result["variants"]
    assert len(variants) == 13
    assert result["sourceKind"] == "assessment_front_file"
    assert result["variantCounts"] == {"hair": 5, "outfit": 5, "aging": 3}

    counts = {"hair": 5, "outfit": 5, "aging": 3}
    for t, n in counts.items():
        assert sum(1 for v in variants if v["type"] == t) == n

    assert all(v.get("styleId") for v in variants)
    assert len({v["prompt"] for v in variants}) == 13
    aging_ids = {v["styleId"] for v in variants if v["type"] == "aging"}
    assert aging_ids == {"aging_3", "aging_5", "aging_10"}


def test_generate_visual_variants_blocks_without_front(monkeypatch):
    import backend.visual_generation as vg

    assessment_id = "viznofront"

    monkeypatch.setattr(vg, "resolve_image_provider", lambda: "openai")
    monkeypatch.setattr(vg, "has_image_api_key", lambda provider=None: True)
    monkeypatch.setattr(vg, "_image_model", lambda *args, **kwargs: "mock-model")

    result = asyncio.run(
        vg.generate_visual_variants(
            answers={},
            cv_report={"faceShape": {"shape": "Oval"}},
            metrics=None,
            assessment_id=assessment_id,
            require_projected_after=False,
        )
    )

    assert result["sourceKind"] is None
    assert all(v["status"] == "blocked" for v in result["variants"])


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


def test_resolve_prefers_front_even_when_projected_after_exists():
    assessment_id = "projviz1"
    front_bytes = b"\xff\xd8\xff" + b"0" * 200 + b"\xff\xd9"
    after_bytes = b"\xff\xd8\xff" + b"9" * 200 + b"\xff\xd9"
    get_media_storage().put_bytes(assessment_key(assessment_id, "front.jpg"), front_bytes)
    get_media_storage().put_bytes(assessment_key(assessment_id, "projected", "full.jpg"), after_bytes)

    data, kind = resolve_source_image_bytes(assessment_id=assessment_id)
    assert kind == "assessment_front_file"
    assert data == front_bytes
    assert data != after_bytes


def test_resolve_data_url():
    raw = b"\xff\xd8\xff" + b"1" * 120 + b"\xff\xd9"
    data_url = "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")

    data, kind = resolve_source_image_bytes(source_image=data_url)
    assert kind == "data_url"
    assert data.startswith(b"\xff\xd8")


def test_resolve_rejects_public_url_as_base64():
    """Regression: /uploads/... (missing object) must not be base64-decoded."""
    data, kind = resolve_source_image_bytes(
        source_image="/api/media/assessments/missing-assessment-id/front.jpg",
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
        source_image=f"/api/media/assessments/{assessment_id}/front.jpg",
        require_projected_after=False,
    )
    assert kind == "cv_report_url_file"
    assert data.startswith(b"\xff\xd8")
