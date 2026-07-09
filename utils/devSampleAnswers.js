/**
 * DEV ONLY — delete this file before production.
 * Sample questionnaire answers (all 23 Qoves onboarding questions).
 */
import { INITIAL_ANSWERS } from './constants'

export const DEV_SAMPLE_QUESTIONNAIRE_ANSWERS = {
  ...INITIAL_ANSWERS,
  occupation: 'Software Engineer',
  smoking: 'never',
  drinking: 'rarely',
  genderPreference: 'masculine',
  hadNonSurgical: 'no',
  hadSurgery: 'no',
  comfortableTreatments: ['non-invasive', 'injectables'],
  medicalConditions: 'no',
  medicalConditionsDetails: '',
  medications: 'no',
  medicationsDetails: '',
  usedRetinoids: 'no',
  allergies: 'no',
  allergiesDetails: '',
  activeInfections: 'no',
  activeInfectionsDetails: '',
  proneToHyperpigmentation: 'no',
  featureLike: 'Eyes',
  featureDislike: 'Jawline definition',
  celebrityMatch: 'None specific',
  comfortableWeightLoss: 'yes',
  goalAesthetic: 'refine',
  growBeard: 'yes',
  aestheticDistress: 'minor',
  appearanceFrequency: 'occasionally',
  motivation: 'Dev shortcut — testing the facial analysis pipeline end to end.',
  additionalNotes: 'Filled via DEV skip button.',
  // Legacy fields still referenced by answer summaries / norms
  goals: ['harmony', 'structure'],
  skinConcerns: ['uneven-tone'],
  ageRange: '25-34',
  gender: 'male',
  ethnicity: 'white',
  concernSeverity: 'mild',
  skinType: 'combination',
  skincareRoutine: 'moderate',
  environment: 'Urban office, moderate AC',
  sleepQuality: 'good',
  waterIntake: 'moderate',
  sunExposure: 'moderate',
}
