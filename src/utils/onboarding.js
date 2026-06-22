export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'goals', label: 'Your Goals' },
  { id: 'concerns', label: 'Skin Concerns' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'profile', label: 'Age & Gender' },
  { id: 'upload', label: 'Upload Photo' },
]

export const GOAL_OPTIONS = [
  { value: 'structure', label: 'Understand my facial structure', desc: 'Bone structure, facial thirds, proportions' },
  { value: 'cosmetic', label: 'Explore cosmetic enhancements', desc: 'Filler, Botox, or surgical considerations' },
  { value: 'confidence', label: 'Boost self-confidence', desc: 'Understand your unique attractiveness factors' },
  { value: 'skin', label: 'Improve skin health & texture', desc: 'Pores, tone, redness, oiliness analysis' },
  { value: 'track', label: 'Track changes over time', desc: 'Compare reports to monitor improvement' },
  { value: 'consultation', label: 'Prepare for a consultation', desc: 'Get a detailed brief for your dermatologist' },
]

export const SKIN_CONCERN_OPTIONS = [
  { value: 'redness', label: 'Redness & Rosacea' },
  { value: 'pores', label: 'Enlarged Pores' },
  { value: 'dryness', label: 'Dryness & Dehydration' },
  { value: 'dark-spots', label: 'Dark Spots & Hyperpigmentation' },
  { value: 'acne', label: 'Acne & Breakouts' },
  { value: 'fine-lines', label: 'Fine Lines & Wrinkles' },
  { value: 'uneven-tone', label: 'Uneven Skin Tone' },
  { value: 'under-eye', label: 'Under-eye Circles' },
  { value: 'oil', label: 'Excess Oil & Shine' },
  { value: 'firmness', label: 'Loss of Firmness' },
  { value: 'sun-damage', label: 'Sun Damage' },
  { value: 'scarring', label: 'Scarring & Texture' },
]

export const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', desc: 'Barely noticeable' },
  { value: 'moderate', label: 'Moderate', desc: 'Noticeable daily' },
  { value: 'significant', label: 'Significant', desc: 'Affects confidence' },
  { value: 'severe', label: 'Severe', desc: 'Constant concern' },
]

export const AGE_OPTIONS = [
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55+', label: '55+' },
]

export const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not', label: 'Prefer not to say' },
]

export const OCCUPATION_OPTIONS = [
  { value: 'office', label: 'Office / Desk work', desc: 'Mostly indoors, screen time' },
  { value: 'outdoor', label: 'Outdoor / Field work', desc: 'Regular sun and environmental exposure' },
  { value: 'healthcare', label: 'Healthcare', desc: 'Clinical or hospital environment' },
  { value: 'hospitality', label: 'Hospitality / Retail', desc: 'Customer-facing, variable hours' },
  { value: 'student', label: 'Student', desc: 'Academic schedule' },
  { value: 'other', label: 'Other', desc: 'Different work environment' },
]

export const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never', desc: 'Non-smoker' },
  { value: 'occasionally', label: 'Occasionally', desc: 'Social or rare use' },
  { value: 'regularly', label: 'Regularly', desc: 'Several times a week' },
  { value: 'daily', label: 'Daily', desc: 'Every day or most days' },
]

export const MEDICAL_CONDITION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'eczema', label: 'Eczema / Dermatitis' },
  { value: 'rosacea', label: 'Rosacea' },
  { value: 'psoriasis', label: 'Psoriasis' },
  { value: 'acne', label: 'Chronic Acne' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'thyroid', label: 'Thyroid condition' },
  { value: 'allergies', label: 'Skin allergies' },
  { value: 'autoimmune', label: 'Autoimmune condition' },
]

const goalLabels = Object.fromEntries(GOAL_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]))
const concernLabels = Object.fromEntries(SKIN_CONCERN_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]))
const severityLabels = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]))
const occupationLabels = Object.fromEntries(OCCUPATION_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]))
const smokingLabels = Object.fromEntries(SMOKING_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]))
const medicalLabels = Object.fromEntries(MEDICAL_CONDITION_OPTIONS.map((o) => [o.value, o.label.toLowerCase()]))

export function formatAnswersSummary(answers) {
  const goals = (answers.goals || []).map((g) => goalLabels[g] || g).join(', ') || 'not specified'
  const concerns = (answers.skinConcerns || []).map((c) => concernLabels[c] || c).join(', ') || 'none selected'
  const severity = severityLabels[answers.concernSeverity] || 'not specified'
  const occupation = occupationLabels[answers.occupation] || 'not specified'
  const smoking = smokingLabels[answers.smoking] || 'not specified'
  const medicalConditions =
    (answers.medicalConditions || [])
      .filter((m) => m !== 'none')
      .map((m) => medicalLabels[m] || m)
      .join(', ') || 'none reported'
  const age = answers.ageRange || 'not specified'
  const gender = answers.gender || 'not specified'
  return { goals, concerns, severity, occupation, smoking, medicalConditions, age, gender }
}
