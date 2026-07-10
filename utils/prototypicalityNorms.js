/** Demographic prototypicality norms — MediaPipe-calibrated cohort means. */

const DEFAULT_NORMS = {
  faceWidthHeight: 0.90,
  noseRatio: 0.30,
  upperThird: 0.31,
  middleThird: 0.27,
  lowerThird: 0.42,
}

const ETHNICITY_NORMS = {
  'east-asian': { faceWidthHeight: 0.88, noseRatio: 0.28, upperThird: 0.30, middleThird: 0.28, lowerThird: 0.42 },
  'south-asian': { faceWidthHeight: 0.89, noseRatio: 0.30, upperThird: 0.31, middleThird: 0.27, lowerThird: 0.42 },
  'southeast-asian': { faceWidthHeight: 0.88, noseRatio: 0.28, upperThird: 0.30, middleThird: 0.28, lowerThird: 0.42 },
  'middle-eastern': { faceWidthHeight: 0.91, noseRatio: 0.31, upperThird: 0.31, middleThird: 0.27, lowerThird: 0.41 },
  black: { faceWidthHeight: 0.92, noseRatio: 0.32, upperThird: 0.32, middleThird: 0.26, lowerThird: 0.42 },
  white: { faceWidthHeight: 0.90, noseRatio: 0.30, upperThird: 0.31, middleThird: 0.27, lowerThird: 0.42 },
  hispanic: { faceWidthHeight: 0.90, noseRatio: 0.30, upperThird: 0.31, middleThird: 0.27, lowerThird: 0.42 },
  mixed: { faceWidthHeight: 0.90, noseRatio: 0.30, upperThird: 0.31, middleThird: 0.27, lowerThird: 0.42 },
}

const GENDER_NORMS = {
  masculine: { faceWidthHeight: 0.03, noseRatio: 0.015 },
  feminine: { faceWidthHeight: -0.03, noseRatio: -0.012 },
  'no-preference': { faceWidthHeight: 0, noseRatio: 0 },
}

export function getPrototypicalityNorms(answers = {}) {
  const ethnicity = answers?.ethnicity || ''
  const genderPref = answers?.genderPreference || answers?.gender || 'no-preference'
  const ethnic = ETHNICITY_NORMS[ethnicity] || {}
  const gender = GENDER_NORMS[genderPref] || GENDER_NORMS['no-preference']

  return {
    faceWidthHeight: (ethnic.faceWidthHeight ?? DEFAULT_NORMS.faceWidthHeight) + (gender.faceWidthHeight ?? 0),
    noseRatio: (ethnic.noseRatio ?? DEFAULT_NORMS.noseRatio) + (gender.noseRatio ?? 0),
    upperThird: ethnic.upperThird ?? DEFAULT_NORMS.upperThird,
    middleThird: ethnic.middleThird ?? DEFAULT_NORMS.middleThird,
    lowerThird: ethnic.lowerThird ?? DEFAULT_NORMS.lowerThird,
    cohortKey: `${ethnicity || 'default'}:${genderPref || 'default'}`,
  }
}
