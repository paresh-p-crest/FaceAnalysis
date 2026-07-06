/**
 * Anthropometric reference ranges and deviation scoring.
 * Deterministic geometry from MediaPipe landmarks — no LLM.
 */

import { lm, FACE_OVAL } from './faceCrop'

const LM = {
  forehead: 10,
  chin: 152,
  noseTip: 1,
  noseBridge: 6,
  leftEyeOuter: 263,
  rightEyeOuter: 33,
  leftEyeInner: 133,
  rightEyeInner: 362,
  mouthLeft: 61,
  mouthRight: 291,
  leftBrow: 105,
  rightBrow: 334,
  jawL: 234,
  jawR: 454,
  cheekL: 127,
  cheekR: 356,
  noseBaseL: 48,
  noseBaseR: 278,
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function deviationPct(value, ideal, tolerance = 0.05) {
  const dev = Math.abs(value - ideal) / (ideal || 0.001)
  return Math.min(100, (dev / tolerance) * 100)
}

function scoreFromDeviation(devPct, weight = 1) {
  const raw = 100 - devPct * weight
  return Math.round(Math.min(99, Math.max(40, raw)))
}

/** Ideal ranges — literature-inspired aesthetic norms (normalized face coords) */
const REF = {
  thirds: { upper: 0.33, middle: 0.33, lower: 0.34 },
  fifths: { eyeWidth: 0.2, noseWidth: 0.2, intercanthal: 0.2 },
  interocularToFace: { ideal: 0.46, range: [0.40, 0.52] },
  canthalTiltDeg: { male: [2, 8], female: [4, 10], neutral: [0, 6] },
  noseWidthToIpd: { ideal: 0.38, range: [0.30, 0.48] },
  philtrumToLip: { ideal: 1.4, range: [1.0, 1.8] },
  jawWidthToFace: { male: [0.88, 0.96], female: [0.78, 0.88] },
  chinHeightRatio: { ideal: 0.08, range: [0.05, 0.12] },
  hairlineToBrow: { ideal: 0.18, range: [0.12, 0.24] },
}

export function computeAnthropometrics(landmarks, answers = {}) {
  if (!landmarks?.length) return null

  const gender = (answers.gender || answers.sex || 'male').toLowerCase()
  const isFemale = gender.includes('f') || gender === 'woman'

  const forehead = lm(landmarks, LM.forehead)
  const chin = lm(landmarks, LM.chin)
  const le = lm(landmarks, LM.leftEyeOuter)
  const re = lm(landmarks, LM.rightEyeOuter)
  const li = lm(landmarks, LM.leftEyeInner)
  const ri = lm(landmarks, LM.rightEyeInner)
  const lb = lm(landmarks, LM.leftBrow)
  const rb = lm(landmarks, LM.rightBrow)
  const ml = lm(landmarks, LM.mouthLeft)
  const mr = lm(landmarks, LM.mouthRight)
  const jawL = lm(landmarks, LM.jawL)
  const jawR = lm(landmarks, LM.jawR)
  const cheekL = lm(landmarks, LM.cheekL)
  const cheekR = lm(landmarks, LM.cheekR)
  const noseBaseL = lm(landmarks, LM.noseBaseL)
  const noseBaseR = lm(landmarks, LM.noseBaseR)
  const noseTip = lm(landmarks, LM.noseTip)
  const upperLip = lm(landmarks, 13)

  const faceH = Math.max(0.01, chin.y - forehead.y)
  const faceW = Math.max(0.01, dist(jawL, jawR))
  const ipd = Math.max(0.001, dist(li, ri))
  const browY = (lb.y + rb.y) / 2
  const mouthY = (ml.y + mr.y) / 2

  const upperThird = (browY - forehead.y) / faceH
  const middleThird = (mouthY - browY) / faceH
  const lowerThird = (chin.y - mouthY) / faceH

  const interocularRatio = ipd / faceW
  const mouthWidth = dist(ml, mr)
  const eyeWidthL = dist(lm(landmarks, 263), lm(landmarks, 362))
  const fifthEye = eyeWidthL / faceW
  const fifthNose = dist(noseBaseL, noseBaseR) / faceW
  const fifthMouth = mouthWidth / faceW

  const canthalL = (Math.atan2(le.y - li.y, le.x - li.x) * 180) / Math.PI
  const canthalR = (Math.atan2(re.y - ri.y, re.x - ri.x) * 180) / Math.PI
  const canthalTilt = (canthalL + canthalR) / 2

  const noseWidthRatio = dist(noseBaseL, noseBaseR) / ipd
  const philtrum = dist(noseTip, upperLip)
  const lipHeight = dist(upperLip, lm(landmarks, 17))
  const philtrumLipRatio = philtrum / (lipHeight || 0.001)

  const jawWidthRatio = faceW / dist(cheekL, cheekR)
  const chinHeight = dist(chin, upperLip) / faceH
  const hairlineRatio = (browY - forehead.y) / faceH

  const browAsym = Math.abs(lb.y - rb.y) / faceH
  const eyeAsym = Math.abs(le.y - re.y) / faceH
  const symmetryIndex = Math.max(0, 100 - (browAsym + eyeAsym) * 800)

  const tiltRef = isFemale ? REF.canthalTiltDeg.female : REF.canthalTiltDeg.male
  const jawRef = isFemale ? REF.jawWidthToFace.female : REF.jawWidthToFace.male

  const measurements = [
    { id: 'upperThird', label: 'Upper facial third', value: upperThird.toFixed(2), ideal: REF.thirds.upper.toFixed(2), unit: 'ratio' },
    { id: 'middleThird', label: 'Middle facial third', value: middleThird.toFixed(2), ideal: REF.thirds.middle.toFixed(2), unit: 'ratio' },
    { id: 'lowerThird', label: 'Lower facial third', value: lowerThird.toFixed(2), ideal: REF.thirds.lower.toFixed(2), unit: 'ratio' },
    { id: 'interocular', label: 'Interocular / face width', value: interocularRatio.toFixed(2), ideal: REF.interocularToFace.ideal.toFixed(2), unit: 'ratio' },
    { id: 'fifthEye', label: 'Eye width (facial fifth)', value: fifthEye.toFixed(2), ideal: REF.fifths.eyeWidth.toFixed(2), unit: 'ratio' },
    { id: 'fifthNose', label: 'Nose width (facial fifth)', value: fifthNose.toFixed(2), ideal: REF.fifths.noseWidth.toFixed(2), unit: 'ratio' },
    { id: 'canthalTilt', label: 'Canthal tilt', value: canthalTilt.toFixed(1), ideal: `${tiltRef[0]}–${tiltRef[1]}`, unit: '°' },
    { id: 'noseWidthIpd', label: 'Nasal width / IPD', value: noseWidthRatio.toFixed(2), ideal: REF.noseWidthToIpd.ideal.toFixed(2), unit: 'ratio' },
    { id: 'philtrumLip', label: 'Philtrum / lip height', value: philtrumLipRatio.toFixed(2), ideal: REF.philtrumToLip.ideal.toFixed(2), unit: 'ratio' },
    { id: 'jawWidth', label: 'Jaw / cheek width', value: jawWidthRatio.toFixed(2), ideal: `${jawRef[0]}–${jawRef[1]}`, unit: 'ratio' },
    { id: 'chinHeight', label: 'Chin height / face', value: chinHeight.toFixed(2), ideal: REF.chinHeightRatio.ideal.toFixed(2), unit: 'ratio' },
    { id: 'hairline', label: 'Hairline / brow distance', value: hairlineRatio.toFixed(2), ideal: REF.hairlineToBrow.ideal.toFixed(2), unit: 'ratio' },
    { id: 'symmetry', label: 'Symmetry index', value: symmetryIndex.toFixed(0), ideal: '90+', unit: '/100' },
  ]

  const deviations = {
    thirds: (deviationPct(upperThird, REF.thirds.upper) + deviationPct(middleThird, REF.thirds.middle) + deviationPct(lowerThird, REF.thirds.lower)) / 3,
    proportions: deviationPct(interocularRatio, REF.interocularToFace.ideal),
    canthal: canthalTilt < tiltRef[0] ? deviationPct(canthalTilt, tiltRef[0], 0.3) : canthalTilt > tiltRef[1] ? deviationPct(canthalTilt, tiltRef[1], 0.3) : 0,
    nose: deviationPct(noseWidthRatio, REF.noseWidthToIpd.ideal),
    jaw: jawWidthRatio < jawRef[0] ? deviationPct(jawWidthRatio, jawRef[0], 0.08) : jawWidthRatio > jawRef[1] ? deviationPct(jawWidthRatio, jawRef[1], 0.08) : 0,
    symmetry: 100 - symmetryIndex,
  }

  const featureScores = {
    symmetry: scoreFromDeviation(deviations.symmetry, 0.8),
    proportions: scoreFromDeviation(deviations.thirds + deviations.proportions, 0.4),
    eyes: scoreFromDeviation(deviations.canthal, 0.9),
    nose: scoreFromDeviation(deviations.nose, 0.85),
    jaw: scoreFromDeviation(deviations.jaw, 0.85),
    harmony: scoreFromDeviation((deviations.thirds + deviations.proportions + deviations.symmetry) / 3, 0.5),
  }

  return {
    measurements,
    deviations,
    featureScores,
    refs: REF,
    gender: isFemale ? 'female' : 'male',
    faceHeight: faceH,
    faceWidth: faceW,
    ipd,
  }
}

/** Projection correction strengths (5–15%) from measurement deviation */
export function projectionStrengths(anthropometrics, cvReport) {
  const dev = anthropometrics?.deviations || {}
  const clamp = (v) => Math.min(0.22, Math.max(0.12, v))

  const fromScore = (score) => clamp((88 - (score || 72)) / 100)

  return {
    hair: fromScore(cvReport?.hair?.score),
    eyebrows: clamp((dev.symmetry || 10) / 100 + fromScore(80)),
    eyes: clamp((dev.canthal || 8) / 120 + fromScore(cvReport?.eyes?.score)),
    skin: fromScore(cvReport?.skin?.score),
    nose: clamp((dev.nose || 8) / 110),
    jaw: clamp((dev.jaw || 8) / 100 + fromScore(cvReport?.jaw?.score || cvReport?.jawChin?.score)),
    lips: fromScore(cvReport?.lips?.score),
    cheeks: fromScore(cvReport?.cheeks?.score),
    chin: fromScore(cvReport?.chin?.score || cvReport?.jawChin?.score),
    neck: fromScore(cvReport?.neck?.score),
    ears: fromScore(cvReport?.ears?.score),
    full: clamp((deviationsAvg(dev) || 10) / 80),
  }
}

function deviationsAvg(dev) {
  const vals = Object.values(dev).filter((v) => typeof v === 'number')
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 10
}

export { FACE_OVAL, LM }
