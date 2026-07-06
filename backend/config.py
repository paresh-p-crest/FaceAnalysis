"""Port of constants.js — all constants, thresholds, model names."""

OPENAI_REPORT_MODEL = "gpt-4o-mini"

STAGES = {
    "LANDING": "landing",
    "QUESTIONNAIRE": "questionnaire",
    "PROTOCOL": "protocol",
    "UPLOAD": "upload",
    "SCANNING": "scanning",
    "REPORT": "report",
    "HISTORY": "history",
}

PHOTO_POSES = [
    {"id": "front", "label": "Front Face", "required": True, "hint": "Entire face head-on with a neutral expression"},
    {"id": "leftProfile", "label": "Left Profile", "required": False, "hint": "Left side profile (optional)"},
    {"id": "rightProfile", "label": "Right Profile", "required": False, "hint": "Right side profile (optional)"},
    {"id": "left45", "label": "Left 45°", "required": False, "hint": "Three-quarter angle from left (optional)"},
    {"id": "right45", "label": "Right 45°", "required": False, "hint": "Three-quarter angle from right (optional)"},
    {"id": "smile", "label": "Smile", "required": False, "hint": "Smile naturally showing teeth — helps analyze smile shape & teeth"},
    {"id": "topHead", "label": "Top of Head", "required": False, "hint": "Tilt head down showing top of head & hairline — helps analyze hair density"},
]

SCAN_STAGES = [
    "Preparing images",
    "Detecting face",
    "Extracting landmarks",
    "Analyzing facial geometry",
    "Skin analysis",
    "Generating recommendations",
    "Preparing report",
]

SCAN_MESSAGES = [
    "Locating 468 facial landmark points…",
    "Mapping facial thirds & fifths…",
    "Calculating symmetry indices…",
    "Assessing jawline & chin geometry…",
    "Evaluating periorbital structure…",
    "Cross-referencing demographic norms…",
    "Generating personalized protocol…",
]

INITIAL_ANSWERS = {
    "goals": ["structure"],
    "skinConcerns": ["none"],
    "ageRange": "25-34",
    "gender": "male",
    "ethnicity": "south-asian",
    "concernSeverity": "mild",
    "skinType": "combination",
    "skincareRoutine": "minimal",
    "environment": "mixed",
    "smoking": "never",
    "sleepQuality": "good",
    "waterIntake": "moderate",
    "sunExposure": "moderate",
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
