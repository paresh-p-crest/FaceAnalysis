"""Landing package + add-on → persisted user entitlements."""

from __future__ import annotations

import logging
from typing import Any, Iterable

from fastapi import HTTPException

logger = logging.getLogger(__name__)

VALID_PACKAGE_IDS = frozenset({"analyse", "premium", "duo"})
VALID_ADDON_IDS = frozenset(
    {"color", "beauty", "hairstyle", "express", "skincare", "styling", "antiaging"}
)
PREMIUM_STANDARD_ADDONS = ("color", "beauty", "hairstyle", "express")

# Analyse / Premium: 1 submitted analysis. Duo: 2 (household account, shared login).
PACKAGE_ANALYSIS_SLOTS = {
    "analyse": 1,
    "premium": 1,
    "duo": 2,
}
DEFAULT_ANALYSIS_SLOTS = 1

ADDON_TO_FLAGS: dict[str, tuple[str, ...]] = {
    "beauty": ("beauty_assistant",),
    "color": ("ai_visuals_outfit",),
    "hairstyle": ("ai_visuals_hair",),
    "styling": ("ai_visuals_hair", "ai_visuals_outfit"),
    "antiaging": ("ai_visuals_aging",),
    "skincare": ("skincare_plan",),
    "express": ("express_review",),
}

ALL_FLAGS = (
    "analysis",
    "report",
    "beauty_assistant",
    "ai_visuals_hair",
    "ai_visuals_outfit",
    "ai_visuals_aging",
    "skincare_plan",
    "express_review",
)

VARIANT_ENTITLEMENT_FLAG = {
    "hair": "ai_visuals_hair",
    "outfit": "ai_visuals_outfit",
    "aging": "ai_visuals_aging",
}


def empty_entitlements() -> dict[str, Any]:
    return {
        "packageIds": [],
        "addonIds": [],
        "analysisSlots": DEFAULT_ANALYSIS_SLOTS,
        "flags": {flag: False for flag in ALL_FLAGS},
    }


def full_entitlements(*, reason: str = "incomplete_package_info") -> dict[str, Any]:
    """Temporary permissive unlock when package/add-on details are missing."""
    return {
        "packageIds": [],
        "addonIds": sorted(VALID_ADDON_IDS),
        "analysisSlots": PACKAGE_ANALYSIS_SLOTS["duo"],
        "incompletePackageInfo": True,
        "incompleteReason": reason,
        "flags": {flag: True for flag in ALL_FLAGS},
    }


def analysis_slots_for_packages(package_ids: Iterable[str]) -> int:
    slots = DEFAULT_ANALYSIS_SLOTS
    for pid in package_ids:
        slots = max(slots, PACKAGE_ANALYSIS_SLOTS.get(pid, DEFAULT_ANALYSIS_SLOTS))
    return slots


def max_analysis_slots_for_user(user: dict | None) -> int:
    """Resolve submitted-assessment cap from user entitlements."""
    if not user:
        return DEFAULT_ANALYSIS_SLOTS
    if user.get("role") == "admin":
        return 10_000
    ents = user.get("entitlements") or {}
    raw_slots = ents.get("analysisSlots")
    if isinstance(raw_slots, int) and raw_slots > 0:
        return raw_slots
    return analysis_slots_for_packages(ents.get("packageIds") or [])


def normalize_addon_ids(raw: Any) -> list[str]:
    """Trim, dedupe, and keep only allowlisted add-on ids (unknown tokens stripped)."""
    tokens: list[str] = []
    if raw is None or raw == "":
        return []
    if isinstance(raw, str):
        tokens = [part.strip() for part in raw.split(",")]
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                tokens.append(item.strip())
    else:
        return []

    seen: set[str] = set()
    out: list[str] = []
    for token in tokens:
        if not token or token == "premium":
            continue
        normalized = token.lower()
        if normalized in seen:
            continue
        if normalized not in VALID_ADDON_IDS:
            logger.warning("Stripped unknown landing add-on id: %s", token)
            continue
        seen.add(normalized)
        out.append(normalized)
    return sorted(out)


def effective_addon_ids(product_id: str, normalized_addon_ids: Iterable[str]) -> list[str]:
    """Apply package rules (Premium auto-includes standard checkout add-ons).

    Duo is treated like Analyse for add-ons: only explicitly sent add-ons apply
    (no auto-expansion). Landing should send purchased add-ons when present.
    """
    effective = set(normalized_addon_ids)
    if product_id == "premium":
        effective.update(PREMIUM_STANDARD_ADDONS)
    return sorted(effective)


def entitlements_from_effective(product_id: str, effective: Iterable[str]) -> dict[str, Any]:
    flags = {flag: False for flag in ALL_FLAGS}
    flags["analysis"] = True
    flags["report"] = True
    for addon in effective:
        for flag in ADDON_TO_FLAGS.get(addon, ()):
            flags[flag] = True
    return {
        "packageIds": [product_id],
        "addonIds": sorted(set(effective)),
        "analysisSlots": PACKAGE_ANALYSIS_SLOTS.get(product_id, DEFAULT_ANALYSIS_SLOTS),
        "flags": flags,
    }


def entitlements_from_package_and_addons(product_id: str, addon_ids: Iterable[str]) -> dict[str, Any]:
    effective = effective_addon_ids(product_id, addon_ids)
    return entitlements_from_effective(product_id, effective)


def merge_entitlements(*ents: dict[str, Any]) -> dict[str, Any]:
    package_ids: set[str] = set()
    addon_ids: set[str] = set()
    flags = {flag: False for flag in ALL_FLAGS}
    slots = DEFAULT_ANALYSIS_SLOTS
    incomplete = False
    incomplete_reason = None
    for ent in ents:
        if not ent:
            continue
        package_ids.update(ent.get("packageIds") or [])
        addon_ids.update(ent.get("addonIds") or [])
        raw_slots = ent.get("analysisSlots")
        if isinstance(raw_slots, int) and raw_slots > 0:
            slots = max(slots, raw_slots)
        if ent.get("incompletePackageInfo"):
            incomplete = True
            incomplete_reason = ent.get("incompleteReason") or incomplete_reason
        for flag, enabled in (ent.get("flags") or {}).items():
            if enabled:
                flags[flag] = True
    slots = max(slots, analysis_slots_for_packages(package_ids))
    out: dict[str, Any] = {
        "packageIds": sorted(package_ids),
        "addonIds": sorted(addon_ids),
        "analysisSlots": slots,
        "flags": flags,
    }
    if incomplete:
        out["incompletePackageInfo"] = True
        if incomplete_reason:
            out["incompleteReason"] = incomplete_reason
    return out


def entitlements_from_payment(*, plan_id: str, raw: dict[str, Any] | None) -> dict[str, Any] | None:
    """Build entitlements for one paid landing payment row."""
    raw = raw or {}
    if raw.get("incompletePackageInfo"):
        return full_entitlements(reason=str(raw.get("incompleteReason") or "incomplete_package_info"))

    product_id = raw.get("packageId") or plan_id
    if not product_id or product_id not in VALID_PACKAGE_IDS:
        # Paid import without a usable package → temporary full unlock.
        return full_entitlements(reason="missing_or_unknown_package")

    effective = raw.get("effectiveAddonIds")
    if isinstance(effective, list) and effective:
        return entitlements_from_effective(product_id, effective)
    addon_ids = raw.get("addonIds")
    if not isinstance(addon_ids, list):
        meta = raw.get("metadata") or {}
        addon_ids = normalize_addon_ids(meta.get("addons"))
    return entitlements_from_package_and_addons(product_id, addon_ids or [])


def user_has_flag(user: dict | None, flag: str) -> bool:
    if not user:
        return False
    if user.get("role") == "admin":
        return True
    flags = (user.get("entitlements") or {}).get("flags") or {}
    return bool(flags.get(flag))


def user_has_any_visuals_flag(user: dict | None) -> bool:
    return any(user_has_flag(user, f"ai_visuals_{kind}") for kind in ("hair", "outfit", "aging"))


def require_entitlement_flag(current_user: dict, flag: str) -> None:
    if not current_user or not current_user.get("id"):
        raise HTTPException(status_code=401, detail="Authentication required.")
    if not user_has_flag(current_user, flag):
        raise HTTPException(
            status_code=403,
            detail="This feature is not included in your package.",
        )


def require_visual_variant(current_user: dict, variant_type: str) -> None:
    flag = VARIANT_ENTITLEMENT_FLAG.get(variant_type)
    if not flag:
        raise HTTPException(status_code=400, detail=f"Unknown visual variant: {variant_type}")
    require_entitlement_flag(current_user, flag)
