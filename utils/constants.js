export const OPENAI_REPORT_MODEL = 'gpt-4o-mini'

export const STAGES = {
  LANDING: 'landing',
  QUESTIONNAIRE: 'questionnaire',
  PROTOCOL: 'protocol',
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
  { id: 'leftProfile', label: 'Left Profile', required: false, hint: 'Left side profile (optional)' },
  { id: 'rightProfile', label: 'Right Profile', required: false, hint: 'Right side profile (optional)' },
  { id: 'left45', label: 'Left 45°', required: false, hint: 'Three-quarter angle from left (optional)' },
  { id: 'right45', label: 'Right 45°', required: false, hint: 'Three-quarter angle from right (optional)' },
  { id: 'smile', label: 'Smile', required: false, hint: 'Smile naturally showing teeth — helps analyze smile shape & teeth' },
  { id: 'topHead', label: 'Top of Head', required: false, hint: 'Tilt head down showing top of head & hairline — helps analyze hair density' },
]

export const SCAN_STAGES = [
  'Preparing images',
  'Detecting face',
  'Extracting landmarks',
  'Analyzing facial geometry',
  'Skin analysis',
  'Generating recommendations',
  'Preparing report',
]

export const SCAN_MESSAGES = [
  'Locating 468 facial landmark points…',
  'Mapping facial thirds & fifths…',
  'Calculating symmetry indices…',
  'Assessing jawline & chin geometry…',
  'Evaluating periorbital structure…',
  'Cross-referencing demographic norms…',
  'Generating personalized protocol…',
]

export const INITIAL_ANSWERS = {
  goals: ['structure'],
  skinConcerns: ['none'],
  ageRange: '25-34',
  gender: 'male',
  ethnicity: 'south-asian',
  concernSeverity: 'mild',
  skinType: 'combination',
  skincareRoutine: 'minimal',
  environment: 'mixed',
  smoking: 'never',
  sleepQuality: 'good',
  waterIntake: 'moderate',
  sunExposure: 'moderate',
}


