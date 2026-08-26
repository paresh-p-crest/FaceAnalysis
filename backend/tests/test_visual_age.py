"""Unit tests for skin-heuristic visual age."""

from backend.visual_age import (
    estimate_visual_age,
    parse_age_range_bounds,
    parse_age_range_midpoint,
)


def test_parse_age_range_bounds_and_midpoint():
    assert parse_age_range_bounds("25-34") == {"lo": 25, "hi": 34}
    assert parse_age_range_midpoint("25-34") == 30
    assert parse_age_range_bounds("55+") == {"lo": 55, "hi": 70}
    assert parse_age_range_midpoint("55+") == 62
    assert parse_age_range_bounds("") is None
    assert parse_age_range_midpoint(None) is None


def test_missing_age_range_defaults_to_28():
    out = estimate_visual_age({}, {"dataSource": "fallback"})
    assert out["visualAge"] == 28
    assert out["visualAgeSource"] == "skin-heuristic"


def test_mild_texture_image_only_is_28():
    """Calibration case: RIN 0.11 + bright under-eye → default base, no nudge."""
    skin = {
        "dataSource": "measured",
        "roughnessRin": 0.11,
        "faceLuminance": 146.4,
        "underEyeLuminance": 176.3,
    }
    out = estimate_visual_age({}, skin)
    assert out["visualAge"] == 28


def test_mild_texture_with_age_range_still_28():
    """CLI-like base 28; ageRange only clamps, does not set base."""
    skin = {
        "dataSource": "measured",
        "roughnessRin": 0.11,
        "faceLuminance": 146.4,
        "underEyeLuminance": 176.3,
    }
    out = estimate_visual_age({"ageRange": "25-34"}, skin)
    assert out["visualAge"] == 28


def test_roughness_and_under_eye_nudge_older():
    skin = {
        "dataSource": "measured",
        "roughnessRin": 0.17,  # +3 vs 0.11
        "faceLuminance": 100.0,
        "underEyeLuminance": 85.0,  # ratio 0.85 → +4
    }
    out = estimate_visual_age({"ageRange": "25-34"}, skin)
    # base 28 + 3 + 4 = 35, within ±8 of midpoint 30
    assert out["visualAge"] == 35


def test_soft_prior_clamp_pm8():
    skin = {
        "dataSource": "measured",
        "roughnessRin": 0.30,  # large positive nudge
        "faceLuminance": 100.0,
        "underEyeLuminance": 80.0,
    }
    out = estimate_visual_age({"ageRange": "25-34"}, skin)
    # raw would be 28+10+4=42; clamped to midpoint 30+8
    assert out["visualAge"] == 38


def test_fallback_skin_clamped_up_to_midpoint_band():
    out = estimate_visual_age(
        {"ageRange": "45-54"},
        {
            "dataSource": "fallback",
            "roughnessRin": 0.30,
            "faceLuminance": 100.0,
            "underEyeLuminance": 50.0,
        },
    )
    # base 28, no nudges; midpoint 50 → clamp [42, 58] raises floor to 42
    assert out["visualAge"] == 42
