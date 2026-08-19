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
    """Severity-gated recommendation-length directive (report-style; null path for negligible)."""
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
                "(2) one sentence explaining the visual significance of those findings on this face "
                "(why they matter in appearance), grounded in the stated classification, only if the "
                "cues support that interpretation; "
                "(3) one closing sentence stating no non-surgical changes are recommended and the current "
                "routine is sufficient. Do NOT use 'balanced', 'harmonious', or 'no deviations' without pairing each to the "
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
        "is a priority area. Do NOT pad with generic skincare filler covered in other sections."
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
            "recession", "forehead", "follicle", "density", "part",
        },
        "fewshot": (
            "The hairline is low and rounded, with even density across the front and temples and "
            "continuous coverage at the crown. That coverage already frames the forehead, so the "
            "current cut can stay close to the head without exposing extra forehead height. "
            "Gentle cleansing and less heat styling are enough to keep this pattern; no non-surgical "
            "hair-loss treatment is indicated beyond styling and scalp care."
        ),
    },
    "eyes": {
        "terms": {
            "brow", "brows", "eyebrow", "arch", "lash", "lashes", "eyelash", "lid",
            "eyelid", "canthal", "canthus", "periorbital", "ocular", "sclera",
            "hollowing", "under-eye", "undereye", "tear trough", "tilt",
        },
        "fewshot": (
            "The brows sit level with a soft arch and even thickness, so they already frame the "
            "upper lids cleanly. Lash line and eyelid show are even, and the outer corners sit "
            "level with the inner corners, keeping the eye area in proportion with the midface. "
            "The under-eye area shows even tone with only minimal hollowing. Light weekly brow "
            "tidying is optional; no non-surgical change is indicated for the eyes themselves."
        ),
    },
    "nose": {
        "terms": {
            "nasal", "nose", "dorsum", "dorsal", "hump", "nasolabial", "nasofrontal",
            "alar", "ala", "columella", "convexity", "bridge", "nostril", "tip", "root",
        },
        "fewshot": (
            "The nose is straight with a relatively high root and a subtle bridge prominence. "
            "Its upper third is slightly broader than the lower base, while the tip remains defined "
            "and mildly upturned. That combination anchors the midface without crowding the eyes "
            "or mouth, so contour makeup is optional and no non-surgical change to the nose is indicated."
        ),
    },
    "cheeks": {
        "terms": {
            "cheek", "cheeks", "cheekbone", "malar", "submalar", "zygomatic",
            "midface", "buccal",
        },
        "fewshot": (
            "The cheekbones sit high and project enough to keep a clear transition from the lower "
            "lid into the midface, with no notable hollow under the cheek. That height already "
            "defines the middle of the face against the jaw. Daily SPF and moisturiser maintain "
            "the surface; no non-surgical change to cheek structure is indicated."
        ),
    },
    "jaw": {
        "terms": {
            "jaw", "jawline", "jowl", "mandible", "mandibular", "gonial", "bigonial",
            "ramus", "masseter", "definition", "width",
        },
        "fewshot": (
            "The jaw is broad and U-shaped, with a smooth transition from the angles toward the chin. "
            "This gives the lower face a defined but softer outline rather than a sharp square. "
            "Neat grooming along the jaw can increase contrast if desired; no non-surgical change "
            "to the bony outline is indicated."
        ),
    },
    "lips": {
        "terms": {
            "lip", "lips", "vermilion", "cupid", "philtrum", "commissure", "oral",
            "mouth", "border", "bow",
        },
        "fewshot": (
            "The lips are full, with a longer philtrum and a rather flat cupid's bow, so they sit "
            "quietly in the lower midface rather than reading as a sharp peak. Fullness and philtrum "
            "length still fit the surrounding proportions. Daily balm keeps the surface even; no "
            "non-surgical change to lip shape is indicated."
        ),
    },
    "chin": {
        "terms": {
            "chin", "mental", "pogonion", "pogonial", "submental", "projection",
            "recession",
        },
        "fewshot": (
            "The chin is centered, with adequate height and only slight under-projection in profile. "
            "It closes the lower third without a blocky or protruding look. A short, well-edged beard "
            "along the chin outline can add visual depth if wanted; no non-surgical change to chin "
            "structure is required."
        ),
    },
    "neck": {
        "terms": {
            "neck", "cervicomental", "submental", "cervical", "nape", "posture",
            "width", "length",
        },
        "fewshot": (
            "The neck has balanced width and a clean transition under the jaw, with upright head "
            "posture. That column already supports the head without looking bulky. Daily SPF on the "
            "neck skin and ordinary posture habits maintain this; no non-surgical change to neck "
            "size is indicated."
        ),
    },
    "ears": {
        "terms": {
            "ear", "ears", "helix", "helical", "antihelix", "lobule", "lobe",
            "conchal", "concha", "auricle", "auricular", "pinna", "tragus",
            "projection",
        },
        "fewshot": (
            "The ears are small, set high, and only slightly prominent, with a clear helix and "
            "antihelix. Their size and symmetry keep them as a side frame rather than a focal point "
            "from the front. Current hair styling that covers the rim is enough; no non-surgical "
            "change to ear shape is indicated."
        ),
    },
    "smile": {
        "terms": {
            "smile", "teeth", "tooth", "dental", "gingiva", "gingival", "gum",
            "commissure", "oral", "whiteness", "corridor",
        },
        "fewshot": (
            "The smile shows an even arc with moderate tooth display and little gum show. The corners "
            "rise symmetrically, so the mouth stays in proportion with the lips and chin. Ordinary "
            "oral hygiene and lip care maintain this; no non-surgical change to smile shape is indicated."
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
