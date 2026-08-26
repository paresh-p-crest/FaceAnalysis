"""Skin-heuristic facial age from questionnaire prior + LAB skin signals.

Not a learned apparent-age model. Overwritten onto metrics after build_cv_report.
"""

from __future__ import annotations

from typing import Any, Optional

DEFAULT_BASE_AGE = 28
AGE_MIN = 18
AGE_MAX = 65
SOFT_PRIOR_SPAN = 8
# Calibrated so mildly textured faces (RIN ~0.11) sit at the default base.
NEUTRAL_ROUGHNESS_RIN = 0.11
VISUAL_AGE_SOURCE = "skin-heuristic"


def parse_age_range_bounds(age_range: Any) -> Optional[dict[str, int]]:
    """Inclusive band from questionnaire (`25-34` → lo/hi, `55+` → lo + 15)."""
    if age_range is None or age_range == "":
        return None
    s = str(age_range).strip()
    if s.endswith("+"):
        try:
            n = int(s[:-1].strip() or s[:-1])
        except ValueError:
            return None
        if n < 0:
            return None
        return {"lo": n, "hi": n + 15}
    for sep in ("-", "–"):
        if sep in s:
            parts = s.split(sep, 1)
            if len(parts) != 2:
                continue
            try:
                lo = int(parts[0].strip())
                hi = int(parts[1].strip())
            except ValueError:
                return None
            if hi < lo:
                return None
            return {"lo": lo, "hi": hi}
    return None


def parse_age_range_midpoint(age_range: Any) -> Optional[int]:
    bounds = parse_age_range_bounds(age_range)
    if not bounds:
        return None
    return int(round((bounds["lo"] + bounds["hi"]) / 2))


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _roughness_delta(roughness_rin: float) -> int:
    # ~±1 year per 0.02 RIN from neutral 0.11
    delta = round((roughness_rin - NEUTRAL_ROUGHNESS_RIN) / 0.02)
    return int(_clamp(delta, -6, 10))


def _under_eye_delta(face_l: float, under_eye_l: float) -> int:
    if face_l <= 0 or under_eye_l <= 0:
        return 0
    ratio = under_eye_l / face_l
    if ratio < 0.90:
        return 4
    if ratio < 0.95:
        return 2
    return 0


def estimate_visual_age(
    answers: Optional[dict] = None,
    skin: Optional[dict] = None,
) -> dict[str, Any]:
    """Return visualAge (int) + visualAgeSource from skin LAB (+ optional ageRange clamp).

    Base is always DEFAULT_BASE_AGE (same as CLI image-only). Questionnaire ageRange
    only soft-clamps the result to midpoint ± SOFT_PRIOR_SPAN when present.
    """
    answers = answers or {}
    skin = skin or {}
    midpoint = parse_age_range_midpoint(answers.get("ageRange"))
    base = DEFAULT_BASE_AGE

    roughness_delta = 0
    ue_delta = 0
    if skin.get("dataSource") != "fallback":
        try:
            rin = float(skin.get("roughnessRin") or NEUTRAL_ROUGHNESS_RIN)
        except (TypeError, ValueError):
            rin = NEUTRAL_ROUGHNESS_RIN
        roughness_delta = _roughness_delta(rin)
        try:
            face_l = float(skin.get("faceLuminance") or 0)
            under_eye_l = float(skin.get("underEyeLuminance") or 0)
        except (TypeError, ValueError):
            face_l, under_eye_l = 0.0, 0.0
        ue_delta = _under_eye_delta(face_l, under_eye_l)

    raw = float(base + roughness_delta + ue_delta)
    if midpoint is not None:
        raw = _clamp(raw, midpoint - SOFT_PRIOR_SPAN, midpoint + SOFT_PRIOR_SPAN)

    visual_age = int(round(_clamp(raw, AGE_MIN, AGE_MAX)))
    return {
        "visualAge": visual_age,
        "visualAgeSource": VISUAL_AGE_SOURCE,
    }
