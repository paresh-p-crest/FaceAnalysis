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
    outfit_styles_for,
    resolve_style_preference,
)
from backend.visual_generation import (
    SHARED_VISUAL_OPENING,
    build_outfit_baseline_prompt,
    build_visual_prompt,
    find_style_by_id,
    generate_visual_variants,
    merge_ai_visuals,
    resolve_source_image_bytes,
)

_CV = {
    "faceShape": {"shape": "oval"},
    "hair": {"hairline": "average", "hairColor": "Brown", "textureType": "Wavy"},
    "skin": {"skinTone": "medium", "tone": "Noticeably uneven"},
}

_FAKE_EDIT_DATA_URL = (
    "data:image/png;base64,"
    + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"x" * 24).decode("ascii")
)


def test_build_outfit_baseline_prompt_strict_white_tee():
    prompt = build_outfit_baseline_prompt()
    assert "plain simple white crew-neck t-shirt" in prompt
    assert "Leave the face and hair exactly as they are" in prompt
    assert "camera distance" not in prompt.lower()
    assert "exact same person" in prompt


def test_build_visual_prompt_hair_is_identity_preserving():
    style = HairStyleSpec(
        style_id="textured_crop",
        display_name="Textured Crop",
        descriptor="short, choppy layers with natural movement on top and clean tapered sides",
    )
    prompt = build_visual_prompt(
        "hair",
        style,
        {"ageRange": "25-34", "genderPreference": "feminine", "goals": ["glow"]},
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
    assert "brown wavy hair" not in prompt
    assert "preserve the exact hair color" in prompt
    assert "do not dye, bleach, lighten, darken" in prompt
    assert "unless the style specifically calls for it" not in prompt
    assert "Textured Crop" in prompt
    assert "Client:" not in prompt
    assert "Context:" not in prompt
    assert "surgical" in prompt.lower()


def test_build_visual_prompt_hair_omits_cv_hair_color():
    style = HairStyleSpec(
        style_id="soft_layered_bob",
        display_name="Soft Layered Bob",
        descriptor="a soft layered bob",
    )
    prompt = build_visual_prompt("hair", style, {"genderPreference": "feminine"}, _CV, None)
    assert "brown" not in prompt.lower()
    assert "wavy hair" not in prompt.lower()
    assert "preserve the exact hair color and natural texture from the reference image" in prompt


def test_resolve_style_preference_order():
    assert resolve_style_preference({"genderPreference": "feminine"}) == "feminine"
    assert resolve_style_preference({"genderPreference": "masculine"}) == "masculine"
    assert resolve_style_preference({"genderPreference": "no-preference"}) == "no-preference"
    assert resolve_style_preference({"genderPreference": "no-preference", "growBeard": "yes"}) == "masculine"
    assert resolve_style_preference({"growBeard": "yes"}) == "masculine"
    assert resolve_style_preference({"genderPreference": "feminine", "growBeard": "yes"}) == "feminine"
    assert resolve_style_preference({}) == "no-preference"


def test_hair_styles_for_preference_banks():
    cv = {"faceShape": {"shape": "Oval"}}
    masc = hair_styles_for(cv, {"genderPreference": "masculine"})
    fem = hair_styles_for(cv, {"genderPreference": "feminine"})
    neutral = hair_styles_for(cv, {"genderPreference": "no-preference"})
    assert {s.style_id for s in masc} != {s.style_id for s in fem}
    assert any(s.style_id == "buzz_crew_cut" for s in masc)
    assert not any(s.style_id == "buzz_crew_cut" for s in fem)
    assert any(s.style_id == "soft_layered_bob" for s in fem)
    assert any(s.style_id == "medium_soft_layers" for s in neutral)


def test_outfit_styles_for_preference_descriptors():
    masc = outfit_styles_for({"genderPreference": "masculine"})
    fem = outfit_styles_for({"genderPreference": "feminine"})
    assert masc[0].style_id == fem[0].style_id == "professional"
    assert "blouse" in fem[0].descriptor
    assert "blouse" not in masc[0].descriptor
    assert "shirt" in masc[0].descriptor


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
    assert "preserve the exact hair color" in hair
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
        return {"dataUrl": _FAKE_EDIT_DATA_URL, "error": None}

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
    assert all(
        str(v.get("imageSrc") or "").startswith("/api/media/")
        for v in variants
        if v.get("imageSrc")
    )
    assert result.get("outfitBaseline") is not None
    assert "white crew-neck t-shirt" in result["outfitBaseline"]["prompt"]
    baseline_src = result["outfitBaseline"].get("imageSrc")
    assert baseline_src and str(baseline_src).startswith("/api/media/")
    baseline_key = assessment_key(assessment_id, "ai-visuals", "outfit-baseline.jpg")
    assert get_media_storage().get_bytes(baseline_key) is not None


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


def test_merge_ai_visuals_by_style_id_keeps_siblings():
    existing = {
        "source": "openai",
        "model": "old",
        "variants": [
            {"type": "hair", "styleId": "textured_crop", "imageSrc": "old-crop"},
            {"type": "hair", "styleId": "side_part_classic", "imageSrc": "old-side"},
            {"type": "outfit", "styleId": "professional", "imageSrc": "old-outfit"},
        ],
    }
    regenerated = {
        "source": "openai",
        "model": "new",
        "variantCounts": {"hair": 5, "outfit": 5, "aging": 3},
        "variants": [
            {"type": "hair", "styleId": "textured_crop", "imageSrc": "new-crop"},
        ],
    }
    merged = merge_ai_visuals(existing, regenerated, style_id="textured_crop")
    by_id = {v["styleId"]: v for v in merged["variants"]}
    assert by_id["textured_crop"]["imageSrc"] == "new-crop"
    assert by_id["side_part_classic"]["imageSrc"] == "old-side"
    assert by_id["professional"]["imageSrc"] == "old-outfit"
    assert len(merged["variants"]) == 3
    assert merged["model"] == "new"


def test_merge_ai_visuals_by_category_keeps_other_types():
    existing = {
        "variants": [
            {"type": "hair", "styleId": "textured_crop", "imageSrc": "old-hair"},
            {"type": "outfit", "styleId": "professional", "imageSrc": "old-outfit"},
            {"type": "aging", "styleId": "aging_5", "imageSrc": "old-aging"},
        ],
    }
    regenerated = {
        "variants": [
            {"type": "hair", "styleId": "textured_crop", "imageSrc": "new-hair"},
            {"type": "hair", "styleId": "slick_back", "imageSrc": "new-slick"},
        ],
    }
    merged = merge_ai_visuals(existing, regenerated, replaced_types=["hair"])
    types = [v["type"] for v in merged["variants"]]
    assert types.count("hair") == 2
    assert types.count("outfit") == 1
    assert types.count("aging") == 1
    hair = [v for v in merged["variants"] if v["type"] == "hair"]
    assert {v["imageSrc"] for v in hair} == {"new-hair", "new-slick"}


def test_find_style_by_id_and_single_style_generate(monkeypatch):
    import backend.visual_generation as vg

    assessment_id = "vizstyle1"
    get_media_storage().put_bytes(
        assessment_key(assessment_id, "front.jpg"),
        b"\xff\xd8\xff" + b"4" * 250 + b"\xff\xd9",
    )

    variant_type, spec = find_style_by_id("textured_crop", _CV)
    assert variant_type == "hair"
    assert spec.style_id == "textured_crop"

    async def _fake_generate_image_edit(prompt, image_bytes, *, log_label=None):
        return {"dataUrl": _FAKE_EDIT_DATA_URL, "error": None}

    monkeypatch.setattr(vg, "generate_image_edit", _fake_generate_image_edit)
    monkeypatch.setattr(vg, "resolve_image_provider", lambda: "openai")
    monkeypatch.setattr(vg, "has_image_api_key", lambda provider=None: True)
    monkeypatch.setattr(vg, "_image_model", lambda *args, **kwargs: "mock-model")

    result = asyncio.run(
        vg.generate_visual_variants(
            answers={},
            cv_report=_CV,
            metrics=None,
            variant_types=["hair"],
            style_ids=["textured_crop"],
            assessment_id=assessment_id,
            require_projected_after=False,
        )
    )
    assert len(result["variants"]) == 1
    assert result["variants"][0]["styleId"] == "textured_crop"
    assert result["variants"][0]["imageSrc"].startswith("/api/media/")
    assert "outfitBaseline" not in result


def test_generate_visual_variants_without_assessment_id_keeps_data_url(monkeypatch):
    import backend.visual_generation as vg

    async def _fake_generate_image_edit(prompt, image_bytes, *, log_label=None):
        return {"dataUrl": _FAKE_EDIT_DATA_URL, "error": None}

    monkeypatch.setattr(vg, "generate_image_edit", _fake_generate_image_edit)
    monkeypatch.setattr(vg, "resolve_image_provider", lambda: "openai")
    monkeypatch.setattr(vg, "has_image_api_key", lambda provider=None: True)
    monkeypatch.setattr(vg, "_image_model", lambda *args, **kwargs: "mock-model")

    raw = b"\xff\xd8\xff" + b"1" * 120 + b"\xff\xd9"
    data_url = "data:image/jpeg;base64," + base64.b64encode(raw).decode("ascii")

    result = asyncio.run(
        vg.generate_visual_variants(
            answers={},
            cv_report=_CV,
            metrics=None,
            variant_types=["hair"],
            style_ids=["textured_crop"],
            source_image=data_url,
            require_projected_after=False,
        )
    )
    assert result["variants"][0]["imageSrc"] == _FAKE_EDIT_DATA_URL


def test_merge_ai_visuals_hair_regen_preserves_outfit_baseline():
    existing = {
        "variants": [{"type": "hair", "styleId": "textured_crop", "imageSrc": "old-hair"}],
        "outfitBaseline": {"imageSrc": "/api/media/assessments/x/ai-visuals/outfit-baseline.jpg"},
    }
    regenerated = {
        "variants": [{"type": "hair", "styleId": "textured_crop", "imageSrc": "new-hair"}],
    }
    merged = merge_ai_visuals(existing, regenerated, replaced_types=["hair"])
    assert merged["outfitBaseline"]["imageSrc"].endswith("outfit-baseline.jpg")