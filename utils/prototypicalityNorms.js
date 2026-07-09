/** Demographic prototypicality norms — cohort-adjusted population means. */

const DEFAULT_NORMS = {
  faceWidthHeight: 0.69,
  noseRatio: 0.17,
  upperThird: 0.33,
  middleThird: 0.34,
  lowerThird: 0.33,
}

const ETHNICITY_NORMS = {
  'east-asian': { faceWidthHeight: 0.72, noseRatio: 0.16, upperThird: 0.32, middleThird: 0.35, lowerThird: 0.33 },
  'south-asian': { faceWidthHeight: 0.70, noseRatio: 0.17, upperThird: 0.33, middleThird: 0.34, lowerThird: 0.33 },
  'southeast-asian': { faceWidthHeight: 0.71, noseRatio: 0.16, upperThird: 0.32, middleThird: 0.35, lowerThird: 0.33 },
  'middle-eastern': { faceWidthHeight: 0.68, noseRatio: 0.18, upperThird: 0.33, middleThird: 0.34, lowerThird: 0.33 },
  'black': { faceWidthHeight: 0.67, noseRatio: 0.18, upperThird: 0.34, middleThird: 0.33, lowerThird: 0.33 },
  'white': { faceWidthHeight: 0.69, noseRatio: 0.17, upperThird: 0.33, middleThird: 0.34, lowerThird: 0.33 },
  'hispanic': { faceWidthHeight: 0.68, noseRatio: 0.17, upperThird: 0.33, middleThird: 0.34, lowerThird: 0.33 },
  'mixed': { faceWidthHeight: 0.69, noseRatio: 0.17, upperThird: 0.33, middleThird: 0.34, lowerThird: 0.33 },
}

const GENDER_NORMS = {
  masculine: { faceWidthHeight: 0.02, noseRatio: 0.01 },
  feminine: { faceWidthHeight: -0.02, noseRatio: -0.008 },
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
