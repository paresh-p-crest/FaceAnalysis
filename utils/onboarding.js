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
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
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

export const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
  { value: 'daily', label: 'Daily' },
]

export const GENDER_PREFERENCE_OPTIONS = [
  { value: 'masculine', label: 'Masculine' },
  { value: 'feminine', label: 'Feminine' },
  { value: 'no-preference', label: 'No Preference' },
]

export const TREATMENT_COMFORT_OPTIONS = [
  { value: 'injectables', label: 'Injectables (minimally invasive)', desc: 'Botox, Dermal Fillers, Fat-Dissolving Injections' },
  { value: 'non-invasive', label: 'Non-invasive treatments', desc: 'Laser, IPL/LED, Ultrasound, Radiofrequency Treatments' },
  { value: 'invasive', label: 'Invasive treatments', desc: 'Microneedling, Endo-Lift, Collagen-Stimulating Procedures' },
  { value: 'semi-permanent', label: 'Semi-permanent enhancements', desc: 'Microblading, Lip Blush, Tattoo-Based Treatments' },
]

export const GOAL_AESTHETIC_OPTIONS = [
  { value: 'refine', label: 'Refine and enhance my facial aesthetic' },
  { value: 'transform', label: 'Significantly transform my facial aesthetic' },
  { value: 'undecided', label: 'Undecided' },
]

export const AESTHETIC_DISTRESS_OPTIONS = [
  { value: 'no-distress', label: 'No distress at all' },
  { value: 'minor', label: 'Minor distress' },
  { value: 'moderate', label: 'Moderate distress' },
  { value: 'extreme', label: 'Extreme distress and affects my day to day' },
]

export const APPEARANCE_FREQUENCY_OPTIONS = [
  { value: 'rarely', label: 'Rarely (a few times a week or less)' },
  { value: 'occasionally', label: 'Occasionally (once a day)' },
  { value: 'frequently', label: 'Frequently (multiple times a day)' },
  { value: 'very-often', label: 'Very often (most of the day)' },
  { value: 'constantly', label: 'Constantly (it\'s always on my mind)' },
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

const genderPreferenceLabels = Object.fromEntries(GENDER_PREFERENCE_OPTIONS.map((o) => [o.value, o.label]))
const drinkingLabels = Object.fromEntries(DRINKING_OPTIONS.map((o) => [o.value, o.label]))
const goalAestheticLabels = Object.fromEntries(GOAL_AESTHETIC_OPTIONS.map((o) => [o.value, o.label]))
const distressLabels = Object.fromEntries(AESTHETIC_DISTRESS_OPTIONS.map((o) => [o.value, o.label]))
const appearanceFrequencyLabels = Object.fromEntries(APPEARANCE_FREQUENCY_OPTIONS.map((o) => [o.value, o.label]))

export function formatAnswersSummary(answers) {
  const goals = (answers.goals || []).map((g) => goalLabels[g] || g).join(', ') || 'not specified'
  const concerns = (answers.skinConcerns || []).map((c) => concernLabels[c] || c).join(', ') || 'none selected'
  const severity = severityLabels[answers.concernSeverity] || 'not specified'
  const ethnicity = ethnicityLabels[answers.ethnicity] || 'not specified'
  const skinType = skinTypeLabels[answers.skinType] || 'not specified'
  const skincareRoutine = skincareLabels[answers.skincareRoutine] || 'not specified'
  
  // Real occupation
  const occupation = answers.occupation || (answers.environment === 'outdoor' ? 'Outdoor' : answers.environment === 'mixed' ? 'Mixed indoor/outdoor' : answers.environment === 'indoor' ? 'Indoor' : 'not specified')
  
  const age = ageLabels[answers.ageRange] || answers.ageRange || 'not specified'
  const gender = genderLabels[answers.gender] || answers.gender || 'not specified'
  const smoking = smokingLabels[answers.smoking] || 'not specified'
  const sleep = sleepLabels[answers.sleepQuality] || 'not specified'
  const water = waterLabels[answers.waterIntake] || 'not specified'
  const sun = sunLabels[answers.sunExposure] || 'not specified'
  
  // New fields mapping
  const drinking = drinkingLabels[answers.drinking] || answers.drinking || 'not specified'
  const genderPreference = genderPreferenceLabels[answers.genderPreference] || answers.genderPreference || 'not specified'
  const hadNonSurgical = answers.hadNonSurgical || 'no'
  const hadSurgery = answers.hadSurgery || 'no'
  const comfortableTreatments = (answers.comfortableTreatments || []).map(val => {
    const matched = TREATMENT_COMFORT_OPTIONS.find(o => o.value === val)
    return matched ? matched.label : val
  }).join(', ') || 'none'
  const medicalConditions = answers.medicalConditions === 'yes' ? answers.medicalConditionsDetails || 'yes' : 'none reported'
  const medications = answers.medications === 'yes' ? answers.medicationsDetails || 'yes' : 'none reported'
  const usedRetinoids = answers.usedRetinoids || 'no'
  const allergies = answers.allergies === 'yes' ? answers.allergiesDetails || 'yes' : 'none reported'
  const activeInfections = answers.activeInfections === 'yes' ? answers.activeInfectionsDetails || 'yes' : 'none reported'
  const proneToHyperpigmentation = answers.proneToHyperpigmentation || 'no'
  const featureLike = answers.featureLike || 'not specified'
  const featureDislike = answers.featureDislike || 'not specified'
  const celebrityMatch = answers.celebrityMatch || 'not specified'
  const comfortableWeightLoss = answers.comfortableWeightLoss || 'no'
  const goalAesthetic = goalAestheticLabels[answers.goalAesthetic] || answers.goalAesthetic || 'not specified'
  const growBeard = answers.growBeard || 'no'
  const aestheticDistress = distressLabels[answers.aestheticDistress] || answers.aestheticDistress || 'not specified'
  const appearanceFrequency = appearanceFrequencyLabels[answers.appearanceFrequency] || answers.appearanceFrequency || 'not specified'
  const motivation = answers.motivation || 'not specified'
  const additionalNotes = answers.additionalNotes || 'not specified'

  return {
    goals, concerns, severity, ethnicity, skinType, skincareRoutine, occupation, age, gender, smoking, sleep, water, sun,
    drinking, genderPreference, hadNonSurgical, hadSurgery, comfortableTreatments, medicalConditions, medications,
    usedRetinoids, allergies, activeInfections, proneToHyperpigmentation, featureLike, featureDislike, celebrityMatch,
    comfortableWeightLoss, goalAesthetic, growBeard, aestheticDistress, appearanceFrequency, motivation, additionalNotes
  }
}
