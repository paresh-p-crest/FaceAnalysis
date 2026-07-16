"""Per-feature context slices for grounded narrative generation."""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from .answer_summary import format_answers_summary
from .recommendation_rules import magnitude_label
from .config import FEATURE_NARRATIVE_IDS

GLOBAL_LIMITATIONS = [
    "2D photograph analysis only; not a medical diagnosis or radiographic assessment.",
    "Lighting, head pose, and camera quality can influence skin and under-eye measurements.",
]


def _strip_binary_fields(obj: Any) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in ("imageSrc", "imageSrcLeft", "imageSrcRight", "eyesCrop", "crop", "overlay"):
                continue
            if isinstance(v, str) and len(v) > 500 and v.startswith("data:"):
                continue
            out[k] = _strip_binary_fields(v)
        return out
    if isinstance(obj, list):
        return [_strip_binary_fields(x) for x in obj]
    return obj


def _hair_slice(cv_report: dict) -> dict:
    return _strip_binary_fields(cv_report.get("hair") or {})


def _eyes_slice(cv_report: dict, eye_analysis: Optional[dict]) -> dict:
    data: dict[str, Any] = {}
    eyes = cv_report.get("eyes")
    if isinstance(eyes, dict) and eyes.get("eyebrows"):
        data["eyesRegion"] = _strip_binary_fields(eyes)
    elif eye_analysis and eye_analysis.get("metrics"):
        data["eyeAnalysis"] = _strip_binary_fields(eye_analysis.get("metrics"))
    brows = cv_report.get("eyebrows")
    if brows:
        data["eyebrows"] = _strip_binary_fields(brows)
    if isinstance(eyes, dict) and eyes.get("score") is not None:
        data["eyes"] = {"score": eyes.get("score"), "scoreLabel": eyes.get("scoreLabel")}
    return data


def _build_eyes_subsection_facts(cv_report: dict, eye_analysis: Optional[dict]) -> dict[str, list[str]]:
    """Per-subsection measured facts for eyes feature page."""
    eyes = cv_report.get("eyes") or {}
    facts: dict[str, list[str]] = {
        "Eyebrows": [],
        "Eyelashes": [],
        "Eyes": [],
        "Under eye": [],
    }
    if isinstance(eyes.get("eyebrows"), dict):
        b = eyes["eyebrows"]
        for key in ("shape", "position", "thickness", "peakHeight", "symmetryScore"):
            if b.get(key) not in (None, ""):
                facts["Eyebrows"].append(f"{key}: {b[key]}")
    if isinstance(eyes.get("eyelashes"), dict):
        l = eyes["eyelashes"]
        for key in ("density", "darkness", "contrastIndex"):
            if l.get(key) not in (None, ""):
                facts["Eyelashes"].append(f"{key}: {l[key]}")
    if isinstance(eyes.get("ocular"), dict):
        o = eyes["ocular"]
        for key in ("eyeTilt", "eyelidExposure", "scleraColor", "lowerLidCurvature"):
            if o.get(key) not in (None, ""):
                facts["Eyes"].append(f"{key}: {o[key]}")
    elif eye_analysis and eye_analysis.get("metrics"):
        m = eye_analysis["metrics"]
        for key in ("eyeTilt", "eyelidExposure", "scleraColor", "lowerLidCurvature"):
            if m.get(key) not in (None, ""):
                facts["Eyes"].append(f"{key}: {m[key]}")
    if isinstance(eyes.get("underEye"), dict):
        u = eyes["underEye"]
        for key in ("hollowing", "pigmentation", "health", "brightness"):
            if u.get(key) not in (None, ""):
                facts["Under eye"].append(f"{key}: {u[key]}")
    return facts


def _feature_cv_slice(feature_id: str, cv_report: dict, eye_analysis: Optional[dict]) -> dict:
    if feature_id == "hair":
        return _hair_slice(cv_report)
    if feature_id == "eyes":
        return _eyes_slice(cv_report, eye_analysis)
    key_map = {
        "nose": "nose",
        "cheeks": "cheeks",
        "jaw": "jaw",
        "lips": "lips",
        "chin": "chin",
        "skin": "skin",
        "neck": "neck",
        "ears": "ears",
        "smile": "smile",
    }
    key = key_map.get(feature_id)
    if not key:
        return {}
    data = cv_report.get(key) or {}
    if feature_id == "chin" and not data:
        data = cv_report.get("jawChin") or {}
    if feature_id == "jaw" and not data.get("score"):
        merged = {**(cv_report.get("jawChin") or {}), **data}
        return _strip_binary_fields(merged)
    return _strip_binary_fields(data)


def _not_measured(feature_id: str, cv_slice: dict, eye_analysis: Optional[dict]) -> list[str]:
    items: list[str] = []
    if feature_id == "eyes":
        items.append("Iris color is not measured; only sclera appearance and periorbital metrics are available.")
    if feature_id == "hair":
        if cv_slice.get("dataSource") == "estimated" or not cv_slice.get("densityPct"):
            items.append("Hair density and color require a top-of-head photo for direct measurement.")
    if feature_id == "skin":
        items.append("Dermoscopic or clinical skin exam findings are not available from photos alone.")
    if feature_id == "smile":
        if cv_slice.get("teethVisibility") in (None, "", "N/A"):
            items.append("Teeth visibility, smile arc, and gum exposure need a dedicated smile photo.")
    return items


def _limitations(feature_id: str, cv_slice: dict, not_measured: list[str]) -> list[str]:
    limits = list(GLOBAL_LIMITATIONS)
    if not_measured:
        limits.extend(not_measured)
    if feature_id == "hair" and cv_slice.get("dataSource") == "estimated":
        limits.append("Hair metrics are estimated from facial proportions when top-of-head photo is missing.")
    if feature_id == "smile" and cv_slice.get("teethVisibility") in (None, "", "N/A"):
        limits.append("Smile dentofacial cues are limited without a clear smile photo showing teeth.")
    return limits


def _contraindications(answers: dict) -> dict[str, Any]:
    profile = format_answers_summary(answers or {})
    flags: list[str] = []
    if answers.get("allergies"):
        flags.append(f"Reported allergies: {answers.get('allergies')}")
    if answers.get("activeInfections"):
        flags.append(f"Active infections/conditions: {answers.get('activeInfections')}")
    if answers.get("usedRetinoids"):
        flags.append(f"Recent retinoid use: {answers.get('usedRetinoids')}")
    if answers.get("medicalConditions"):
        flags.append(f"Medical conditions: {answers.get('medicalConditions')}")
    if answers.get("medications"):
        flags.append(f"Medications: {answers.get('medications')}")
    if answers.get("proneToHyperpigmentation"):
        flags.append(f"Hyperpigmentation risk: {answers.get('proneToHyperpigmentation')}")
    return {
        "flags": flags,
        "skinType": profile.get("skinType"),
        "concerns": profile.get("concerns"),
        "goals": profile.get("goals"),
        "severity": answers.get("severity") or answers.get("concernSeverity"),
    }


def score_band_label(score: Any) -> str:
    """Map 0–100 CV scores to qualitative bands for LLM context (no digits)."""
    try:
        s = float(score)
    except (TypeError, ValueError):
        return "unrated relative to peers"
    if s >= 85:
        return "strong relative to peers"
    if s >= 70:
        return "balanced relative to peers"
    if s >= 55:
        return "soft relative to peers"
    return "notably soft relative to peers"


def _qualitative_fact_value(key: str, val: Any) -> Optional[str]:
    """Format a CV field as a qualitative cue (no raw decimals, %, or /100)."""
    if val in (None, "", "N/A"):
        return None
    key_l = (key or "").lower()

    if isinstance(val, bool):
        return f"{key}: {'yes' if val else 'no'}"

    if isinstance(val, (int, float)):
        if "norwood" in key_l:
            stage = int(val)
            if stage <= 2:
                band = "early pattern"
            elif stage <= 4:
                band = "mid pattern"
            else:
                band = "advanced pattern"
            return f"{key}: {band}"
        # Scores / symmetry-like 0–100 integers or percentages
        if "score" in key_l or key_l.endswith("pct") or key_l.endswith("percent"):
            return f"{key}: {score_band_label(val)}"
        # Angles — band only, no degrees cited
        if "angle" in key_l or key_l.endswith("deg"):
            if val < 90:
                band = "acute"
            elif val <= 120:
                band = "moderate"
            else:
                band = "obtuse"
            return f"{key}: {band}"
        # Normalized ratios / deviations (typically 0–1 floats)
        mag = abs(float(val))
        if mag <= 1.5:
            return f"{key}: {magnitude_label(mag)}"
        return f"{key}: {magnitude_label(mag / 100.0)}"

    text = str(val).strip()
    if not text:
        return None
    # Strip accidental numeric score echoes from stored labels
    if re.search(r"\d+\s*/\s*100|\b0\.\d{2,}\b", text):
        text = re.sub(r"\d+\s*/\s*100", "qualitative band", text)
        text = re.sub(r"\b0\.\d{2,}\b", "measured cue", text)
    return f"{key}: {text}"


def build_measured_facts(feature_id: str, cv_slice: dict, eye_analysis: Optional[dict]) -> list[str]:
    facts: list[str] = []
    if cv_slice.get("score") is not None:
        band = score_band_label(cv_slice["score"])
        label = (cv_slice.get("scoreLabel") or "").strip()
        if label and label.lower() not in band.lower():
            facts.append(f"scoreLabel: {label}; relative strength: {band}")
        else:
            facts.append(f"relative strength: {band}")

    scalar_keys = (
        "shape",
        "widthLengthRatio",
        "fullness",
        "jawShape",
        "chinType",
        "skinTone",
        "texture",
        "tone",
        "redness",
        "hairline",
        "densityEstimate",
        "coverageEstimate",
        "hairColor",
        "norwoodStage",
        "thinningArea",
        "densityPct",
        "foreheadExposure",
        "crownVisibility",
        "eyeTilt",
        "eyelidExposure",
        "scleraColor",
        "underEyeHealth",
        "jawWidthClass",
        "mandibularDefinition",
        "cheekboneHeightClass",
        "prominence",
        "nasolabialAngleDeg",
        "nasolabialNormalRange",
        "nasofrontalAngleDeg",
        "dorsalHumpDeviation",
        "dorsalHumpLabel",
        "facialConvexityDeg",
        "profileGonialAngleDeg",
        "chinProjectionNorm",
        "profileLandmarkSource",
        "segmentationMethod",
        "crownCoverage",
        "headPosture",
        "headPostureAngleDeg",
        "shoulderWidthPct",
        "lengthBasis",
        "neckWidthClass",
        "neckLengthClass",
        "mouthWidthClass",
        "smileWidthClass",
        "curvature",
        "lipBalance",
        "nasolabialFold",
        "teethVisibility",
        "teethWhiteness",
        "smileArc",
        "gumExposure",
    )
    for key in scalar_keys:
        fact = _qualitative_fact_value(key, cv_slice.get(key))
        if fact:
            facts.append(fact)

    if feature_id == "eyes":
        m = None
        eyes_region = cv_slice.get("eyesRegion") if isinstance(cv_slice.get("eyesRegion"), dict) else None
        if eyes_region:
            if eyes_region.get("score") is not None:
                facts.append(f"eyes relative strength: {score_band_label(eyes_region['score'])}")
            for sub_key, sub_title in (
                ("eyebrows", "brow"),
                ("eyelashes", "lash"),
                ("ocular", "ocular"),
                ("underEye", "under-eye"),
            ):
                sub = eyes_region.get(sub_key)
                if isinstance(sub, dict):
                    for k, v in sub.items():
                        if k in ("explanation", "dataSource"):
                            continue
                        fact = _qualitative_fact_value(f"{sub_title} {k}", v)
                        if fact:
                            facts.append(fact)
        elif isinstance(cv_slice.get("eyeAnalysis"), dict):
            m = cv_slice["eyeAnalysis"]
        elif eye_analysis and eye_analysis.get("metrics"):
            m = eye_analysis["metrics"]
        if m:
            for key in ("eyeTilt", "eyelidExposure", "scleraColor", "underEyeHealth", "lowerLidCurvature"):
                fact = _qualitative_fact_value(key, m.get(key))
                if fact:
                    facts.append(fact)
        brows = cv_slice.get("eyebrows")
        if isinstance(brows, dict) and brows.get("metrics"):
            bm = brows["metrics"]
            for key in ("shape", "symmetryScore", "thickness", "position"):
                fact = _qualitative_fact_value(f"brow {key}", bm.get(key))
                if fact:
                    facts.append(fact)
        return facts[:20] if facts else ["limited periorbital metrics available"]

    if not facts:
        facts.append("limited metrics available for this feature from stored analysis")
    return facts[:20]


def _build_deviation_facts(feature_id: str, cv_report: dict) -> list[str]:
    """Per-feature deviation/magnitude labels from averageness and scores (qualitative only)."""
    facts: list[str] = []
    avg = (cv_report or {}).get("averageness") or {}
    deviations = avg.get("deviations") or []
    feature_map = {
        "jaw": "jaw width",
        "nose": "nose ratio",
        "eyes": "upper third",
        "cheeks": "symmetry",
        "skin": "symmetry",
        "hair": "face ratio",
        "lips": "nose ratio",
        "chin": "jaw width",
        "neck": "face ratio",
        "ears": "symmetry",
    }
    keyword = feature_map.get(feature_id)
    for d in deviations:
        feat = (d.get("feature") or "").lower()
        if keyword and keyword in feat:
            mag = d.get("magnitude", 0)
            try:
                mag_f = float(mag)
            except (TypeError, ValueError):
                mag_f = 0.0
            facts.append(
                f"{feat}: direction {d.get('direction', 'unknown')}, "
                f"magnitude: {magnitude_label(mag_f)}"
            )
    cv_key = {
        "nose": "nose", "jaw": "jaw", "chin": "chin", "skin": "skin",
        "hair": "hair", "lips": "lips", "cheeks": "cheeks", "neck": "neck", "ears": "ears",
        "smile": "smile",
    }.get(feature_id)
    if cv_key:
        section = (cv_report or {}).get(cv_key) or {}
        score = section.get("score")
        if isinstance(score, (int, float)) and score < 75:
            mag = max(0, (80 - score) / 200)
            facts.append(
                f"feature relative strength {score_band_label(score)} implies "
                f"{magnitude_label(mag)} deviation"
            )
    return facts[:8]


def build_feature_context(
    feature_id: str,
    *,
    cv_report: dict,
    eye_analysis: Optional[dict] = None,
    answers: Optional[dict] = None,
) -> dict:
    if feature_id not in FEATURE_NARRATIVE_IDS:
        raise ValueError(f"Unknown feature_id: {feature_id}")

    cv_slice = _feature_cv_slice(feature_id, cv_report or {}, eye_analysis)
    not_measured = _not_measured(feature_id, cv_slice, eye_analysis)
    limitations = _limitations(feature_id, cv_slice, not_measured)
    measured_facts = build_measured_facts(feature_id, cv_slice, eye_analysis)
    contraindications = _contraindications(answers or {})
    deviation_facts = _build_deviation_facts(feature_id, cv_report or {})

    ctx: dict[str, Any] = {
        "featureId": feature_id,
        "cvMetrics": cv_slice,
        "measuredFacts": measured_facts,
        "deviationFacts": deviation_facts,
        "limitations": limitations,
        "notMeasured": not_measured,
        "contraindications": contraindications,
        "questionnaireSummary": format_answers_summary(answers or {}),
    }
    if feature_id == "eyes":
        ctx["subsectionFacts"] = _build_eyes_subsection_facts(cv_report or {}, eye_analysis)
    return ctx


def _drop_numeric_leaves(obj: Any) -> Any:
    """Remove raw int/float leaves so no numeric deviation/ratio/degree leaks into prompts.

    Booleans are kept (they read as yes/no cues). The qualitative form of every numeric
    already ships via measuredFacts / deviationFacts, so nothing meaningful is lost.
    Returns ``None`` for a numeric leaf so callers can prune it from dict/list containers.
    """
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (int, float)):
        return None
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            cleaned = _drop_numeric_leaves(v)
            if cleaned is not None:
                out[k] = cleaned
        return out
    if isinstance(obj, list):
        items = [_drop_numeric_leaves(x) for x in obj]
        return [x for x in items if x is not None]
    return obj


def feature_context_as_prompt_text(ctx: dict) -> str:
    """Compact text block for LLM user messages (qualitative cues — no numeric scores)."""
    facts = []
    for fact in ctx.get("measuredFacts") or []:
        text = str(fact)
        if re.search(r"\b\d{1,3}\s*/\s*100\b|\bscore\s+\d", text, re.I):
            m = re.search(r"\(([^)]+)\)", text)
            if m:
                facts.append(m.group(1).strip())
            continue
        facts.append(text)

    metrics = ctx.get("cvMetrics") or {}
    qualitative_metrics = {
        k: v
        for k, v in metrics.items()
        if k not in ("score",) and not (isinstance(k, str) and k.endswith("Score"))
    }

    lines = [
        f"Feature: {ctx['featureId']}",
        f"Measured cues (qualitative — do not invent or cite numeric scores): {json.dumps(facts)}",
        f"Limitations: {json.dumps(ctx['limitations'])}",
    ]
    contra = ctx.get("contraindications") or {}
    if contra.get("flags"):
        lines.append(f"Contraindication flags: {json.dumps(contra['flags'])}")
    if contra.get("skinType"):
        lines.append(f"Skin type: {contra['skinType']}")
    if contra.get("goals"):
        lines.append(f"Goals: {contra['goals']}")
    if metrics.get("scoreLabel"):
        lines.append(f"Qualitative label: {metrics.get('scoreLabel')}")
    dev_facts = ctx.get("deviationFacts")
    if dev_facts:
        # Drop lines that embed feature score numbers
        cleaned_dev = [
            d for d in dev_facts
            if not re.search(r"\b\d{1,3}\s*/\s*100\b|\bscore\s+\d", str(d), re.I)
        ]
        if cleaned_dev:
            lines.append(
                f"Deviation facts (magnitude language only): {json.dumps(cleaned_dev)}"
            )
    sub_facts = ctx.get("subsectionFacts")
    if sub_facts:
        lines.append(f"Subsection facts (use per subsection): {json.dumps(sub_facts)}")
    if qualitative_metrics:
        scrubbed_metrics = _drop_numeric_leaves(qualitative_metrics)
        if scrubbed_metrics:
            lines.append(f"CV cues JSON: {json.dumps(scrubbed_metrics, default=str)[:2500]}")
    return "\n".join(lines)
