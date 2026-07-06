export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'goals', label: 'Your Goals' },
  { id: 'concerns', label: 'Skin Concerns' },
  { id: 'profile', label: 'About You' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'skincare', label: 'Skin Care' },
  { id: 'upload', label: 'Upload Photo' },
]

export const GOAL_OPTIONS = [
  { value: 'harmony', label: 'Facial Harmony', desc: 'Overall balance and aesthetic proportions' },
  { value: 'skin', label: 'Skin Health', desc: 'Texture, tone, pores, and clarity analysis' },
  { value: 'anti-aging', label: 'Anti-aging', desc: 'Fine lines, wrinkles, and age markers' },
  { value: 'structure', label: 'Facial Structure', desc: 'Bone structure, symmetry, and proportions' },
  { value: 'cosmetic', label: 'Cosmetic Consultation', desc: 'Preparation for professional advice' },
  { value: 'track', label: 'Track Progress', desc: 'Monitor changes over time' },
]

export const SKIN_CONCERN_OPTIONS = [
  { value: 'acne', label: 'Acne' },
  { value: 'pigmentation', label: 'Pigmentation' },
  { value: 'wrinkles', label: 'Wrinkles' },
  { value: 'dark-circles', label: 'Dark Circles' },
  { value: 'redness', label: 'Redness' },
  { value: 'scars', label: 'Scars' },
  { value: 'uneven-tone', label: 'Uneven Tone' },
  { value: 'none', label: 'None' },
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

export const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'daily', label: 'Daily' },
]

export const SLEEP_OPTIONS = [
  { value: 'excellent', label: 'Excellent', desc: '7–9 hours, consistent' },
  { value: 'good', label: 'Good', desc: '6–7 hours, mostly consistent' },
  { value: 'fair', label: 'Fair', desc: '5–6 hours, irregular' },
  { value: 'poor', label: 'Poor', desc: 'Less than 5 hours' },
]

export const WATER_OPTIONS = [
  { value: 'plenty', label: '8+ glasses', desc: 'Well hydrated' },
  { value: 'moderate', label: '5–7 glasses', desc: 'Adequately hydrated' },
  { value: 'low', label: '2–4 glasses', desc: 'Could drink more' },
  { value: 'minimal', label: '0–1 glasses', desc: 'Dehydrated' },
]

export const SUN_OPTIONS = [
  { value: 'minimal', label: 'Minimal', desc: 'Mostly indoors' },
  { value: 'moderate', label: 'Moderate', desc: 'Some outdoor time' },
  { value: 'high', label: 'High', desc: 'Frequent sun exposure' },
  { value: 'very-high', label: 'Very High', desc: 'Prolonged daily exposure' },
]

export const SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Mild', desc: 'Occasional, minor impact' },
  { value: 'moderate', label: 'Moderate', desc: 'Frequent, noticeable impact' },
  { value: 'severe', label: 'Severe', desc: 'Persistent, significant concern' },
]

export const ETHNICITY_OPTIONS = [
  { value: 'east-asian', label: 'East Asian' },
  { value: 'south-asian', label: 'South Asian' },
  { value: 'southeast-asian', label: 'Southeast Asian' },
  { value: 'middle-eastern', label: 'Middle Eastern' },
  { value: 'black', label: 'Black / African' },
  { value: 'white', label: 'White / European' },
  { value: 'hispanic', label: 'Hispanic / Latino' },
  { value: 'mixed', label: 'Mixed / Other' },
]

export const SKIN_TYPE_OPTIONS = [
  { value: 'oily', label: 'Oily', desc: 'Shiny, enlarged pores' },
  { value: 'dry', label: 'Dry', desc: 'Tight, flaky, rough' },
  { value: 'combination', label: 'Combination', desc: 'Oily T-zone, dry cheeks' },
  { value: 'normal', label: 'Normal', desc: 'Balanced, few issues' },
  { value: 'sensitive', label: 'Sensitive', desc: 'Easily irritated, reactive' },
]

export const SKINCARE_OPTIONS = [
  { value: 'none', label: 'No routine', desc: 'I rarely use products' },
  { value: 'minimal', label: 'Basic', desc: 'Cleanser + moisturizer' },
  { value: 'moderate', label: 'Moderate', desc: '4–5 products, some actives' },
  { value: 'extensive', label: 'Extensive', desc: '6+ products, regular actives' },
]

const goalLabels = Object.fromEntries(GOAL_OPTIONS.map((o) => [o.value, o.label]))
const concernLabels = Object.fromEntries(SKIN_CONCERN_OPTIONS.map((o) => [o.value, o.label]))
const ageLabels = Object.fromEntries(AGE_OPTIONS.map((o) => [o.value, o.label]))
const genderLabels = Object.fromEntries(GENDER_OPTIONS.map((o) => [o.value, o.label]))
const smokingLabels = Object.fromEntries(SMOKING_OPTIONS.map((o) => [o.value, o.label]))
const sleepLabels = Object.fromEntries(SLEEP_OPTIONS.map((o) => [o.value, o.label]))
const waterLabels = Object.fromEntries(WATER_OPTIONS.map((o) => [o.value, o.label]))
const sunLabels = Object.fromEntries(SUN_OPTIONS.map((o) => [o.value, o.label]))
const severityLabels = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label]))
const ethnicityLabels = Object.fromEntries(ETHNICITY_OPTIONS.map((o) => [o.value, o.label]))
const skinTypeLabels = Object.fromEntries(SKIN_TYPE_OPTIONS.map((o) => [o.value, o.label]))
const skincareLabels = Object.fromEntries(SKINCARE_OPTIONS.map((o) => [o.value, o.label]))

export function formatAnswersSummary(answers) {
  const goals = (answers.goals || []).map((g) => goalLabels[g] || g).join(', ') || 'not specified'
  const concerns = (answers.skinConcerns || []).map((c) => concernLabels[c] || c).join(', ') || 'none selected'
  const severity = severityLabels[answers.concernSeverity] || 'not specified'
  const ethnicity = ethnicityLabels[answers.ethnicity] || 'not specified'
  const skinType = skinTypeLabels[answers.skinType] || 'not specified'
  const skincareRoutine = skincareLabels[answers.skincareRoutine] || 'not specified'
  const occupation = answers.environment === 'outdoor' ? 'Outdoor' : answers.environment === 'mixed' ? 'Mixed indoor/outdoor' : answers.environment === 'indoor' ? 'Indoor' : 'not specified'
  const age = ageLabels[answers.ageRange] || answers.ageRange || 'not specified'
  const gender = genderLabels[answers.gender] || answers.gender || 'not specified'
  const smoking = smokingLabels[answers.smoking] || 'not specified'
  const sleep = sleepLabels[answers.sleepQuality] || 'not specified'
  const water = waterLabels[answers.waterIntake] || 'not specified'
  const sun = sunLabels[answers.sunExposure] || 'not specified'
  const medicalConditions = 'none reported'
  return { goals, concerns, severity, ethnicity, skinType, skincareRoutine, occupation, age, gender, smoking, sleep, water, sun, medicalConditions }
}
