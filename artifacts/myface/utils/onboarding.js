export const ONBOARDING_STEPS = [
  { id: 'welcome', labelKey: 'steps.welcome' },
  { id: 'goals', labelKey: 'steps.goals' },
  { id: 'concerns', labelKey: 'steps.concerns' },
  { id: 'profile', labelKey: 'steps.profile' },
  { id: 'lifestyle', labelKey: 'steps.lifestyle' },
  { id: 'skincare', labelKey: 'steps.skincare' },
  { id: 'upload', labelKey: 'steps.uploadPhoto' },
]

export const GOAL_OPTIONS = [
  { value: 'harmony', labelKey: 'options.goals.harmony.label', descriptionKey: 'options.goals.harmony.description' },
  { value: 'skin', labelKey: 'options.goals.skin.label', descriptionKey: 'options.goals.skin.description' },
  { value: 'anti-aging', labelKey: 'options.goals.antiAging.label', descriptionKey: 'options.goals.antiAging.description' },
  { value: 'structure', labelKey: 'options.goals.structure.label', descriptionKey: 'options.goals.structure.description' },
  { value: 'cosmetic', labelKey: 'options.goals.cosmetic.label', descriptionKey: 'options.goals.cosmetic.description' },
  { value: 'track', labelKey: 'options.goals.track.label', descriptionKey: 'options.goals.track.description' },
]

export const SKIN_CONCERN_OPTIONS = [
  { value: 'acne', labelKey: 'options.skinConcerns.acne.label' },
  { value: 'pigmentation', labelKey: 'options.skinConcerns.pigmentation.label' },
  { value: 'wrinkles', labelKey: 'options.skinConcerns.wrinkles.label' },
  { value: 'dark-circles', labelKey: 'options.skinConcerns.darkCircles.label' },
  { value: 'redness', labelKey: 'options.skinConcerns.redness.label' },
  { value: 'scars', labelKey: 'options.skinConcerns.scars.label' },
  { value: 'uneven-tone', labelKey: 'options.skinConcerns.unevenTone.label' },
  { value: 'none', labelKey: 'options.skinConcerns.none.label' },
]

export const AGE_OPTIONS = [
  { value: '18-24', labelKey: 'options.age.18-24.label' },
  { value: '25-34', labelKey: 'options.age.25-34.label' },
  { value: '35-44', labelKey: 'options.age.35-44.label' },
  { value: '45-54', labelKey: 'options.age.45-54.label' },
  { value: '55+', labelKey: 'options.age.55+.label' },
]

export const GENDER_OPTIONS = [
  { value: 'female', labelKey: 'options.gender.female.label' },
  { value: 'male', labelKey: 'options.gender.male.label' },
  { value: 'non-binary', labelKey: 'options.gender.nonBinary.label' },
  { value: 'prefer-not', labelKey: 'options.gender.preferNot.label' },
]

export const SMOKING_OPTIONS = [
  { value: 'never', labelKey: 'options.smoking.never.label' },
  { value: 'rarely', labelKey: 'options.smoking.rarely.label' },
  { value: 'sometimes', labelKey: 'options.smoking.sometimes.label' },
  { value: 'often', labelKey: 'options.smoking.often.label' },
  { value: 'daily', labelKey: 'options.smoking.daily.label' },
]

export const SLEEP_OPTIONS = [
  { value: 'excellent', labelKey: 'options.sleep.excellent.label', descriptionKey: 'options.sleep.excellent.description' },
  { value: 'good', labelKey: 'options.sleep.good.label', descriptionKey: 'options.sleep.good.description' },
  { value: 'fair', labelKey: 'options.sleep.fair.label', descriptionKey: 'options.sleep.fair.description' },
  { value: 'poor', labelKey: 'options.sleep.poor.label', descriptionKey: 'options.sleep.poor.description' },
]

export const WATER_OPTIONS = [
  { value: 'plenty', labelKey: 'options.water.plenty.label', descriptionKey: 'options.water.plenty.description' },
  { value: 'moderate', labelKey: 'options.water.moderate.label', descriptionKey: 'options.water.moderate.description' },
  { value: 'low', labelKey: 'options.water.low.label', descriptionKey: 'options.water.low.description' },
  { value: 'minimal', labelKey: 'options.water.minimal.label', descriptionKey: 'options.water.minimal.description' },
]

export const SUN_OPTIONS = [
  { value: 'minimal', labelKey: 'options.sun.minimal.label', descriptionKey: 'options.sun.minimal.description' },
  { value: 'moderate', labelKey: 'options.sun.moderate.label', descriptionKey: 'options.sun.moderate.description' },
  { value: 'high', labelKey: 'options.sun.high.label', descriptionKey: 'options.sun.high.description' },
  { value: 'very-high', labelKey: 'options.sun.veryHigh.label', descriptionKey: 'options.sun.veryHigh.description' },
]

export const SEVERITY_OPTIONS = [
  { value: 'mild', labelKey: 'options.severity.mild.label', descriptionKey: 'options.severity.mild.description' },
  { value: 'moderate', labelKey: 'options.severity.moderate.label', descriptionKey: 'options.severity.moderate.description' },
  { value: 'severe', labelKey: 'options.severity.severe.label', descriptionKey: 'options.severity.severe.description' },
]

export const ETHNICITY_OPTIONS = [
  { value: 'east-asian', labelKey: 'options.ethnicity.eastAsian.label' },
  { value: 'south-asian', labelKey: 'options.ethnicity.southAsian.label' },
  { value: 'southeast-asian', labelKey: 'options.ethnicity.southeastAsian.label' },
  { value: 'middle-eastern', labelKey: 'options.ethnicity.middleEastern.label' },
  { value: 'black', labelKey: 'options.ethnicity.black.label' },
  { value: 'white', labelKey: 'options.ethnicity.white.label' },
  { value: 'hispanic', labelKey: 'options.ethnicity.hispanic.label' },
  { value: 'mixed', labelKey: 'options.ethnicity.mixed.label' },
]

export const SKIN_TYPE_OPTIONS = [
  { value: 'oily', labelKey: 'options.skinType.oily.label', descriptionKey: 'options.skinType.oily.description' },
  { value: 'dry', labelKey: 'options.skinType.dry.label', descriptionKey: 'options.skinType.dry.description' },
  { value: 'combination', labelKey: 'options.skinType.combination.label', descriptionKey: 'options.skinType.combination.description' },
  { value: 'normal', labelKey: 'options.skinType.normal.label', descriptionKey: 'options.skinType.normal.description' },
  { value: 'sensitive', labelKey: 'options.skinType.sensitive.label', descriptionKey: 'options.skinType.sensitive.description' },
]

export const SKINCARE_OPTIONS = [
  { value: 'none', labelKey: 'options.skincare.none.label', descriptionKey: 'options.skincare.none.description' },
  { value: 'minimal', labelKey: 'options.skincare.minimal.label', descriptionKey: 'options.skincare.minimal.description' },
  { value: 'moderate', labelKey: 'options.skincare.moderate.label', descriptionKey: 'options.skincare.moderate.description' },
  { value: 'extensive', labelKey: 'options.skincare.extensive.label', descriptionKey: 'options.skincare.extensive.description' },
]

export const DRINKING_OPTIONS = [
  { value: 'never', labelKey: 'options.drinking.never.label' },
  { value: 'rarely', labelKey: 'options.drinking.rarely.label' },
  { value: 'sometimes', labelKey: 'options.drinking.sometimes.label' },
  { value: 'often', labelKey: 'options.drinking.often.label' },
  { value: 'daily', labelKey: 'options.drinking.daily.label' },
]

export const GENDER_PREFERENCE_OPTIONS = [
  { value: 'masculine', labelKey: 'options.genderPreference.masculine.label' },
  { value: 'feminine', labelKey: 'options.genderPreference.feminine.label' },
  { value: 'no-preference', labelKey: 'options.genderPreference.noPreference.label' },
]

export const TREATMENT_COMFORT_OPTIONS = [
  { value: 'injectables', labelKey: 'options.treatmentComfort.injectables.label', descriptionKey: 'options.treatmentComfort.injectables.description' },
  { value: 'non-invasive', labelKey: 'options.treatmentComfort.nonInvasive.label', descriptionKey: 'options.treatmentComfort.nonInvasive.description' },
  { value: 'invasive', labelKey: 'options.treatmentComfort.invasive.label', descriptionKey: 'options.treatmentComfort.invasive.description' },
  { value: 'semi-permanent', labelKey: 'options.treatmentComfort.semiPermanent.label', descriptionKey: 'options.treatmentComfort.semiPermanent.description' },
]

export const GOAL_AESTHETIC_OPTIONS = [
  { value: 'refine', labelKey: 'options.goalAesthetic.refine.label' },
  { value: 'transform', labelKey: 'options.goalAesthetic.transform.label' },
  { value: 'undecided', labelKey: 'options.goalAesthetic.undecided.label' },
]

export const AESTHETIC_DISTRESS_OPTIONS = [
  { value: 'no-distress', labelKey: 'options.aestheticDistress.noDistress.label' },
  { value: 'minor', labelKey: 'options.aestheticDistress.minor.label' },
  { value: 'moderate', labelKey: 'options.aestheticDistress.moderate.label' },
  { value: 'extreme', labelKey: 'options.aestheticDistress.extreme.label' },
]

export const APPEARANCE_FREQUENCY_OPTIONS = [
  { value: 'rarely', labelKey: 'options.appearanceFrequency.rarely.label' },
  { value: 'occasionally', labelKey: 'options.appearanceFrequency.occasionally.label' },
  { value: 'frequently', labelKey: 'options.appearanceFrequency.frequently.label' },
  { value: 'very-often', labelKey: 'options.appearanceFrequency.veryOften.label' },
  { value: 'constantly', labelKey: 'options.appearanceFrequency.constantly.label' },
]

/** Resolve an option's label via next-intl `t`, or fall back to raw value. */
export function optionLabel(option, t) {
  if (!option?.labelKey) return option?.value ?? ''
  return t ? t(option.labelKey) : option.value
}

/** Resolve an option's description via next-intl `t`. */
export function optionDescription(option, t) {
  if (!option?.descriptionKey || !t) return ''
  return t(option.descriptionKey)
}

function labelsFromOptions(options, values, t) {
  return (values || []).map((v) => {
    const opt = options.find((o) => o.value === v)
    return opt ? optionLabel(opt, t) : v
  }).join(', ')
}

function labelFromOptions(options, value, t) {
  const opt = options.find((o) => o.value === value)
  return opt ? optionLabel(opt, t) : (value || '')
}

export function formatAnswersSummary(answers, t) {
  const ns = (key) => (t ? t(`summary.${key}`) : key)

  const goals = labelsFromOptions(GOAL_OPTIONS, answers.goals, t) || ns('notSpecified')
  const concerns = labelsFromOptions(SKIN_CONCERN_OPTIONS, answers.skinConcerns, t) || ns('noneSelected')
  const severity = labelFromOptions(SEVERITY_OPTIONS, answers.concernSeverity, t) || ns('notSpecified')
  const ethnicity = labelFromOptions(ETHNICITY_OPTIONS, answers.ethnicity, t) || ns('notSpecified')
  const skinType = labelFromOptions(SKIN_TYPE_OPTIONS, answers.skinType, t) || ns('notSpecified')
  const skincareRoutine = labelFromOptions(SKINCARE_OPTIONS, answers.skincareRoutine, t) || ns('notSpecified')

  const occupation = answers.occupation || (
    answers.environment === 'outdoor' ? ns('outdoor')
      : answers.environment === 'mixed' ? ns('mixedEnvironment')
        : answers.environment === 'indoor' ? ns('indoor')
          : ns('notSpecified')
  )

  const age = labelFromOptions(AGE_OPTIONS, answers.ageRange, t) || answers.ageRange || ns('notSpecified')
  const gender = labelFromOptions(GENDER_OPTIONS, answers.gender, t) || answers.gender || ns('notSpecified')
  const smoking = labelFromOptions(SMOKING_OPTIONS, answers.smoking, t) || ns('notSpecified')
  const sleep = labelFromOptions(SLEEP_OPTIONS, answers.sleepQuality, t) || ns('notSpecified')
  const water = labelFromOptions(WATER_OPTIONS, answers.waterIntake, t) || ns('notSpecified')
  const sun = labelFromOptions(SUN_OPTIONS, answers.sunExposure, t) || ns('notSpecified')

  const drinking = labelFromOptions(DRINKING_OPTIONS, answers.drinking, t) || answers.drinking || ns('notSpecified')
  const genderPreference = labelFromOptions(GENDER_PREFERENCE_OPTIONS, answers.genderPreference, t) || answers.genderPreference || ns('notSpecified')
  const hadNonSurgical = answers.hadNonSurgical || 'no'
  const hadSurgery = answers.hadSurgery || 'no'
  const comfortableTreatments = labelsFromOptions(TREATMENT_COMFORT_OPTIONS, answers.comfortableTreatments, t) || ns('none')
  const medicalConditions = answers.medicalConditions === 'yes' ? answers.medicalConditionsDetails || 'yes' : ns('noneReported')
  const medications = answers.medications === 'yes' ? answers.medicationsDetails || 'yes' : ns('noneReported')
  const usedRetinoids = answers.usedRetinoids || 'no'
  const allergies = answers.allergies === 'yes' ? answers.allergiesDetails || 'yes' : ns('noneReported')
  const activeInfections = answers.activeInfections === 'yes' ? answers.activeInfectionsDetails || 'yes' : ns('noneReported')
  const proneToHyperpigmentation = answers.proneToHyperpigmentation || 'no'
  const featureLike = answers.featureLike || ns('notSpecified')
  const featureDislike = answers.featureDislike || ns('notSpecified')
  const celebrityMatch = answers.celebrityMatch || ns('notSpecified')
  const comfortableWeightLoss = answers.comfortableWeightLoss || 'no'
  const goalAesthetic = labelFromOptions(GOAL_AESTHETIC_OPTIONS, answers.goalAesthetic, t) || answers.goalAesthetic || ns('notSpecified')
  const growBeard = answers.growBeard || 'no'
  const aestheticDistress = labelFromOptions(AESTHETIC_DISTRESS_OPTIONS, answers.aestheticDistress, t) || answers.aestheticDistress || ns('notSpecified')
  const appearanceFrequency = labelFromOptions(APPEARANCE_FREQUENCY_OPTIONS, answers.appearanceFrequency, t) || answers.appearanceFrequency || ns('notSpecified')
  const motivation = answers.motivation || ns('notSpecified')
  const additionalNotes = answers.additionalNotes || ns('notSpecified')

  return {
    goals, concerns, severity, ethnicity, skinType, skincareRoutine, occupation, age, gender, smoking, sleep, water, sun,
    drinking, genderPreference, hadNonSurgical, hadSurgery, comfortableTreatments, medicalConditions, medications,
    usedRetinoids, allergies, activeInfections, proneToHyperpigmentation, featureLike, featureDislike, celebrityMatch,
    comfortableWeightLoss, goalAesthetic, growBeard, aestheticDistress, appearanceFrequency, motivation, additionalNotes,
  }
}
