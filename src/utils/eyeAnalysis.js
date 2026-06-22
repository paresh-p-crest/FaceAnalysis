import {
  lm,
  RIGHT_EYE,
  LEFT_EYE,
  RIGHT_BROW,
  LEFT_BROW,
  bboxFromIndices,
  mergeBboxes,
  bboxEyesRegion,
  bboxBrowsRegion,
} from './faceCrop'

const LEFT_LOWER_LID = [33, 133, 157, 158, 159, 160, 173]
const RIGHT_LOWER_LID = [362, 263, 385, 386, 387, 388, 390]
const LEFT_UNDER = [111, 117, 118, 119, 120, 121]
const RIGHT_UNDER = [340, 346, 347, 348, 349, 350]

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function cropNormalized(imageSrc, box) {
  const img = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const sx = Math.max(0, Math.round(box.x * img.width))
  const sy = Math.max(0, Math.round(box.y * img.height))
  const sw = Math.max(1, Math.min(img.width - sx, Math.round(box.w * img.width)))
  const sh = Math.max(1, Math.min(img.height - sy, Math.round(box.h * img.height)))
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  return canvas.toDataURL('image/jpeg', 0.92)
}

async function sampleRegionStats(imageSrc, box) {
  const img = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  const sx = Math.max(0, Math.round(box.x * img.width))
  const sy = Math.max(0, Math.round(box.y * img.height))
  const sw = Math.max(1, Math.round(box.w * img.width))
  const sh = Math.max(1, Math.round(box.h * img.height))
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  const { data } = ctx.getImageData(0, 0, sw, sh)

  let brightSum = 0
  let rSum = 0
  let gSum = 0
  let bSum = 0
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    rSum += data[i]
    gSum += data[i + 1]
    bSum += data[i + 2]
    brightSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const avgBright = brightSum / n
  const redness = rSum / n - (gSum / n + bSum / n) / 2
  return { brightness: avgBright, whiteness: avgBright - redness * 0.5 }
}

function canthalTiltDeg(outer, inner) {
  return (Math.atan2(outer.y - inner.y, outer.x - inner.x) * 180) / Math.PI
}

function classifyTilt(avgTilt) {
  if (avgTilt > 2.5) return 'Positive (upturned)'
  if (avgTilt < -0.5) return 'Negative (downturned)'
  return 'Neutral'
}

function classifyExposure(ratio) {
  if (ratio > 0.34) return 'High'
  if (ratio > 0.24) return 'Moderate'
  return 'Low'
}

function classifySclera(whiteness) {
  if (whiteness > 175) return 'Natural White'
  if (whiteness > 145) return 'Slightly dull'
  return 'Yellow-tinged'
}

function classifyUnderEye(brightness) {
  if (brightness > 140) return 'Good'
  if (brightness > 110) return 'Moderate'
  return 'Shadowed'
}

function lowerLidBending(landmarks, indices) {
  const pts = indices.map((i) => lm(landmarks, i))
  const inner = pts[0]
  const outer = pts[pts.length - 1]
  const lineLen = dist(inner, outer) || 0.001
  let maxDev = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const cross = Math.abs((outer.x - inner.x) * (inner.y - p.y) - (inner.x - p.x) * (outer.y - inner.y))
    maxDev = Math.max(maxDev, cross / lineLen)
  }
  return Math.min(0.95, 0.68 + maxDev * 8)
}

function curvatureLabel(k) {
  if (k >= 0.84) return 'Within the common curvature range'
  if (k >= 0.76) return 'Slightly flatter than the common curvature range'
  return 'Noticeably flatter than typical'
}

function buildExplanation(metrics) {
  return [
    `Your eyes show ${metrics.eyeTilt.toLowerCase()} canthal tilt with ${metrics.eyelidExposure.toLowerCase()} eyelid exposure.`,
    `Sclera reads as ${metrics.scleraColor.toLowerCase()} with ${metrics.underEyeHealth.toLowerCase()} under-eye appearance.`,
    `Lower eyelid curvature (${metrics.lowerLidCurvature}) is ${metrics.curvatureDescription.toLowerCase()} — typical bending range is 0.76–0.92.`,
  ].join(' ')
}

export function computeEyeMetricsFromLandmarks(landmarks) {
  const reO = lm(landmarks, 33)
  const reI = lm(landmarks, 133)
  const leO = lm(landmarks, 263)
  const leI = lm(landmarks, 362)
  const leTop = lm(landmarks, 159)
  const leBot = lm(landmarks, 145)
  const reTop = lm(landmarks, 386)
  const reBot = lm(landmarks, 374)

  const left = {
    tilt: canthalTiltDeg(leO, leI),
    exposureRatio: dist(leTop, leBot) / (dist(leI, leO) || 0.01),
    lowerLidK: lowerLidBending(landmarks, LEFT_LOWER_LID),
  }
  const right = {
    tilt: canthalTiltDeg(reO, reI),
    exposureRatio: dist(reTop, reBot) / (dist(reI, reO) || 0.01),
    lowerLidK: lowerLidBending(landmarks, RIGHT_LOWER_LID),
  }
  const avg = {
    tilt: (left.tilt + right.tilt) / 2,
    exposureRatio: (left.exposureRatio + right.exposureRatio) / 2,
    lowerLidK: (left.lowerLidK + right.lowerLidK) / 2,
  }

  return {
    leftTilt: left.tilt.toFixed(1),
    rightTilt: right.tilt.toFixed(1),
    eyeTilt: classifyTilt(avg.tilt),
    eyelidExposure: classifyExposure(avg.exposureRatio),
    exposureRatio: avg.exposureRatio.toFixed(2),
    lowerLidCurvature: avg.lowerLidK.toFixed(2),
    curvatureDescription: curvatureLabel(avg.lowerLidK),
    curvatureMin: 0.76,
    curvatureMax: 0.92,
    scleraColor: 'Natural White',
    underEyeHealth: 'Moderate',
  }
}

export async function analyzeEyes(landmarks, imageSrc) {
  const eyesBox = bboxEyesRegion(landmarks)
  const leftBox = bboxFromIndices(landmarks, LEFT_EYE, 0.03)
  const rightBox = bboxFromIndices(landmarks, RIGHT_EYE, 0.03)

  const leftUnderBox = bboxFromIndices(landmarks, LEFT_UNDER, 0.015)
  const rightUnderBox = bboxFromIndices(landmarks, RIGHT_UNDER, 0.015)
  leftUnderBox.h *= 1.3
  rightUnderBox.h *= 1.3

  const [eyesCrop, leftSclera, rightSclera, leftUnder, rightUnder] = await Promise.all([
    cropNormalized(imageSrc, eyesBox),
    sampleRegionStats(imageSrc, leftBox),
    sampleRegionStats(imageSrc, rightBox),
    sampleRegionStats(imageSrc, leftUnderBox),
    sampleRegionStats(imageSrc, rightUnderBox),
  ])

  const metrics = computeEyeMetricsFromLandmarks(landmarks)
  metrics.scleraColor = classifySclera((leftSclera.whiteness + rightSclera.whiteness) / 2)
  metrics.underEyeHealth = classifyUnderEye((leftUnder.brightness + rightUnder.brightness) / 2)
  metrics.explanation = buildExplanation(metrics)

  return { eyesCrop, eyesBox, metrics }
}

export async function analyzeBrowsCrop(landmarks, imageSrc) {
  const box = bboxBrowsRegion(landmarks)
  const crop = await cropNormalized(imageSrc, box)
  return { crop, box }
}

export function mockEyeAnalysis(imageSrc) {
  return {
    eyesCrop: imageSrc,
    metrics: {
      leftTilt: '2.1',
      rightTilt: '1.8',
      eyeTilt: 'Neutral',
      eyelidExposure: 'Moderate',
      exposureRatio: '0.28',
      scleraColor: 'Natural White',
      underEyeHealth: 'Moderate',
      lowerLidCurvature: '0.80',
      curvatureDescription: 'Within the common curvature range',
      curvatureMin: 0.76,
      curvatureMax: 0.92,
      explanation:
        'Your eyes show neutral canthal tilt with moderate eyelid exposure. Sclera reads as natural white with moderate under-eye appearance.',
    },
  }
}

export { lm, bboxFromIndices, mergeBboxes }
