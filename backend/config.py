"""Port of constants.js — all constants, thresholds, model names."""

import os
from pathlib import Path

# --- Filesystem roots -------------------------------------------------------
# After the Replit port, the Next.js frontend (and its static `public/` root)
# lives under artifacts/myface. Browser-served files (uploaded poses, parsing
# crops, projected AFTER images, protocol JSON) must be written INTO that public
# dir so `next dev` serves them at `/uploads/...` on both Replit and locally.
# Writing to a repo-root `public/` would 404 because Next never serves it.
REPO_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = REPO_ROOT / "artifacts" / "myface" / "public"
UPLOADS_ROOT = PUBLIC_DIR / "uploads" / "assessments"

OPENAI_REPORT_MODEL = "gpt-4o-mini"
GROQ_MODEL = "llama-3.3-70b-versatile"
# OpenRouter model id (use `:free` for $0 token models — still rate-limited) - Backup one, if no model is defined in .env then this one will be used
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free" 

# Unified max completion tokens for every backend LLM call (narratives, protocol, assistant).
# Keeps budgets consistent and avoids truncated JSON from smaller per-call caps.
# Override with LLM_MAX_OUTPUT_TOKENS in .env if needed.
LLM_MAX_OUTPUT_TOKENS = int(os.environ.get("LLM_MAX_OUTPUT_TOKENS", "8000") or "8000")

# Feature narrative generation: total LLM attempts on hard reject / empty / schema fail.
FEATURE_NARRATIVE_MAX_ATTEMPTS = int(os.environ.get("FEATURE_NARRATIVE_MAX_ATTEMPTS", "3") or "3")
# Extra LLM calls after a 429, with exponential backoff starting at BACKOFF_SEC (30 → 60 → 120).
FEATURE_NARRATIVE_RATE_LIMIT_RETRIES = int(
    os.environ.get("FEATURE_NARRATIVE_RATE_LIMIT_RETRIES", "3") or "3"
)
FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC = int(
    os.environ.get("FEATURE_NARRATIVE_RATE_LIMIT_BACKOFF_SEC", "30") or "30"
)

# Beauty Assistant — cost controls
ASSISTANT_HOURLY_MESSAGE_LIMIT = 20
ASSISTANT_SUMMARY_REFRESH_EVERY = 6
ASSISTANT_RECENT_TURNS = 4

PROTOCOL_FEATURE_IDS = (
    "hair",
    "eyes",
    "nose",
    "cheeks",
    "jaw",
    "lips",
    "chin",
    "skin",
    "neck",
    "ears",
)

# Features that receive structured LLM narratives (protocol PDF pages + interactive smile).
FEATURE_NARRATIVE_IDS = PROTOCOL_FEATURE_IDS + ("smile",)

# Dynamic OpenAI Vision pose mapping for feature narratives (only when LLM_PROVIDER=openai).
# Hair is the exception: front + top-of-head. Other features use the views that match the report.
FEATURE_VISION_POSES: dict[str, tuple[str, ...]] = {
    "hair": ("front", "topHead"),
    "eyes": ("front",),
    "nose": ("front", "rightProfile"),
    "cheeks": ("front", "left45", "right45"),
    "jaw": ("front", "rightProfile"),
    "lips": ("front", "smile"),
    "chin": ("front", "rightProfile"),
    "skin": ("front",),
    "neck": ("front",),
    "ears": ("front", "leftProfile", "rightProfile"),
    "smile": ("smile", "front"),
}

STAGES = {
    "LANDING": "landing",
    "QUESTIONNAIRE": "questionnaire",
    "UPLOAD": "upload",
    "SCANNING": "scanning",
    "REPORT": "report",
    "HISTORY": "history",
}

PHOTO_POSES = [
    {"id": "front", "label": "Front Face", "required": True, "hint": "Entire face head-on with a neutral expression"},
    {"id": "leftProfile", "label": "Left Profile", "required": True, "hint": "Left side profile — full face from the left"},
    {"id": "rightProfile", "label": "Right Profile", "required": True, "hint": "Right side profile — full face from the right"},
    {"id": "left45", "label": "Left 45°", "required": True, "hint": "Three-quarter angle from the left"},
    {"id": "right45", "label": "Right 45°", "required": True, "hint": "Three-quarter angle from the right"},
    {"id": "smile", "label": "Smile", "required": True, "hint": "Smile naturally showing teeth — for smile shape & teeth analysis"},
    {"id": "topHead", "label": "Top of Head", "required": True, "hint": "Tilt head down showing top of head & hairline — for hair density analysis"},
]

REQUIRED_POSE_IDS = tuple(p["id"] for p in PHOTO_POSES if p.get("required"))

SCAN_STAGES = [
    "Preparing images",
    "Detecting face",
    "Extracting landmarks",
    "Analyzing facial geometry",
    "Skin analysis",
    "Writing feature recommendations",
    "Building protocol narrative",
    "Preparing report",
]

INITIAL_ANSWERS = {
    # Existing fields
    "goals": [],
    "skinConcerns": [],
    "ageRange": "",
    "gender": "",
    "ethnicity": "",
    "concernSeverity": "",
    "skinType": "",
    "skincareRoutine": "",
    "environment": "",
    "smoking": "",
    "sleepQuality": "",
    "waterIntake": "",
    "sunExposure": "",

    # New fields
    "occupation": "",
    "drinking": "",
    "genderPreference": "",
    "hadNonSurgical": "",
    "hadSurgery": "",
    "comfortableTreatments": [],
    "medicalConditions": "",
    "medicalConditionsDetails": "",
    "medications": "",
    "medicationsDetails": "",
    "usedRetinoids": "",
    "allergies": "",
    "allergiesDetails": "",
    "activeInfections": "",
    "activeInfectionsDetails": "",
    "proneToHyperpigmentation": "",
    "featureLike": "",
    "featureDislike": "",
    "celebrityMatch": "",
    "comfortableWeightLoss": "",
    "goalAesthetic": "",
    "growBeard": "",
    "aestheticDistress": "",
    "appearanceFrequency": "",
    "motivation": "",
    "additionalNotes": "",
}

# Protocol items
PROTOCOL_ITEMS = [
    {"id": "glasses", "label": "Take off any glasses and hat"},
    {"id": "lighting", "label": "Use natural, even lighting on your face"},
    {"id": "background", "label": "Use a plain, neutral background"},
    {"id": "hair", "label": "Tie long hair back — face, neck and ears visible"},
    {"id": "makeup", "label": "Remove heavy makeup (light makeup OK)"},
    {"id": "clothing", "label": "Avoid neck-covering clothes (e.g. turtlenecks)"},
    {"id": "filters", "label": "Don't use filters on the photo"},
]
