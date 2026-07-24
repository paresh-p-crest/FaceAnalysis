"""Deterministic recommendation hints passed into LLM prompts (not client-facing prose)."""

from __future__ import annotations

import re
from typing import Any

EvidenceTier = str  # lifestyle | otc | refer_clinician


def magnitude_label(magnitude: float) -> str:
    if magnitude >= 0.12:
        return "notable"
    if magnitude >= 0.06:
        return "moderate"
    if magnitude >= 0.03:
        return "mild"
    return "minimal"


def deviation_to_tier(magnitude: float, score: Any = None) -> EvidenceTier:
    """Map CV deviation magnitude to recommended evidence tier ceiling."""
    if isinstance(score, (int, float)) and score >= 88 and magnitude < 0.05:
        return "lifestyle"
    if magnitude >= 0.12:
        return "refer_clinician"
    if magnitude >= 0.05:
        return "otc"
    return "lifestyle"


def _feature_deviation_magnitude(feature_id: str, ctx: dict) -> float:
    dev_facts = ctx.get("deviationFacts") or []
    if dev_facts:
        for fact in dev_facts:
            if "magnitude:" in fact:
                try:
                    return float(fact.split("magnitude:")[-1].strip())
                except ValueError:
                    pass
    cv = ctx.get("cvMetrics") or {}
    score = cv.get("score")
    if isinstance(score, (int, float)):
        return max(0, (85 - score) / 200)
    return 0.04


def get_tier_hints(feature_id: str, ctx: dict) -> list[str]:
    """Severity-gated tier guidance for subsection evidenceTier fields."""
    mag = _feature_deviation_magnitude(feature_id, ctx)
    label = magnitude_label(mag)
    ceiling = deviation_to_tier(mag, (ctx.get("cvMetrics") or {}).get("score"))
    hints = [
        f"Deviation magnitude for this feature: {label} (qualitative).",
        "Close each subsection with ONE recommendation sentence matching its evidenceTier.",
        "Tier ladder: lifestyle = routine/topical/skincare-only; otc = non-invasive OTC/at-home; "
        "refer_clinician = in-office consultation referral only (never prescribe procedures).",
        f"Maximum tier for this feature unless subsection severity clearly warrants escalation: {ceiling}.",
    ]
    if ceiling == "lifestyle":
        hints.append("Prefer lifestyle tier for all subsections; use otc only for clearly measured mild deviations.")
    elif ceiling == "refer_clinician":
        hints.append("At least one subsection may use refer_clinician for the most notable measured deviation.")
    return hints


def feature_severity_bucket(feature_id: str, ctx: dict) -> str:
    """Qualitative severity bucket for this feature: minimal | mild | moderate | notable."""
    return magnitude_label(_feature_deviation_magnitude(feature_id, ctx))


def get_severity_content_directive(feature_id: str, ctx: dict) -> str:
    """Severity-gated recommendation-length directive (Qoves-style; null path for negligible)."""
    bucket = feature_severity_bucket(feature_id, ctx)
    is_skin = feature_id == "skin"
    if bucket == "minimal":
        if not is_skin:
            return (
                "SEVERITY = negligible for this feature. This is a NULL-PATH section: the CONCLUSION is "
                "'no non-surgical changes needed', but you MUST still describe the specific measured geometry "
                "so the section reads as substantive, not boilerplate. Write in this exact order: "
                "(1) one sentence naming the SPECIFIC measured attributes for this feature from the provided cues "
                "(shape, angle, ratio, symmetry, or position) using ONLY values present in the cues, never invented; "
                "(2) one sentence explaining WHY those specific values support facial harmony or sit within the "
                "expected/balanced range, grounded in the stated classification (not generic language); "
                "(3) one closing sentence stating no non-surgical changes are recommended and the current routine "
                "is sufficient. Do NOT use 'balanced', 'harmonious', or 'no deviations' without pairing each to the "
                "specific measured attribute it describes. Every sentence must reference at least one concrete cue "
                "from this feature's measurements. Do NOT pad with generic SPF/hydration/sleep filler."
            )
        # Skin keeps a baseline routine even at negligible deviation (it owns foundational care).
        return (
            "SEVERITY = minimal. Keep to a concise baseline maintenance routine in 1-2 sentences; do not escalate."
        )
    if bucket == "mild":
        return (
            "SEVERITY = mild. Keep recommendations to 1-2 lifestyle/skincare sentences only; do not escalate."
        )
    if bucket == "moderate":
        return (
            "SEVERITY = moderate. Give brief lifestyle guidance plus exactly ONE targeted grooming/routine "
            "change specific to this feature's measured deviation; no additional generic advice."
        )
    return (
        "SEVERITY = notable. Give lifestyle guidance plus a targeted change, and state explicitly that this "
        "is a priority area for the subject. Do NOT pad with generic skincare filler covered in other sections."
    )


def get_deterministic_recommendation_hints(feature_id: str, ctx: dict) -> list[str]:
    hints: list[str] = list(get_tier_hints(feature_id, ctx))
    cv = ctx.get("cvMetrics") or {}
    score = cv.get("score")
    if isinstance(score, (int, float)) and score >= 85:
        hints.append("Overall measured score is strong; emphasize maintenance and protection, not aggressive intervention.")

    contra = ctx.get("contraindications") or {}
    if contra.get("flags"):
        hints.append("Respect contraindication flags; avoid actives that conflict with reported allergies, infections, or recent retinoids.")

    if feature_id == "skin":
        redness = cv.get("redness") or cv.get("clarity")
        if redness and str(redness).lower() not in ("normal", "good", "even"):
            hints.append("Elevated redness: prioritize gentle cleansing, niacinamide or azelaic acid OTC before strong acids.")
        skin_type = (contra.get("skinType") or "").lower()
        if "sensitive" in skin_type:
            hints.append("Sensitive skin: introduce actives gradually; patch test; daily SPF 50.")

    if feature_id == "hair":
        q = ctx.get("questionnaireSummary") or {}
        pref = str(q.get("genderPreference") or "").strip().lower()
        # Labels from format_answers_summary ("Feminine") or raw values ("feminine").
        scale = "Ludwig" if pref == "feminine" else "Norwood"
        hints.append(
            f"When naming the baldness/thinning stage scale, use the word {scale} "
            f"(not {'Norwood' if scale == 'Ludwig' else 'Ludwig'})."
        )
        if cv.get("dataSource") == "estimated" or not cv.get("densityPct"):
            hints.append(
                f"Hair density not directly measured: do not state {scale} stage or prescribe minoxidil; "
                "focus on gentle scalp care and photo guidance."
            )
        elif cv.get("norwoodStage") and int(cv.get("norwoodStage", 1)) >= 3:
            hints.append("Significant thinning signals: suggest discussing options with a dermatologist; OTC scalp care only in report text.")

    if feature_id == "eyes":
        hints.append("Do not describe iris color; use sclera and periorbital metrics only.")
        m = cv.get("eyeAnalysis") or {}
        if m.get("underEyeHealth") in ("Shadowed", "Dark circles present"):
            hints.append("Under-eye shadowing: sleep, hydration, caffeine-based OTC eye serum, daily SPF; no procedural claims.")

    if feature_id in ("jaw", "cheeks"):
        hints.append(
            "State the width/prominence classification once and stay consistent throughout the section; "
            "if it is classified 'wide', do not also call it narrow or suggest narrowing - describe only "
            "supportive grooming/posture measures for the stated classification."
        )

    if feature_id in ("jaw", "neck", "chin"):
        hints.append("Structural change from grooming/posture/neck exercise only; no surgical or injectable framing.")

    if feature_id == "ears":
        hints.append("Ear metrics are proportional only; grooming and hairstyle framing, not otoplasty.")

    return hints


# --- Null-path (severity = minimal, non-Skin) content grounding ---------------
#
# Each non-Skin feature gets a per-feature few-shot exemplar (so vocabulary is
# feature-specific, not nose-biased) and a curated set of *distinctive anatomical
# nouns* used to verify a null-path section actually describes measured geometry.
# Generic dimension adjectives (wide/full/low/high/long/short/large/small) are
# deliberately excluded: they collide with ordinary prose and with the
# CONTRADICTION_PAIRS opposites, so a section could otherwise "ground" on filler.
NULL_PATH_FEATURE_GUIDE: dict[str, dict[str, Any]] = {
    "hair": {
        "terms": {
            "hair", "hairline", "temple", "temporal", "frontal", "crown", "scalp",
            "recession", "forehead", "follicle",
        },
        "fewshot": (
            "The subject's hairline is stable with even density across the frontal and temporal regions "
            "and no notable recession at the temples or crown. The hair texture and coverage frame the "
            "forehead in proportion with the facial thirds, so the present cut and styling suit the face. "
            "Scalp coverage tracks within the expected range, so routine grooming maintains the current "
            "appearance. Currently, no non-surgical changes are recommended for this feature."
        ),
    },
    "eyes": {
        "terms": {
            "brow", "brows", "eyebrow", "arch", "lash", "lashes", "eyelash", "lid",
            "eyelid", "canthal", "canthus", "periorbital", "ocular", "sclera",
            "hollowing", "under-eye", "undereye", "tear trough",
        },
        "fewshot": (
            "The subject's brows sit level with a soft arch and even thickness, framing the periorbital "
            "region symmetrically. The lash line and eyelid exposure are even and the canthal tilt reads "
            "neutral, so the ocular region stays in proportion with the brow and midface. The under-eye "
            "area shows even tone with minimal hollowing, keeping the periorbital frame rested. Currently, "
            "no non-surgical changes are recommended for this feature."
        ),
    },
    "nose": {
        "terms": {
            "nasal", "nose", "dorsum", "dorsal", "hump", "nasolabial", "nasofrontal",
            "alar", "ala", "columella", "convexity",
        },
        "fewshot": (
            "The subject's nasal profile is straight with a high root, a smooth dorsum, and a nasolabial "
            "angle in the typical range, giving a stable midface anchor. The dorsal contour shows only a "
            "minimal hump and the alar base sits proportionally against the facial thirds, so the nose "
            "transitions cleanly into the surrounding features. Facial convexity and the nasofrontal "
            "relationship both read within the expected range for this face shape, so the nose integrates "
            "rather than standing out. Currently, no non-surgical changes are recommended for this feature."
        ),
    },
    "cheeks": {
        "terms": {
            "cheek", "cheeks", "cheekbone", "malar", "submalar", "zygomatic",
            "midface", "buccal",
        },
        "fewshot": (
            "The subject's cheekbones show moderate malar projection with a smooth midface transition and "
            "no notable submalar hollowing. The zygomatic contour supports the midface and keeps the "
            "cheeks in proportion with the orbital and jaw regions. Malar height tracks with the "
            "surrounding facial thirds, so the cheeks read as supportive structure rather than a focal "
            "point. Currently, no non-surgical changes are recommended for this feature."
        ),
    },
    "jaw": {
        "terms": {
            "jaw", "jawline", "jowl", "mandible", "mandibular", "gonial", "bigonial",
            "ramus", "masseter", "definition",
        },
        "fewshot": (
            "The subject's jawline shows a defined mandibular border with a gonial angle in the typical "
            "range and even bigonial proportions. The ramus and mandibular contour give the lower face a "
            "stable frame that balances with the midface and chin. Jaw definition tracks with the "
            "surrounding landmarks, so the lower-third proportions read as harmonious. Currently, no "
            "non-surgical changes are recommended for this feature."
        ),
    },
    "lips": {
        "terms": {
            "lip", "lips", "vermilion", "cupid", "philtrum", "commissure", "oral",
            "mouth", "border",
        },
        "fewshot": (
            "The subject's lips show an even vermilion border with a defined cupid's bow and a "
            "proportionate philtrum. The upper-to-lower vermilion balance and gentle lip curvature keep "
            "the mouth in harmony with the midface. The oral commissures sit level, so the lips integrate "
            "with the lower-face features. Currently, no non-surgical changes are recommended for this "
            "feature."
        ),
    },
    "chin": {
        "terms": {
            "chin", "mental", "pogonion", "pogonial", "submental", "projection",
            "recession",
        },
        "fewshot": (
            "The subject's chin shows neutral pogonial projection with a smooth mental contour and no "
            "notable recession in profile. The chin balances the lower third against the lips and "
            "jawline, keeping the lower-face proportions stable. Mental projection tracks with the "
            "surrounding landmarks, so the chin integrates with the lower face. Currently, no non-surgical "
            "changes are recommended for this feature."
        ),
    },
    "neck": {
        "terms": {
            "neck", "cervicomental", "submental", "cervical", "nape", "posture",
        },
        "fewshot": (
            "The subject's neck shows a clean cervicomental angle with proportionate width and length and "
            "an upright head posture. The submental contour is smooth and the neck transitions cleanly "
            "into the jawline and shoulders. Cervical proportions track with the surrounding landmarks, so "
            "the profile reads as stable. Currently, no non-surgical changes are recommended for this "
            "feature."
        ),
    },
    "ears": {
        "terms": {
            "ear", "ears", "helix", "helical", "antihelix", "lobule", "lobe",
            "conchal", "concha", "auricle", "auricular", "pinna", "tragus",
        },
        "fewshot": (
            "The subject's ears sit close to the head with a well-defined helix and antihelix and a "
            "proportionate lobule. The helical rim curls smoothly and the conchal depth keeps the auricle "
            "from projecting, so the ears stay visually recessive in front and profile views. Ear "
            "position tracks with the surrounding facial landmarks, so they read as neutral framing "
            "rather than a focal point. Currently, no non-surgical changes are recommended for this "
            "feature."
        ),
    },
    "smile": {
        "terms": {
            "smile", "teeth", "tooth", "dental", "gingiva", "gingival", "gum",
            "commissure", "oral", "whiteness", "corridor",
        },
        "fewshot": (
            "The subject's smile shows a consonant smile arc with even teeth visibility and minimal gum "
            "exposure. The oral commissures rise symmetrically and the dental display sits in proportion "
            "with the lips and lower face. Smile curvature and gingival show track with the surrounding "
            "features, so the smile reads as harmonious. Currently, no non-surgical changes are "
            "recommended for this feature."
        ),
    },
}

# Tokens that carry no anatomical grounding signal when auto-derived from the
# camelCase measuredFacts keys. Tuned against a real key dump (see ADR-033);
# extend further if new noise tokens appear.
_NULL_PATH_STOPWORDS = frozenset({
    # Meta / unit / schema suffixes
    "deg", "class", "norm", "label", "estimate", "pct", "percent", "index",
    "score", "range", "source", "method", "basis", "visibility", "area", "type",
    "relative", "strength", "measured", "cue", "cues", "left", "right", "with",
    "this", "that", "from", "and", "the", "for", "data", "available", "metrics",
    "limited", "stored", "analysis", "region", "feature", "subject", "overall",
    # Common English / dimension words that false-ground on ordinary prose
    "shape", "color", "colour", "health", "density", "coverage", "exposure",
    "width", "length", "height", "balance", "curvature", "prominence",
    "position", "thickness", "tilt", "under", "lower", "upper", "head",
    "shoulder", "fullness", "angle", "deviation", "profile", "contour",
    "darkness", "brightness", "contrast", "texture", "tone", "size", "facial",
})


def _camel_word_tokens(text: str) -> list[str]:
    """Split a camelCase / snake_case / spaced label into lowercase word tokens."""
    parts = re.findall(r"[A-Z]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|\d+", text or "")
    return [p.lower() for p in parts]


def get_null_path_fewshot(feature_id: str) -> str:
    """Per-feature null-path exemplar (empty string if the feature has no guide entry)."""
    guide = NULL_PATH_FEATURE_GUIDE.get(feature_id)
    return str(guide["fewshot"]) if guide else ""


def measured_cue_tokens(ctx: dict) -> set[str]:
    """Anatomical tokens auto-derived from the *key* side of each ``measuredFacts``
    entry (``"key: value"``), dropping stopwords and short noise.

    Used as a supplement to the curated distinctive-noun set; the sparse-cue
    skip uses ``has_usable_measured_cues`` instead (common-key features like
    lips/ears still have real cues even when their keys are stopwords).
    """
    toks: set[str] = set()
    for fact in ctx.get("measuredFacts") or []:
        key = str(fact).split(":", 1)[0]
        for tok in _camel_word_tokens(key):
            if len(tok) >= 4 and tok not in _NULL_PATH_STOPWORDS:
                toks.add(tok)
    return toks


def has_usable_measured_cues(ctx: dict) -> bool:
    """True when the feature exposes at least one real ``key: value`` measured cue.

    The fallback phrases ("limited metrics available…") do not count, so a
    cue-sparse feature (e.g. smile with no smile photo) still skips the
    grounding gate. Features whose keys are common English words (lips/ears)
    still count as usable — grounding then relies on the curated term set.
    """
    for fact in ctx.get("measuredFacts") or []:
        text = str(fact).strip().lower()
        if not text:
            continue
        if "limited metrics" in text or "limited periorbital" in text:
            continue
        if ":" in text:
            return True
    return False


def null_path_grounding_terms(feature_id: str, ctx: dict) -> set[str]:
    """Grounding vocabulary for a null-path section: the curated distinctive-noun
    set for this feature unioned with the auto-derived measured cue tokens."""
    guide = NULL_PATH_FEATURE_GUIDE.get(feature_id) or {}
    return set(guide.get("terms") or ()) | measured_cue_tokens(ctx)
