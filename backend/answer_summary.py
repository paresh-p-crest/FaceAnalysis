"""Questionnaire answer label formatting for reports and narratives."""

from __future__ import annotations


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
    "rarely": "Rarely",
    "sometimes": "Sometimes",
    "often": "Often",
    "daily": "Daily",
}

DRINKING_LABELS = {
    "never": "Never",
    "rarely": "Rarely",
    "sometimes": "Sometimes",
    "often": "Often",
    "daily": "Daily",
}

GENDER_PREFERENCE_LABELS = {
    "masculine": "Masculine",
    "feminine": "Feminine",
    "no-preference": "No Preference",
}

TREATMENT_COMFORT_LABELS = {
    "injectables": "Injectables (minimally invasive)",
    "non-invasive": "Non-invasive treatments",
    "invasive": "Invasive treatments",
    "semi-permanent": "Semi-permanent enhancements",
}

GOAL_AESTHETIC_LABELS = {
    "refine": "Refine and enhance my facial aesthetic",
    "transform": "Significantly transform my facial aesthetic",
    "undecided": "Undecided",
}

AESTHETIC_DISTRESS_LABELS = {
    "no-distress": "No distress at all",
    "minor": "Minor distress",
    "moderate": "Moderate distress",
    "extreme": "Extreme distress and affects my day to day",
}

APPEARANCE_FREQUENCY_LABELS = {
    "rarely": "Rarely (a few times a week or less)",
    "occasionally": "Occasionally (once a day)",
    "frequently": "Frequently (multiple times a day)",
    "very-often": "Very often (most of the day)",
    "constantly": "Constantly (it's always on my mind)",
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

    # Real occupation field or environment fallback
    occupation = answers.get("occupation", "")
    if not occupation:
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

    # New answers
    drinking = DRINKING_LABELS.get(answers.get("drinking", ""), "not specified")
    gender_pref = GENDER_PREFERENCE_LABELS.get(answers.get("genderPreference", ""), "not specified")
    had_nonsurgical = answers.get("hadNonSurgical", "no")
    had_surgery = answers.get("hadSurgery", "no")

    comfort_list = answers.get("comfortableTreatments", []) or []
    comfortable_treatments = ", ".join(TREATMENT_COMFORT_LABELS.get(t, t) for t in comfort_list) or "none"

    med_cond = answers.get("medicalConditions", "no")
    medical_conditions = answers.get("medicalConditionsDetails", "") if med_cond == "yes" else "none reported"

    meds = answers.get("medications", "no")
    medications = answers.get("medicationsDetails", "") if meds == "yes" else "none reported"

    used_retinoids = answers.get("usedRetinoids", "no")

    allergies_val = answers.get("allergies", "no")
    allergies = answers.get("allergiesDetails", "") if allergies_val == "yes" else "none reported"

    infections_val = answers.get("activeInfections", "no")
    active_infections = answers.get("activeInfectionsDetails", "") if infections_val == "yes" else "none reported"

    prone_hyperpigmentation = answers.get("proneToHyperpigmentation", "no")

    feature_like = answers.get("featureLike", "not specified")
    feature_dislike = answers.get("featureDislike", "not specified")
    celebrity_match = answers.get("celebrityMatch", "not specified")
    comfortable_weightloss = answers.get("comfortableWeightLoss", "no")

    goal_aesthetic = GOAL_AESTHETIC_LABELS.get(answers.get("goalAesthetic", ""), "not specified")
    grow_beard = answers.get("growBeard", "no")
    aesthetic_distress = AESTHETIC_DISTRESS_LABELS.get(answers.get("aestheticDistress", ""), "not specified")
    appearance_frequency = APPEARANCE_FREQUENCY_LABELS.get(answers.get("appearanceFrequency", ""), "not specified")
    motivation = answers.get("motivation", "not specified")
    additional_notes = answers.get("additionalNotes", "not specified")

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
        "drinking": drinking,
        "genderPreference": gender_pref,
        "hadNonSurgical": had_nonsurgical,
        "hadSurgery": had_surgery,
        "comfortableTreatments": comfortable_treatments,
        "medicalConditions": medical_conditions,
        "medications": medications,
        "usedRetinoids": used_retinoids,
        "allergies": allergies,
        "activeInfections": active_infections,
        "proneToHyperpigmentation": prone_hyperpigmentation,
        "featureLike": feature_like,
        "featureDislike": feature_dislike,
        "celebrityMatch": celebrity_match,
        "comfortableWeightLoss": comfortable_weightloss,
        "goalAesthetic": goal_aesthetic,
        "growBeard": grow_beard,
        "aestheticDistress": aesthetic_distress,
        "appearanceFrequency": appearance_frequency,
        "motivation": motivation,
        "additionalNotes": additional_notes,
    }
