import { cropNormalized, analyzeBrowsCrop } from './eyeAnalysis'
import {
  lm,
  bboxFullFace,
  dotsInCrop,
  proportionLinesInCrop,
  SYMMETRY_DOTS,
} from './faceCrop'

function symmetryScore(landmarks, metrics) {
  if (metrics?.symmetry) return Math.round(parseFloat(metrics.symmetry))
  const pairs = [[33, 263], [133, 362], [61, 291], [105, 334]]
  const nose = lm(landmarks, 1)
  let totalDev = 0
  pairs.forEach(([li, ri]) => {
    const l = lm(landmarks, li)
    const r = lm(landmarks, ri)
    totalDev += Math.abs(Math.abs(l.x - nose.x) - Math.abs(r.x - nose.x))
  })
  return Math.min(99, Math.max(65, Math.round(97 - totalDev * 150)))
}

function symmetryLabel(score) {
  if (score >= 82) return 'Highly Symmetric'
  if (score >= 72) return 'Balanced'
  if (score >= 62) return 'Moderate'
  return 'Noticeable asymmetry'
}

function proportionsFromLandmarks(landmarks, metrics) {
  const upper = parseFloat(metrics?.upperThird || '0.33')
  const middle = parseFloat(metrics?.middleThird || '0.34')
  const lower = parseFloat(metrics?.lowerThird || '0.33')
  const idealDev = Math.abs(upper - 0.33) + Math.abs(middle - 0.34) + Math.abs(lower - 0.33)
  const score = Math.min(
    99,
    Math.max(60, Math.round(parseFloat(metrics?.proportionality || 82) - idealDev * 25))
  )
  return {
    score,
    upperThird: upper.toFixed(2),
    middleThird: middle.toFixed(2),
    lowerThird: lower.toFixed(2),
    label: score >= 80 ? 'Well balanced' : score >= 70 ? 'Good balance' : 'Slight variation',
  }
}

function eyebrowMetrics(landmarks) {
  const lb = lm(landmarks, 105)
  const rb = lm(landmarks, 334)
  const le = lm(landmarks, 159)
  const re = lm(landmarks, 386)
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = chin.y - forehead.y || 0.3

  const browEyeGap = ((le.y - lb.y) + (re.y - rb.y)) / 2 / faceH
  const position = browEyeGap < 0.1 ? 'High set' : browEyeGap < 0.16 ? 'Mid set' : 'Low set'

  const tilt = ((lb.y - lm(landmarks, 70).y) + (rb.y - lm(landmarks, 300).y)) / 2
  const tiltLabel = tilt < -0.008 ? 'Upturned' : tilt > 0.008 ? 'Downturned' : 'Neutral'

  const arch = ((lm(landmarks, 66).y - lb.y) + (lm(landmarks, 296).y - rb.y)) / 2
  const shape = arch < -0.012 ? 'Arched' : arch > 0.005 ? 'Straight' : 'Soft arch'
  const peakMm = ((Math.abs(arch) / faceH) * 120 + 18).toFixed(2)

  return {
    position,
    tilt: tiltLabel,
    virility: shape === 'Straight' ? 'Moderate' : 'Soft',
    shape,
    peakHeight: peakMm,
    peakMin: '18.23',
    peakMax: '23.87',
    inRange: parseFloat(peakMm) >= 18.23 && parseFloat(peakMm) <= 23.87,
    explanation: `Your brows sit in a ${position.toLowerCase()} position with a ${shape.toLowerCase()} form and ${tiltLabel.toLowerCase()} tilt — contributing to a balanced periorbital frame.`,
  }
}

export async function buildCvReport(landmarks, imageSrc, metrics) {
  const faceBox = bboxFullFace(landmarks, 0.08)
  const symScore = symmetryScore(landmarks, metrics)
  const symLabel = symmetryLabel(symScore)
  const prop = proportionsFromLandmarks(landmarks, metrics)

  const [faceCrop, browsData] = await Promise.all([
    cropNormalized(imageSrc, faceBox),
    analyzeBrowsCrop(landmarks, imageSrc),
  ])

  const symmetryDots = dotsInCrop(landmarks, SYMMETRY_DOTS, faceBox)
  const proportionLines = proportionLinesInCrop(landmarks, faceBox)
  const brow = eyebrowMetrics(landmarks)

  return {
    symmetry: {
      score: symScore,
      scoreLabel: symLabel,
      scaleLeft: 'Asymmetric',
      scaleRight: 'Symmetric',
      scaleMarkerPct: symScore,
      rangeHighlight: { left: 70, width: 28 },
      explanation: `Your facial symmetry score of ${symScore} indicates ${symLabel.toLowerCase()} left-right proportions. Mild asymmetry in the periorbital and jaw regions is common and within normal variation.`,
      imageSrc: faceCrop,
      symmetryDots,
    },
    proportions: {
      score: prop.score,
      scoreLabel: prop.label,
      scaleLeft: 'Imbalanced',
      scaleRight: 'Ideal balance',
      scaleMarkerPct: prop.score,
      rangeHighlight: { left: 65, width: 25 },
      upperThird: prop.upperThird,
      middleThird: prop.middleThird,
      lowerThird: prop.lowerThird,
      explanation: `Vertical facial thirds — upper ${prop.upperThird}, middle ${prop.middleThird}, lower ${prop.lowerThird}. Your proportionality score of ${prop.score} reflects ${prop.label.toLowerCase()} distribution across facial height.`,
      imageSrc: faceCrop,
      proportionLines,
    },
    eyebrows: {
      crop: browsData.crop,
      metrics: brow,
    },
  }
}

export function mockCvReport(imageSrc, metrics) {
  const prop = proportionsFromLandmarks(null, metrics || {
    upperThird: '0.31',
    middleThird: '0.36',
    lowerThird: '0.33',
    proportionality: '84',
  })
  const symScore = parseInt(metrics?.symmetry || 84, 10)
  return {
    symmetry: {
      score: symScore,
      scoreLabel: 'Highly Symmetric',
      scaleLeft: 'Asymmetric',
      scaleRight: 'Symmetric',
      scaleMarkerPct: symScore,
      rangeHighlight: { left: 70, width: 28 },
      explanation: 'Your facial symmetry score of 84 indicates highly symmetric left-right proportions, with only minor asymmetries that are common and natural in human faces.',
      imageSrc,
      symmetryDots: null,
    },
    proportions: {
      score: prop.score,
      scoreLabel: prop.label,
      scaleLeft: 'Imbalanced',
      scaleRight: 'Ideal balance',
      scaleMarkerPct: prop.score,
      rangeHighlight: { left: 65, width: 25 },
      upperThird: prop.upperThird,
      middleThird: prop.middleThird,
      lowerThird: prop.lowerThird,
      explanation: `Vertical thirds show upper ${prop.upperThird}, middle ${prop.middleThird}, lower ${prop.lowerThird} — ${prop.label.toLowerCase()} for your profile.`,
      imageSrc,
      proportionLines: null,
    },
    eyebrows: {
      crop: imageSrc,
      metrics: {
        position: 'Mid set',
        tilt: 'Upturned',
        virility: 'Moderate',
        shape: 'Arched',
        peakHeight: '21.55',
        peakMin: '18.23',
        peakMax: '23.87',
        inRange: true,
        explanation: 'Your brows sit in a mid set position with a rounded arch and upturned tilt.',
      },
    },
  }
}
