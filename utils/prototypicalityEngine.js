/**
 * Proportion-conformity engine (client label: Prototypicality).
 * Mirrors backend/prototypicality.py — see docs/architecture/prototypicality.md
 */
import {
  FACE_OVAL,
  RIGHT_EYE,
  LEFT_EYE,
  RIGHT_BROW,
  LEFT_BROW,
  lm,
} from './faceCrop'
import { getPrototypicalityNorms } from './prototypicalityNorms'

export const METHODOLOGY = 'five_ratio_proportion_conformity'

const SCORE_WEIGHTS = {
  'jaw width': 0.24,
  'facial thirds': 0.22,
  symmetry: 0.10,
  nose: 0.22,
  brows: 0.22,
}

const SCORE_BASE = 84
const SCORE_PENALTY_SCALE = 195
const MAX_FEATURE_MAGNITUDE = 0.38

const FEATURE_TOPOLOGY = [
  { id: 'jaw', type: 'polyline', indices: FACE_OVAL, strokeWidth: 1.1 },
  { id: 'browR', type: 'polyline', indices: subsample(RIGHT_BROW, 11), strokeWidth: 1.25 },
  { id: 'browL', type: 'polyline', indices: subsample(LEFT_BROW, 11), strokeWidth: 1.25 },
  { id: 'eyeR', type: 'polyline', indices: subsample(RIGHT_EYE, 14), strokeWidth: 1.0 },
  { id: 'eyeL', type: 'polyline', indices: subsample(LEFT_EYE, 14), strokeWidth: 1.0 },
  { id: 'noseBridge', type: 'polyline', indices: [168, 6, 197, 195, 5, 4, 1], strokeWidth: 1.05 },
  { id: 'noseWing', type: 'polyline', indices: [98, 97, 2, 326, 327], strokeWidth: 1.0 },
  { id: 'lipUpper', type: 'polyline', indices: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], strokeWidth: 1.05 },
  { id: 'lipLower', type: 'polyline', indices: [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], strokeWidth: 1.05 },
]

function subsample(indices, target) {
  if (indices.length <= target) return [...indices]
  const out = []
  for (let i = 0; i < target; i += 1) {
    out.push(indices[Math.round((i / (target - 1)) * (indices.length - 1))])
  }
  return out
}

function distLandmarks(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function symmetryScore(landmarks, metrics) {
  if (!landmarks?.length) return 70
  const nose = lm(landmarks, 1)
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = Math.max(chin.y - forehead.y, 0.2)
  const mirrorPairs = [
    [33, 263], [133, 362], [61, 291], [105, 334],
    [159, 386], [145, 374], [234, 454], [127, 356],
  ]
  const deviations = mirrorPairs.map(([li, ri]) => {
    const l = lm(landmarks, li)
    const r = lm(landmarks, ri)
    const xMir = (Math.abs(Math.abs(l.x - nose.x) - Math.abs(r.x - nose.x)) / faceH) * 100
    const yMir = (Math.abs(l.y - r.y) / faceH) * 100
    const zMir = Math.abs(Math.abs(l.z || 0) - Math.abs(r.z || 0)) * 100
    return xMir * 0.55 + yMir * 0.30 + zMir * 0.15
  })
  const avgDev = deviations.reduce((s, d) => s + d, 0) / deviations.length
  return Math.max(55, Math.min(96, Math.round(90 - avgDev * 9)))
}

function scoreLabel(score) {
  if (score >= 85) return 'Highly Average'
  if (score >= 70) return 'Above Average'
  if (score >= 55) return 'Average'
  return 'Distinctive'
}

export function prototypicalityRangeLabel(score) {
  if (score >= 82) return 'Highly Typical'
  if (score >= 70) return 'Quite Typical'
  if (score >= 55) return 'Moderately Typical'
  if (score >= 35) return 'Somewhat Unique'
  return 'Distinctive'
}

function squareBounds(landmarks) {
  const pts = FACE_OVAL.map((i) => lm(landmarks, i))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const pad = 0.06
  const minX = Math.min(...xs) - pad
  const maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad
  const maxY = Math.max(...ys) + pad
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const size = Math.max(maxX - minX, maxY - minY) * 1.08
  return { minX: cx - size / 2, minY: cy - size / 2, w: size, h: size }
}

function toSvg(landmarks, idx, bounds) {
  const p = lm(landmarks, idx)
  return {
    x: ((p.x - bounds.minX) / bounds.w) * 100,
    y: ((p.y - bounds.minY) / bounds.h) * 100,
  }
}

function buildFeatureLayers(landmarks, bounds) {
  return FEATURE_TOPOLOGY.map((feat) => ({
    id: feat.id,
    type: feat.type,
    fill: feat.fill,
    strokeWidth: feat.strokeWidth,
    points: feat.indices
      .map((idx) => toSvg(landmarks, idx, bounds))
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' '),
  })).filter((f) => f.points)
}

function placePolylineArc(landmarks, indices, cx, cy, rx, ry, start, end) {
  const n = indices.length
  if (n < 1) return
  indices.forEach((idx, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5
    const angle = start + (end - start) * t
    landmarks[idx] = { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), z: 0 }
  })
}

function syntheticIdealLandmarks(bounds, norms) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))

  const top = bounds.minY + bounds.h * 0.07
  const bottom = bounds.minY + bounds.h * 0.93
  const fh = bottom - top
  const fw = norms.faceWidthHeight * fh
  const cx = bounds.minX + bounds.w / 2

  const browY = top + fh * norms.upperThird
  const noseTipY = browY + fh * norms.middleThird
  const lipY = noseTipY + fh * norms.lowerThird * 0.55
  const eyeY = browY + fh * norms.middleThird * 0.32
  const eyeHalf = fw * 0.11
  const noseHalf = fw * norms.noseRatio * 0.5

  landmarks[10] = { x: cx, y: top, z: 0 }
  landmarks[152] = { x: cx, y: bottom, z: 0 }
  landmarks[1] = { x: cx, y: noseTipY, z: 0 }
  landmarks[2] = { x: cx, y: noseTipY - fh * norms.middleThird * 0.15, z: 0 }
  const jawHalf = fw * 0.5
  landmarks[172] = { x: cx - jawHalf, y: bottom - fh * 0.12, z: 0 }
  landmarks[397] = { x: cx + jawHalf, y: bottom - fh * 0.12, z: 0 }
  landmarks[127] = { x: cx - fw * 0.5, y: browY + fh * 0.08, z: 0 }
  landmarks[356] = { x: cx + fw * 0.5, y: browY + fh * 0.08, z: 0 }
  landmarks[234] = { x: cx - fw * 0.48, y: bottom - fh * 0.08, z: 0 }
  landmarks[454] = { x: cx + fw * 0.48, y: bottom - fh * 0.08, z: 0 }

  FACE_OVAL.forEach((idx, k) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * k) / FACE_OVAL.length
    landmarks[idx] = {
      x: cx + fw * 0.5 * Math.cos(angle),
      y: top + fh * 0.5 + fh * 0.5 * Math.sin(angle),
      z: 0,
    }
  })

  placePolylineArc(landmarks, subsample(RIGHT_EYE, 14), cx - eyeHalf * 2.2, eyeY, eyeHalf, fh * 0.04, Math.PI * 0.15, Math.PI * 0.85)
  placePolylineArc(landmarks, subsample(LEFT_EYE, 14), cx + eyeHalf * 2.2, eyeY, eyeHalf, fh * 0.04, Math.PI * 0.85, Math.PI * 1.85)
  placePolylineArc(landmarks, subsample(RIGHT_BROW, 11), cx - eyeHalf * 2.2, browY - fh * 0.02, eyeHalf * 1.3, fh * 0.025, Math.PI * 0.1, Math.PI * 0.9)
  placePolylineArc(landmarks, subsample(LEFT_BROW, 11), cx + eyeHalf * 2.2, browY - fh * 0.02, eyeHalf * 1.3, fh * 0.025, Math.PI * 0.9, Math.PI * 1.9)

  ;[168, 6, 197, 195, 5, 4, 1].forEach((idx, i) => {
    const t = i / 6
    landmarks[idx] = { x: cx, y: top + t * (noseTipY - top), z: 0 }
  })
  ;[98, 97, 2, 326, 327].forEach((idx, i) => {
    const t = (i - 2) / 2
    landmarks[idx] = { x: cx + noseHalf * t, y: noseTipY + fh * 0.02, z: 0 }
  })

  placePolylineArc(landmarks, [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291], cx, lipY - fh * 0.02, fw * 0.14, fh * 0.025, Math.PI * 0.05, Math.PI * 0.95)
  placePolylineArc(landmarks, [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], cx, lipY + fh * 0.03, fw * 0.12, fh * 0.03, Math.PI * 1.05, Math.PI * 1.95)

  landmarks[33] = { x: cx - eyeHalf * 2.2, y: eyeY, z: 0 }
  landmarks[263] = { x: cx + eyeHalf * 2.2, y: eyeY, z: 0 }
  landmarks[48] = { x: cx - noseHalf, y: noseTipY, z: 0 }
  landmarks[278] = { x: cx + noseHalf, y: noseTipY, z: 0 }

  return landmarks
}

function faceProportions(landmarks) {
  const jawL = lm(landmarks, 172)
  const jawR = lm(landmarks, 397)
  const cheekL = lm(landmarks, 127)
  const cheekR = lm(landmarks, 356)
  const chin = lm(landmarks, 152)
  const forehead = lm(landmarks, 10)
  const subnasale = lm(landmarks, 2)
  const eyeL = lm(landmarks, 33)
  const eyeR = lm(landmarks, 263)

  const faceH = chin.y - forehead.y || 0.3
  const jawW = Math.abs(jawR.x - jawL.x) || 0.3
  const cheekW = Math.abs(cheekR.x - cheekL.x) || jawW
  const browLineY = (eyeL.y + eyeR.y) / 2

  return {
    faceH,
    faceW: cheekW,
    jawW,
    faceRatio: jawW / faceH,
    browLineY,
    upperThird: (browLineY - forehead.y) / faceH,
    middleThird: (subnasale.y - browLineY) / faceH,
    lowerThird: (chin.y - subnasale.y) / faceH,
    noseRatio: distLandmarks(lm(landmarks, 48), lm(landmarks, 278)) / cheekW,
  }
}

function relativeError(measured, ideal) {
  return Math.min(MAX_FEATURE_MAGNITUDE, Math.abs(measured - ideal) / Math.max(Math.abs(ideal), 0.05))
}

function measureDeviations(landmarks, metrics, norms) {
  const props = faceProportions(landmarks)
  const symScore = symmetryScore(landmarks, metrics)
  const browLineRel = (props.browLineY - lm(landmarks, 10).y) / props.faceH

  const items = [
    {
      feature: 'jaw width',
      magnitude: relativeError(props.faceRatio, norms.faceWidthHeight),
      direction: props.faceRatio < norms.faceWidthHeight ? 'narrower' : 'wider',
    },
    {
      feature: 'nose',
      magnitude: relativeError(props.noseRatio, norms.noseRatio),
      direction: props.noseRatio < norms.noseRatio ? 'narrower' : 'broader',
    },
    {
      feature: 'brows',
      magnitude: relativeError(browLineRel, norms.upperThird),
      direction: browLineRel < norms.upperThird ? 'lower' : 'higher',
    },
    {
      feature: 'facial thirds',
      magnitude: Math.min(
        MAX_FEATURE_MAGNITUDE,
        (
          Math.abs(props.upperThird - norms.upperThird)
          + Math.abs(props.middleThird - norms.middleThird)
          + Math.abs(props.lowerThird - norms.lowerThird)
        ) / 3,
      ),
      direction: 'shifted',
    },
    {
      feature: 'symmetry',
      magnitude: Math.min(MAX_FEATURE_MAGNITUDE, Math.max(0, 80 - symScore) / 120),
      direction: symScore < 80 ? 'more asymmetric' : 'balanced',
    },
  ]

  return items.sort((a, b) => b.magnitude - a.magnitude)
}

function buildExplanation(deviations, score) {
  const phraseFor = (d) => {
    if (d.feature === 'brows') return d.direction === 'higher' ? 'a higher brow line' : 'a lower brow line'
    if (d.feature === 'nose') return `a ${d.direction} nose`
    if (d.feature === 'jaw width') return `a ${d.direction} jaw`
    if (d.feature === 'facial thirds') return 'shifted facial thirds'
    if (d.feature === 'symmetry') {
      return d.direction === 'balanced' ? 'balanced left–right symmetry' : 'more left–right asymmetry'
    }
    return d.feature
  }

  const notable = deviations
    .filter((d) => d.magnitude > 0.04 && d.direction !== 'balanced')
    .slice(0, 3)
    .map(phraseFor)

  if (score >= 70) {
    if (notable.length === 0) {
      return (
        'Your measured proportions sit close to the demographic norm across jaw width, nose, ' +
        'brows, facial thirds, and symmetry.'
      )
    }
    return (
      'Your overall proportions sit on the typical side relative to your demographic norm, ' +
      `with the most noticeable measured variation in ${notable.join(', ')}.`
    )
  }
  if (notable.length === 0) {
    return 'Your ratios show a mix of conformity and variation relative to the ideal proportion targets.'
  }
  return `Compared to the ideal proportion targets, notable measured variation appears in ${notable.join(', ')}.`
}

function computeScore(deviations) {
  const weighted = deviations.reduce(
    (sum, d) => sum + d.magnitude * (SCORE_WEIGHTS[d.feature] ?? 0.15),
    0,
  )
  const penalty = weighted * SCORE_PENALTY_SCALE
  return Math.max(25, Math.min(96, Math.round(SCORE_BASE - penalty)))
}

export function computePrototypicalityReport(landmarks, metrics = {}, answers = {}) {
  if (!landmarks?.length) {
    return {
      score: null,
      label: null,
      rangeLabel: null,
      scaleLeft: 'Distinctive',
      scaleRight: 'Highly Typical',
      explanation: null,
      deviations: [],
      wireframe: null,
      methodology: METHODOLOGY,
    }
  }

  const norms = getPrototypicalityNorms(answers)
  const deviations = measureDeviations(landmarks, metrics, norms)
  const score = computeScore(deviations)
  const props = faceProportions(landmarks)
  const symScore = symmetryScore(landmarks, metrics)
  const bounds = squareBounds(landmarks)
  const idealLandmarks = syntheticIdealLandmarks(bounds, norms)

  return {
    score,
    label: scoreLabel(score),
    rangeLabel: prototypicalityRangeLabel(score),
    scaleLeft: 'Distinctive',
    scaleRight: 'Highly Typical',
    explanation: buildExplanation(deviations, score),
    methodology: METHODOLOGY,
    cohortKey: norms.cohortKey,
    faceRatio: {
      value: props.faceRatio.toFixed(2),
      ideal: norms.faceWidthHeight.toFixed(2),
      deviation: (Math.abs(props.faceRatio - norms.faceWidthHeight) / norms.faceWidthHeight * 100).toFixed(1),
    },
    proportions: {
      upper: props.upperThird.toFixed(2),
      middle: props.middleThird.toFixed(2),
      lower: props.lowerThird.toFixed(2),
      deviation: (
        Math.abs(props.upperThird - norms.upperThird) * 100
        + Math.abs(props.middleThird - norms.middleThird) * 100
        + Math.abs(props.lowerThird - norms.lowerThird) * 100
      ).toFixed(1),
    },
    symmetry: { score: symScore, deviation: Math.max(0, 100 - symScore).toFixed(1) },
    nose: {
      ratio: props.noseRatio.toFixed(2),
      ideal: norms.noseRatio.toFixed(2),
      deviation: (Math.abs(props.noseRatio - norms.noseRatio) / norms.noseRatio * 100).toFixed(1),
    },
    deviations: deviations.map((d) => ({
      feature: d.feature,
      direction: d.direction,
      magnitude: Number(d.magnitude.toFixed(3)),
    })),
    wireframe: {
      viewBox: '0 0 100 100',
      userFeatures: buildFeatureLayers(landmarks, bounds),
      averageFeatures: buildFeatureLayers(idealLandmarks, bounds),
    },
  }
}
