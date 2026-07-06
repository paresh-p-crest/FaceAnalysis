"""Port of buildAwsReport.js — AWS-based Markdown report generation.

Contains both the report builder and formatAnswersSummary helper.
"""

from __future__ import annotations
from typing import Optional

from .protocol_check import protocol_warnings_to_markdown


# ══════════════════════════════════════════════════════════════════════════════
# Label maps (ported from onboarding.js)
# ══════════════════════════════════════════════════════════════════════════════

GOAL_LABELS = {
    "harmony": "Facial Harmony",
    "skin": "Skin Health",
    "anti-aging": "Anti-aging",
    "structure": "Facial Structure",
    "cosmetic": "Cosmetic Consultation",
    "track": "Track Progress",
}

CONCERN_LABELS = {
    "acne": "Acne",
    "pigmentation": "Pigmentation",
    "wrinkles": "Wrinkles",
    "dark-circles": "Dark Circles",
    "redness": "Redness",
    "scars": "Scars",
    "uneven-tone": "Uneven Tone",
    "none": "None",
}

SEVERITY_LABELS = {
    "mild": "Mild",
    "moderate": "Moderate",
    "severe": "Severe",
    "none": "None",
}

ETHNICITY_LABELS = {
    "caucasian": "Caucasian",
    "black": "Black",
    "hispanic": "Hispanic",
    "asian": "Asian",
    "middle-eastern": "Middle Eastern",
    "pacific-islander": "Pacific Islander",
    "other": "Other",
    "prefer-not": "Prefer not to say",
}

SKIN_TYPE_LABELS = {
    "oily": "Oily",
    "dry": "Dry",
    "combination": "Combination",
    "normal": "Normal",
    "sensitive": "Sensitive",
}

SKINCARE_LABELS = {
    "minimal": "Minimal",
    "basic": "Basic",
    "moderate": "Moderate",
    "extensive": "Extensive",
}

AGE_LABELS = {
    "18-24": "18–24",
    "25-34": "25–34",
    "35-44": "35–44",
    "45-54": "45–54",
    "55+": "55+",
}

GENDER_LABELS = {
    "female": "Female",
    "male": "Male",
    "non-binary": "Non-binary",
    "prefer-not": "Prefer not to say",
}

SMOKING_LABELS = {
    "never": "Never",
    "occasionally": "Occasionally",
    "regularly": "Regularly",
    "daily": "Daily",
}

SLEEP_LABELS = {
    "poor": "Poor",
    "fair": "Fair",
    "good": "Good",
    "excellent": "Excellent",
}

WATER_LABELS = {
    "low": "Low",
    "moderate": "Moderate",
    "high": "High",
}

SUN_LABELS = {
    "minimal": "Minimal",
    "moderate": "Moderate",
    "high": "High",
}


def format_answers_summary(answers: dict) -> dict:
    """Convert answer keys to human-readable labels.

    Returns a dict of formatted strings for report generation.
    """
    goals_list = answers.get("goals", []) or []
    goals = ", ".join(GOAL_LABELS.get(g, g) for g in goals_list) or "not specified"

    concerns_list = answers.get("skinConcerns", []) or []
    concerns = ", ".join(CONCERN_LABELS.get(c, c) for c in concerns_list) or "none selected"

    severity = SEVERITY_LABELS.get(answers.get("concernSeverity", ""), "not specified")
    ethnicity = ETHNICITY_LABELS.get(answers.get("ethnicity", ""), "not specified")
    skin_type = SKIN_TYPE_LABELS.get(answers.get("skinType", ""), "not specified")
    skincare = SKINCARE_LABELS.get(answers.get("skincareRoutine", ""), "not specified")

    env = answers.get("environment", "")
    if env == "outdoor":
        occupation = "Outdoor"
    elif env == "mixed":
        occupation = "Mixed indoor/outdoor"
    elif env == "indoor":
        occupation = "Indoor"
    else:
        occupation = "not specified"

    age = AGE_LABELS.get(answers.get("ageRange", ""), answers.get("ageRange", "not specified"))
    gender = GENDER_LABELS.get(answers.get("gender", ""), answers.get("gender", "not specified"))
    smoking = SMOKING_LABELS.get(answers.get("smoking", ""), "not specified")

    return {
        "goals": goals,
        "concerns": concerns,
        "severity": severity,
        "ethnicity": ethnicity,
        "skinType": skin_type,
        "skincareRoutine": skincare,
        "occupation": occupation,
        "age": age,
        "gender": gender,
        "smoking": smoking,
        "medicalConditions": "none reported",
    }


def build_aws_report(
    face_details: Optional[dict],
    metrics: Optional[dict],
    answers: dict,
    protocol_warnings: Optional[list] = None,
) -> Optional[str]:
    """Build a Markdown report from AWS Rekognition face details.

    Returns the Markdown string, or None if data is missing.
    """
    if not face_details or not metrics:
        return None

    if protocol_warnings is None:
        protocol_warnings = []

    profile = format_answers_summary(answers)

    emotions_raw = face_details.get("Emotions", [])
    emotions_sorted = sorted(emotions_raw, key=lambda e: e.get("Confidence", 0), reverse=True)[:3]
    emotions = ", ".join(f"{e['Type']} ({e['Confidence']:.0f}%)" for e in emotions_sorted)

    age_range = face_details.get("AgeRange", {})
    age_low = age_range.get("Low", "?")
    age_high = age_range.get("High", "?")
    pose = face_details.get("Pose", {})
    quality = face_details.get("Quality", {})
    landmark_count = len(face_details.get("Landmarks", []))

    smile_val = face_details.get("Smile", {})
    smile_str = f"Yes ({smile_val.get('Confidence', 0):.0f}%)" if smile_val.get("Value") else "No"
    eyes_open_val = face_details.get("EyesOpen", {})
    eyes_open = "Open" if eyes_open_val.get("Value") else "Closed"
    eyeglasses_val = face_details.get("Eyeglasses", {})
    eyeglasses = "Detected" if eyeglasses_val.get("Value") else "Not detected"

    gender_val = face_details.get("Gender", {})
    beard_val = face_details.get("Beard", False)
    mustache_val = face_details.get("Mustache", False)
    mouth_open_val = face_details.get("MouthOpen", False)

    parts = [
        protocol_warnings_to_markdown(protocol_warnings),
        "## Executive Summary\n",
        (
            f"AWS Rekognition analyzed your facial image with **{face_details.get('Confidence', 0):.1f}% detection confidence**, "
            f"mapping **{landmark_count} facial landmarks**. Your stated goals: *{profile['goals']}*. "
            f"Skin focus: *{profile['concerns']}* ({profile['severity']} severity). "
            f"Lifestyle: {profile['occupation']}, smoking {profile['smoking']}, "
            f"conditions: {profile['medicalConditions']}.\n"
        ),
        (
            f"**Harmony score:** {metrics.get('harmonyScore', 'N/A')}/100 · "
            f"**Symmetry:** {metrics.get('symmetry', 'N/A')}% · "
            f"**Estimated age:** {metrics.get('visualAge', 'N/A')} years "
            f"(range {age_low}–{age_high})\n"
        ),
        "---\n",
        "## Structural Analysis\n",
        "### Facial Proportions",
        (
            f"- **Vertical thirds (upper / middle / lower):** "
            f"{metrics.get('upperThird', 'N/A')} / {metrics.get('middleThird', 'N/A')} / "
            f"{metrics.get('lowerThird', 'N/A')}"
        ),
        f"- **Proportionality index:** {metrics.get('proportionality', 'N/A')}%",
        f"- **Jawline angle (estimated):** {metrics.get('jawlineAngle', 'N/A')}°\n",
        "### Head Pose (AWS measured)",
        (
            f"- **Yaw:** {pose.get('Yaw', 0):.1f}° · "
            f"**Pitch:** {pose.get('Pitch', 0):.1f}° · "
            f"**Roll:** {pose.get('Roll', 0):.1f}°"
        ),
        "\n### Image Quality",
        (
            f"- **Sharpness:** {quality.get('Sharpness', 0):.0f} · "
            f"**Brightness:** {quality.get('Brightness', 0):.0f}"
        ),
    ]

    if metrics.get("pose"):
        parts.append(f"- **Pose summary:** {metrics['pose']}")

    parts.extend([
        "\n### Periorbital & Expression",
        f"- **Eyes:** {eyes_open} · **Smile detected:** {smile_str}",
        f"- **Eyeglasses:** {eyeglasses}",
        f"- **Dominant emotions:** {emotions or 'N/A'}\n",
        "### Symmetry",
        f"Facial symmetry index: **{metrics.get('symmetry', 'N/A')}%** — derived from left/right eye landmark alignment.\n",
        "---\n",
        "## Detected Attributes (AWS Rekognition)\n",
        "| Attribute | Value |",
        "|-----------|-------|",
        f"| Gender | {gender_val.get('Value', '—')} ({gender_val.get('Confidence', 0):.0f}%) |",
        f"| Age range | {age_low}–{age_high} years |",
        f"| Beard | {'Yes' if beard_val.get('Value') else 'No'} |",
        f"| Mustache | {'Yes' if mustache_val.get('Value') else 'No'} |",
        f"| Eyes open | {eyes_open} |",
        f"| Mouth open | {'Yes' if mouth_open_val.get('Value') else 'No'} |\n",
        "---\n",
        "## Personalized 30-Day Protocol\n",
        "### Week 1–2: Baseline",
        "- Maintain neutral expression and frontal pose for progress photos",
        "- AM routine: cleanser → moisturizer → SPF 30+",
        "- PM routine: gentle cleanser → hydrating moisturizer",
    ])

    if eyeglasses_val.get("Value"):
        parts.append("- **Remove glasses** for follow-up photos to improve periorbital accuracy")
    else:
        parts.append("- Continue protocol-compliant photo habits")

    parts.extend([
        "\n### Week 3–4: Targeted focus",
        f"- Address proportionality ({metrics.get('proportionality', 'N/A')}%) with posture awareness and balanced midface care",
        (
            "- Practice camera-at-eye-level to reduce head pitch"
            if abs(pose.get("Pitch", 0)) > 10
            else "- Maintain current frontal alignment"
        ),
        f"- Track symmetry ({metrics.get('symmetry', 'N/A')}%) with monthly comparison photos\n",
        "### Strengths to maintain",
        f"1. **Detection confidence** — {face_details.get('Confidence', 0):.1f}% face match quality",
        f"2. **Symmetry score** — {metrics.get('symmetry', 'N/A')}% from landmark analysis",
        f"3. **Image quality** — Sharpness {quality.get('Sharpness', 0):.0f}/100\n",
        "### Areas for review",
        f"1. **Head pitch** — {abs(pose.get('Pitch', 0)):.1f}° (ideal: near 0° for frontal analysis)",
        f"2. **Proportionality** — {metrics.get('proportionality', 'N/A')}% — review midface balance",
        f"3. **Expression** — {'Smile detected; use neutral expression for baseline' if smile_val.get('Value') else 'Neutral expression — good for analysis'}",
    ])

    return "\n".join(parts)
