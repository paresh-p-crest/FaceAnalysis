export const ONBOARDING_STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'medical', label: 'Medical' },
  { id: 'goals', label: 'Goals' },
  { id: 'additional', label: 'Additional' },
  { id: 'upload', label: 'Upload Photo' },
]

export const FREQUENCY_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
  { value: 'daily', label: 'Daily' },
]

export const MASCULINE_FEMININE_OPTIONS = [
  { value: 'masculine', label: 'Masculine' },
  { value: 'feminine', label: 'Feminine' },
  { value: 'no-preference', label: 'No Preference' },
]

export const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

export const TREATMENT_COMFORT_OPTIONS = [
  { value: 'injectable', label: 'Injectable facial treatments' },
  { value: 'non-invasive', label: 'Non-invasive facelifts' },
  { value: 'surgical', label: 'Surgical treatments' },
  { value: 'none', label: "Don't want any procedures" },
]

export const AESTHETIC_GOAL_OPTIONS = [
  { value: 'refine', label: 'Refine and enhance my facial aesthetics' },
  { value: 'transform', label: 'Significantly transform my facial aesthetics' },
  { value: 'undecided', label: 'Undecided' },
]

export const AESTHETIC_DISTRESS_OPTIONS = [
  { value: 'none', label: 'No distress at all' },
  { value: 'mild', label: 'Mild distress' },
  { value: 'moderate', label: 'Moderate distress' },
  { value: 'extreme', label: 'Extreme distress and affects my day-to-day' },
]

export const THINK_APPEARANCE_OPTIONS = [
  { value: 'rarely', label: 'Rarely (a few times a month or less)' },
  { value: 'occasionally', label: 'Occasionally (a few times a week)' },
  { value: 'frequently', label: 'Frequently (multiple times a day)' },
  { value: 'very-often', label: 'Very often (most of the day)' },
  { value: 'constantly', label: "Constantly (it's always on my mind)" },
]

export function formatAnswersSummary(answers) {
  const occupation = answers.occupation || 'not specified'
  const smoking = answers.smoking || 'not specified'
  const drinking = answers.drinking || 'not specified'
  const masculineFeminine = answers.masculineFeminine || 'not specified'
  const priorTreatments = answers.priorTreatments || 'not specified'
  const comfortableTreatments = (answers.comfortableTreatments || []).join(', ') || 'none'
  const medicalConditions = answers.medicalConditions || 'not specified'
  const allergies = answers.allergies || 'not specified'
  const aestheticGoal = answers.aestheticGoal || 'not specified'
  const aestheticDistress = answers.aestheticDistress || 'not specified'
  const thinkAppearance = answers.thinkAppearance || 'not specified'
  const additionalInfo = answers.additionalInfo || 'none'

  return {
    occupation,
    smoking,
    drinking,
    masculineFeminine,
    priorTreatments,
    comfortableTreatments,
    medicalConditions,
    allergies,
    aestheticGoal,
    aestheticDistress,
    thinkAppearance,
    additionalInfo,
    // Backward compatibility mappings
    goals: aestheticGoal,
    concerns: comfortableTreatments,
    severity: aestheticDistress,
    ethnicity: 'not specified',
    skinType: 'not specified',
    skincareRoutine: 'not specified',
    age: 'not specified',
    gender: masculineFeminine,
    sleep: 'not specified',
    water: 'not specified',
    sun: 'not specified',
    medicalConditions: medicalConditions,
  }
}
