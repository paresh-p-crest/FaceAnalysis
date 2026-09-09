"""Entitlement catalog and landing add-on normalization."""

from backend.entitlements import (
    effective_addon_ids,
    entitlements_from_package_and_addons,
    merge_entitlements,
    normalize_addon_ids,
    user_has_flag,
)


def test_normalize_addon_ids_from_string():
    assert normalize_addon_ids("color,express") == ["color", "express"]
    assert normalize_addon_ids("") == []
    assert normalize_addon_ids(None) == []


def test_normalize_addon_ids_strips_unknown():
    assert normalize_addon_ids(["color", "trio", "premium"]) == ["color"]


def test_premium_expands_standard_addons():
    effective = effective_addon_ids("premium", [])
    assert effective == ["beauty", "color", "express", "hairstyle"]
    ent = entitlements_from_package_and_addons("premium", [])
    flags = ent["flags"]
    assert flags["beauty_assistant"] is True
    assert flags["ai_visuals_hair"] is True
    assert flags["ai_visuals_outfit"] is True
    assert flags["express_review"] is True
    assert flags["analysis"] is True
    assert flags["report"] is True


def test_analyse_with_selected_addons():
    ent = entitlements_from_package_and_addons("analyse", normalize_addon_ids("color,express"))
    flags = ent["flags"]
    assert flags["ai_visuals_outfit"] is True
    assert flags["express_review"] is True
    assert flags["beauty_assistant"] is False
    assert flags["ai_visuals_hair"] is False


def test_merge_entitlements_unions_flags():
    a = entitlements_from_package_and_addons("analyse", ["color"])
    b = entitlements_from_package_and_addons("analyse", ["beauty"])
    merged = merge_entitlements(a, b)
    assert merged["flags"]["ai_visuals_outfit"] is True
    assert merged["flags"]["beauty_assistant"] is True


def test_user_has_flag_admin_bypass():
    assert user_has_flag({"role": "admin", "entitlements": {"flags": {}}}, "beauty_assistant") is True


def test_user_has_flag_from_entitlements():
    user = {"role": "user", "entitlements": {"flags": {"beauty_assistant": True}}}
    assert user_has_flag(user, "beauty_assistant") is True
    assert user_has_flag(user, "ai_visuals_hair") is False
