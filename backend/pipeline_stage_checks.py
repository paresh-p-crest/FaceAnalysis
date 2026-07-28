"""Pipeline stage completion checks — skip stages on non-force retry when output is complete."""

from __future__ import annotations

from .photo_storage import load_projected_full
from .projected_after_ai import projected_after_enabled
from .protocol_service import is_narratives_complete
from .visual_generation import VARIANT_TYPES, _style_specs_for_type


def narratives_stage_complete(assessment: dict) -> bool:
    """Executive narrative + full non-template feature bundle."""
    return is_narratives_complete(assessment)


def projected_after_stage_complete(assessment: dict) -> bool:
    """ready + file on disk, or skipped / feature disabled."""
    if not projected_after_enabled():
        return True
    projected = assessment.get("projectedAfter") or {}
    status = projected.get("status") or ""
    if status == "skipped":
        return True
    if status != "ready":
        return False
    assessment_id = assessment.get("id")
    if not assessment_id:
        return False
    return bool(load_projected_full(assessment_id, projected))


def ai_visuals_stage_complete(assessment: dict, cv_report: dict, answers: dict) -> bool:
    """Each expected styleId is generated with imageSrc.

    outfitBaseline is not required while white-tee generation is temporarily disabled.
    """
    if not cv_report:
        return False
    ai_visuals = assessment.get("aiVisuals") or {}
    variants = ai_visuals.get("variants") or []
    if not isinstance(variants, list):
        return False
    by_style = {
        v.get("styleId"): v
        for v in variants
        if isinstance(v, dict) and v.get("styleId")
    }
    answers = answers or {}
    cv_report = cv_report or {}
    any_expected = False
    for variant_type in VARIANT_TYPES:
        specs = _style_specs_for_type(variant_type, cv_report, answers)
        if not specs:
            continue
        any_expected = True
        for spec in specs:
            variant = by_style.get(spec.style_id)
            if not variant or variant.get("status") != "generated" or not variant.get("imageSrc"):
                return False
    if not any_expected:
        return False
    # Temporarily disabled with white-tee outfitBaseline generation.
    # outfit_specs = _style_specs_for_type("outfit", cv_report, answers)
    # if outfit_specs:
    #     baseline = ai_visuals.get("outfitBaseline") or {}
    #     if baseline.get("status") != "generated" or not baseline.get("imageSrc"):
    #         return False
    return True


def parsing_stage_complete(assessment: dict) -> bool:
    """featureParsing ready with non-empty crops."""
    feature_parsing = assessment.get("featureParsing") or {}
    if feature_parsing.get("status") != "ready":
        return False
    crops = feature_parsing.get("crops") or {}
    return bool(crops)
