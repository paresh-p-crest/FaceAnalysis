export const OPENAI_REPORT_MODEL = 'gpt-4o-mini'

export const STAGES = {
  LANDING: 'landing',
  QUESTIONNAIRE: 'questionnaire',
  UPLOAD: 'upload',
  SCANNING: 'scanning',
  REPORT: 'report',
  HISTORY: 'history',
  BILLING: 'billing',
  DASHBOARD: 'dashboard',
  ADMIN: 'admin',
  PAYMENT_SUCCESS: 'payment_success',
}

export const PHOTO_POSES = [
  { id: 'front', label: 'Front Face', required: true, hint: 'Entire face head-on with a neutral expression' },
  { id: 'leftProfile', label: 'Left Profile', required: true, hint: 'Left side profile — full face from the left' },
  { id: 'rightProfile', label: 'Right Profile', required: true, hint: 'Right side profile — full face from the right' },
  { id: 'left45', label: 'Left 45°', required: true, hint: 'Three-quarter angle from the left' },
  { id: 'right45', label: 'Right 45°', required: true, hint: 'Three-quarter angle from the right' },
  { id: 'smile', label: 'Smile', required: true, hint: 'Smile naturally showing teeth — for smile shape & teeth analysis' },
  { id: 'topHead', label: 'Top of Head', required: true, hint: 'Tilt head down showing top of head & hairline — for hair density analysis' },
]

export const REQUIRED_PHOTO_POSE_IDS = PHOTO_POSES.filter((p) => p.required).map((p) => p.id)

export const SCAN_STAGES = [
  'Preparing images',
  'Detecting face',
  'Extracting landmarks',
  'Analyzing facial geometry',
  'Skin analysis',
  'Writing feature recommendations',
  'Building protocol narrative',
  'Preparing report',
]

/** Index at which NL enrichment stages begin (slower progress cadence). */
export const SCAN_NL_STAGE_INDEX = 5

export const INITIAL_ANSWERS = {
  // Existing fields
  goals: [],
  skinConcerns: [],
  ageRange: '',
  gender: '',
  ethnicity: '',
  concernSeverity: '',
  skinType: '',
  skincareRoutine: '',
  environment: '',
  smoking: '',
  sleepQuality: '',
  waterIntake: '',
  sunExposure: '',

  // New fields
  occupation: '',
  drinking: '',
  genderPreference: '',
  hadNonSurgical: '',
  hadSurgery: '',
  comfortableTreatments: [],
  medicalConditions: '',
  medicalConditionsDetails: '',
  medications: '',
  medicationsDetails: '',
  usedRetinoids: '',
  allergies: '',
  allergiesDetails: '',
  activeInfections: '',
  activeInfectionsDetails: '',
  proneToHyperpigmentation: '',
  featureLike: '',
  featureDislike: '',
  celebrityMatch: '',
  comfortableWeightLoss: '',
  goalAesthetic: '',
  growBeard: '',
  aestheticDistress: '',
  appearanceFrequency: '',
  motivation: '',
  additionalNotes: '',
}


