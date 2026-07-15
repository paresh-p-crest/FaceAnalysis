import { cropNormalized, analyzeBrowsCrop, sampleRegionStats } from './eyeAnalysis'
import { analyzeWithMediaPipe } from './mediapipeAnalysis'
import { safeFixed, safeNum, safeRound } from './safeFormat'
import { computePrototypicalityReport } from './prototypicalityEngine'
import {
  lm,
  bboxFullFace,
  bboxFromIndices,
  mergeBboxes,
  dotsInImage,
  pointInImage,
  proportionLinesInImage,
  proportionRatioOverlays,
  mouthCheilions,
  noseAlae,
  SYMMETRY_DOTS,
  FACE_OVAL,
} from './faceCrop'

/* ── Landmark index groups for new feature crops ── */
const NOSE_BRIDGE = [6, 197, 195, 5, 4, 1, 2, 98, 327]
const NOSE_TIP = [1, 2, 98, 327, 48, 278, 44, 274]
const UPPER_LIP = [13, 312, 311, 310, 411, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82]
const LOWER_LIP = [14, 87, 178, 88, 95, 324, 308, 411, 310, 311, 312, 13, 82, 81, 80, 191, 78]
const JAW_LEFT = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323]
const JAW_RIGHT = [172, 136, 150, 149, 176, 148, 152, 145, 153, 154, 155, 133, 173, 157, 158, 159]
const CHIN = [152, 148, 176, 149, 150, 136, 176, 377, 400, 378, 379, 365, 397, 288, 361, 323, 145, 153, 154, 155]
const MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]

function noseMetrics(landmarks) {
  const noseTip = lm(landmarks, 1)
  const noseBridge = lm(landmarks, 6)
  const noseBaseL = lm(landmarks, 48)
  const noseBaseR = lm(landmarks, 278)
  const noseWidth = Math.abs(noseBaseR.x - noseBaseL.x)
  const noseLength = Math.abs(noseTip.y - noseBridge.y)
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = chin.y - forehead.y || 0.3
  const noseRatio = noseLength / faceH
  const widthLengthRatio = noseWidth / (noseLength || 0.01)

  // Alar base width classification
  let widthClass = 'Narrow'
  if (widthLengthRatio > 0.68) widthClass = 'Wide'
  else if (widthLengthRatio > 0.55) widthClass = 'Moderate'

  // Nose bridge width
  const bridgeL = lm(landmarks, 168)
  const bridgeR = lm(landmarks, 6)
  const bridgeW = Math.abs(bridgeL.x - bridgeR.x)

  // Nose tip projection angle
  const tipProj = noseTip.z || 0

  // Nose score based on proportions
  let score = 85
  if (noseRatio > 0.28 && noseRatio < 0.38) score += 5
  if (widthLengthRatio > 0.45 && widthLengthRatio < 0.65) score += 5
  if (noseRatio < 0.24 || noseRatio > 0.42) score -= 10
  score = Math.min(99, Math.max(55, score))

  return {
    score,
    scoreLabel: score >= 80 ? 'Harmonious' : score >= 70 ? 'Balanced' : 'Distinctive',
    width: widthClass,
    widthLengthRatio: widthLengthRatio.toFixed(2),
    noseRatio: noseRatio.toFixed(2),
    bridgeWidth: (bridgeW * 100).toFixed(1),
    tipProjection: tipProj.toFixed(3),
    explanation: `Your nose displays a ${widthClass.toLowerCase()} alar base with a nose-to-face ratio of ${noseRatio.toFixed(2)}. The width-to-length ratio of ${widthLengthRatio.toFixed(2)} suggests a ${score >= 80 ? 'harmonious' : score >= 70 ? 'well-proportioned' : 'distinctive'} nasal structure relative to your facial dimensions.`,
  }
}

function lipMetrics(landmarks) {
  const upperLip = lm(landmarks, 13)  // upper lip center
  const lowerLip = lm(landmarks, 14)  // lower lip center
  const philtrumTop = lm(landmarks, 168) // base of nose
  const lipWidthL = lm(landmarks, 61)
  const lipWidthR = lm(landmarks, 291)

  const mouthWidth = Math.abs(lipWidthR.x - lipWidthL.x)
  const upperLipH = Math.abs(upperLip.y - philtrumTop.y)
  const lowerLipH = Math.abs(lowerLip.y - upperLip.y)
  const philtrumToLipRatio = upperLipH / (lowerLipH || 0.001)

  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = chin.y - forehead.y || 0.3

  const lipWidthRatio = mouthWidth / (faceH || 0.3)
  const lipFullness = (upperLipH + lowerLipH) / (mouthWidth || 0.001)

  let fullness = 'Balanced'
  if (lipFullness > 0.55) fullness = 'Full'
  else if (lipFullness < 0.38) fullness = 'Thin'

  let philtrumClass = 'Proportionate'
  if (philtrumToLipRatio > 1.4) philtrumClass = 'Longer philtrum'
  else if (philtrumToLipRatio < 0.7) philtrumClass = 'Shorter philtrum'

  let score = 82
  if (lipFullness > 0.42 && lipFullness < 0.58) score += 6
  if (philtrumToLipRatio > 0.75 && philtrumToLipRatio < 1.35) score += 4
  score = Math.min(99, Math.max(60, score))

  return {
    score,
    scoreLabel: score >= 82 ? 'Harmonious' : score >= 72 ? 'Balanced' : 'Distinctive',
    fullness,
    philtrum: philtrumClass,
    lipWidthRatio: lipWidthRatio.toFixed(2),
    philtrumToLipRatio: philtrumToLipRatio.toFixed(2),
    lipFullness: lipFullness.toFixed(2),
    explanation: `Your lips show ${fullness.toLowerCase()} volume with a ${philtrumToLipRatio.toFixed(2)} philtrum-to-lip ratio. The upper-to-lower lip proportion is ${philtrumClass.toLowerCase()}, contributing to a ${score >= 82 ? 'harmonious' : 'balanced'} perioral appearance.`,
  }
}

function jawChinMetrics(landmarks) {
  const jawL = lm(landmarks, 234)  // left jaw angle
  const jawR = lm(landmarks, 454)  // right jaw angle
  const chin = lm(landmarks, 152)
  const forehead = lm(landmarks, 10)
  const faceW = Math.abs(jawR.x - jawL.x)
  const faceH = chin.y - forehead.y || 0.3
  const faceRatio = faceW / faceH

  // Jaw angle
  const cheekL = lm(landmarks, 127)
  const cheekR = lm(landmarks, 356)
  const jawAngleL = Math.abs(Math.atan2(chin.y - jawL.y, chin.x - jawL.x) * 180 / Math.PI)
  const jawAngleR = Math.abs(Math.atan2(chin.y - jawR.y, chin.x - jawR.x) * 180 / Math.PI)
  const avgJawAngle = (jawAngleL + jawAngleR) / 2

  // Chin projection
  const chinProj = chin.z || 0
  const lipLower = lm(landmarks, 14)
  const chinDepth = Math.abs(chin.y - lipLower.y) / faceH

  let jawShape = 'Oval'
  if (faceRatio > 0.78) jawShape = 'Square'
  else if (faceRatio > 0.72) jawShape = 'Round'
  else if (faceRatio < 0.62) jawShape = 'Narrow'

  let chinType = 'Balanced'
  if (chinDepth > 0.12) chinType = 'Prominent'
  else if (chinDepth < 0.07) chinType = 'Recessed'

  let score = 78
  if (faceRatio > 0.63 && faceRatio < 0.78) score += 8
  if (chinDepth > 0.07 && chinDepth < 0.13) score += 5
  score = Math.min(99, Math.max(55, score))

  return {
    score,
    scoreLabel: score >= 80 ? 'Strong' : score >= 70 ? 'Defined' : 'Soft',
    jawShape,
    chinType,
    faceRatio: faceRatio.toFixed(2),
    jawAngle: avgJawAngle.toFixed(1),
    chinDepth: chinDepth.toFixed(2),
    explanation: `Your jaw displays a ${jawShape.toLowerCase()} contour with a face width-to-height ratio of ${faceRatio.toFixed(2)}. The chin appears ${chinType.toLowerCase()} with a jaw angle of ${avgJawAngle.toFixed(1)}° — ${score >= 80 ? 'contributing to a strong, defined lower facial frame' : 'creating a softer lower facial contour'}.`,
  }
}

/* ── Jaw (standalone) ── */
function jawMetrics(landmarks) {
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  const chin = lm(landmarks, 152)
  const forehead = lm(landmarks, 10)
  const cheekL = lm(landmarks, 127)
  const cheekR = lm(landmarks, 356)
  const lipLower = lm(landmarks, 14)
  const faceW = Math.abs(jawR.x - jawL.x)
  const faceH = chin.y - forehead.y || 0.3
  const ipd = distLandmarks(lm(landmarks, 33), lm(landmarks, 263)) || 0.001

  // Jaw width relative to face
  const jawWidthPct = ((faceW / (distLandmarks(cheekL, cheekR) || faceW)) * 100).toFixed(1)
  const jawWidthClass = parseFloat(jawWidthPct) > 90 ? 'Wide' : parseFloat(jawWidthPct) > 75 ? 'Balanced' : 'Narrow'

  // Mandibular angle (how defined the jawline is)
  const angleL = Math.abs(Math.atan2(chin.y - jawL.y, chin.x - jawL.x) * 180 / Math.PI)
  const angleR = Math.abs(Math.atan2(chin.y - jawR.y, chin.x - jawR.x) * 180 / Math.PI)
  const avgAngle = (angleL + angleR) / 2
  const mandibularDef = avgAngle > 140 ? 'Soft' : avgAngle > 120 ? 'Defined' : 'Angular'

  // Jaw length (jaw to chin as % of face height)
  const jawLengthL = distLandmarks(jawL, chin)
  const jawLengthR = distLandmarks(jawR, chin)
  const avgJawLength = ((jawLengthL + jawLengthR) / 2 / faceH * 100).toFixed(1)
  const jawLengthClass = parseFloat(avgJawLength) > 55 ? 'Long' : parseFloat(avgJawLength) > 40 ? 'Balanced' : 'Short'

  // Jawline smoothness (variation in jaw contour depth)
  const jawPointsL = [172, 136, 150, 149, 176, 148, 152].map(i => lm(landmarks, i))
  const jawPointsR = [172, 136, 150, 149, 176, 148, 152].map(i => lm(landmarks, i))
  let smoothnessSum = 0
  for (let i = 1; i < jawPointsL.length - 1; i++) {
    const prev = jawPointsL[i - 1], curr = jawPointsL[i], next = jawPointsL[i + 1]
    const angle = angleBetween(prev, curr, next)
    smoothnessSum += Math.abs(angle - 180)
  }
  const avgSmoothness = smoothnessSum / (jawPointsL.length - 2)
  const contourSmooth = avgSmoothness < 15 ? 'Smooth' : avgSmoothness < 30 ? 'Moderate' : 'Rough'

  // Jawline definition (pixel-based darkness below jawline for shadow)
  let jawlineDefLabel = 'Moderate'
  // Use Z-depth difference as proxy for definition
  const jawZ = Math.abs(jawL.z - jawR.z)
  if (jawZ > 0.05) jawlineDefLabel = 'Well-defined'
  else if (jawZ < 0.02) jawlineDefLabel = 'Soft'

  // Score
  let score = 72
  if (jawWidthClass === 'Balanced') score += 8
  if (mandibularDef === 'Defined') score += 6
  if (jawLengthClass === 'Balanced') score += 4
  if (contourSmooth === 'Smooth') score += 3
  if (jawlineDefLabel === 'Well-defined') score += 4
  if (mandibularDef === 'Soft') score -= 3
  score = Math.min(99, Math.max(50, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Strong' : score >= 70 ? 'Defined' : 'Soft',
    jawWidth: jawWidthPct,
    jawWidthClass,
    jawAngle: avgAngle.toFixed(1),
    mandibularDefinition: mandibularDef,
    jawLength: avgJawLength,
    jawLengthClass,
    contourSmoothness: contourSmooth,
    jawlineDefinition: jawlineDefLabel,
    explanation: `Your jaw spans ${jawWidthPct}% of facial width (${jawWidthClass}) with a ${mandibularDef.toLowerCase()} mandibular angle of ${avgAngle.toFixed(1)}°. The jawline shows ${contourSmooth.toLowerCase()} contour smoothness and ${jawlineDefLabel.toLowerCase()} definition. Jaw length is ${jawLengthClass.toLowerCase()} at ${avgJawLength}% of face height.`,
  }
}

/* ── Chin (standalone) ── */
function chinMetrics(landmarks) {
  const chin = lm(landmarks, 152)
  const forehead = lm(landmarks, 10)
  const lipLower = lm(landmarks, 14)
  const lipUpper = lm(landmarks, 13)
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  const noseTip = lm(landmarks, 1)
  const faceH = chin.y - forehead.y || 0.3
  const faceW = Math.abs(jawR.x - jawL.x) || 0.3
  const ipd = distLandmarks(lm(landmarks, 33), lm(landmarks, 263)) || 0.001

  // Chin height (chin to lower lip / face height)
  const chinHeight = Math.abs(chin.y - lipLower.y) / faceH
  const chinHeightPct = (chinHeight * 100).toFixed(1)
  const chinHeightClass = chinHeight > 0.12 ? 'Long' : chinHeight > 0.06 ? 'Balanced' : 'Short'

  // Chin projection (z-depth)
  const chinProj = chin.z || 0
  const noseProj = noseTip.z || 0
  const projDiff = chinProj - noseProj
  const projection = projDiff > -0.02 ? 'Prominent' : projDiff > -0.06 ? 'Balanced' : 'Recessed'

  // Chin width (chin-to-jaw span at chin level / face width)
  const chinL = lm(landmarks, 148)
  const chinR = lm(landmarks, 377)
  const chinWidth = distLandmarks(chinL, chinR) / faceW * 100
  const chinWidthPct = chinWidth.toFixed(1)
  const chinWidthClass = chinWidth > 70 ? 'Wide' : chinWidth > 50 ? 'Balanced' : 'Narrow'

  // Chin shape (based on contour)
  const chinMid = lm(landmarks, 152)
  const chinLeft = lm(landmarks, 149)
  const chinRight = lm(landmarks, 378)
  const angle = angleBetween(chinLeft, chinMid, chinRight)
  const chinShape = angle > 160 ? 'Round' : angle > 120 ? 'Soft square' : 'Pointed'

  // Labiomental angle (lower lip to chin angle)
  const labiomentalAngle = angleBetween(lipLower, lm(landmarks, 17), chin)
  const labiomentalClass = labiomentalAngle > 120 ? 'Open' : labiomentalAngle > 90 ? 'Defined' : 'Deep'

  // Score
  let score = 75
  if (chinHeightClass === 'Balanced') score += 7
  if (projection === 'Balanced' || projection === 'Prominent') score += 5
  if (chinWidthClass === 'Balanced') score += 4
  if (projection === 'Recessed') score -= 5
  if (chinHeightClass === 'Short') score -= 3
  score = Math.min(99, Math.max(50, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Well-proportioned' : score >= 70 ? 'Balanced' : 'Soft',
    chinHeight: chinHeightPct,
    chinHeightClass,
    projection,
    chinWidth: chinWidthPct,
    chinWidthClass,
    chinShape,
    labiomentalAngle: labiomentalAngle.toFixed(1),
    labiomentalClassification: labiomentalClass,
    explanation: `Your chin is ${chinHeightClass.toLowerCase()} (${chinHeightPct}% of face height) with ${projection.toLowerCase()} projection. The chin is ${chinWidthClass.toLowerCase()} (${chinWidthPct}% of face width) with a ${chinShape.toLowerCase()} shape. The labiomental fold shows a ${labiomentalClass.toLowerCase()} angle of ${labiomentalAngle.toFixed(1)}°, contributing to lower facial balance.`,
  }
}

/* ── Smile Analysis ── */
function smileMetrics(landmarks) {
  const mouthL = lm(landmarks, 61)   // left mouth corner
  const mouthR = lm(landmarks, 291)  // right mouth corner
  const upperLip = lm(landmarks, 13)
  const lowerLip = lm(landmarks, 14)
  const noseTip = lm(landmarks, 1)
  const ipd = distLandmarks(lm(landmarks, 33), lm(landmarks, 263)) || 0.001

  // Mouth width relative to IPD
  const mouthWidth = distLandmarks(mouthL, mouthR)
  const mouthWidthRatio = (mouthWidth / ipd).toFixed(2)
  const mouthWidthClass = parseFloat(mouthWidthRatio) > 1.5 ? 'Wide' : parseFloat(mouthWidthRatio) > 1.1 ? 'Balanced' : 'Narrow'

  // Lip curvature (smile arch: corners relative to center)
  const lipCenter = lm(landmarks, 0) // upper lip center
  const cornerAvgY = (mouthL.y + mouthR.y) / 2
  const curvaturePct = ((lipCenter.y - cornerAvgY) / ipd * 100).toFixed(1)
  const curvature = parseFloat(curvaturePct) > 3 ? 'Upturned' : parseFloat(curvaturePct) > -2 ? 'Straight' : 'Downturned'

  // Smile width (lateral extent relative to nose width)
  const noseL = lm(landmarks, 48)
  const noseR = lm(landmarks, 278)
  const noseWidth = distLandmarks(noseL, noseR)
  const smileWidthRatio = (mouthWidth / noseWidth).toFixed(2)
  const smileWidthClass = parseFloat(smileWidthRatio) > 1.8 ? 'Wide' : parseFloat(smileWidthRatio) > 1.3 ? 'Balanced' : 'Narrow'

  // Lip fullness (upper to lower lip ratio)
  const upperThickness = distLandmarks(upperLip, lm(landmarks, 0))
  const lowerThickness = distLandmarks(lowerLip, lm(landmarks, 17))
  const ulRatio = upperThickness / (lowerThickness || 0.001)
  const lipBalance = ulRatio > 1.3 ? 'Upper-heavy' : ulRatio < 0.7 ? 'Lower-heavy' : 'Balanced'

  // Nasolabial fold prominence (distance from nose to mouth corner line)
  const nasoFoldL = lm(landmarks, 50) // fold area left
  const nasoFoldR = lm(landmarks, 280) // fold area right
  const foldDepth = Math.abs(((nasoFoldL.z || 0) + (nasoFoldR.z || 0)) / 2)
  const foldProminence = foldDepth > 0.03 ? 'Deep' : foldDepth > 0.01 ? 'Moderate' : 'Subtle'

  // Score
  let score = 78
  if (mouthWidthClass === 'Balanced') score += 5
  if (curvature === 'Upturned') score += 4
  if (smileWidthClass === 'Balanced') score += 3
  if (lipBalance === 'Balanced') score += 4
  if (foldProminence === 'Subtle') score += 3
  if (curvature === 'Downturned') score -= 3
  score = Math.min(99, Math.max(50, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Expressive' : score >= 70 ? 'Balanced' : 'Subtle',
    mouthWidthRatio,
    mouthWidthClass,
    curvature,
    curvaturePct,
    smileWidthRatio,
    smileWidthClass,
    lipBalance,
    upperToLowerRatio: ulRatio.toFixed(2),
    nasolabialFold: foldProminence,
    explanation: `Your smile spans ${mouthWidthRatio}× interpupillary distance (${mouthWidthClass}) with a ${curvature.toLowerCase()} curvature of ${curvaturePct}%. The smile width is ${smileWidthClass.toLowerCase()} relative to nose width (${smileWidthRatio}×). Upper-to-lower lip ratio is ${ulRatio.toFixed(2)} (${lipBalance}). Nasolabial folds show ${foldProminence.toLowerCase()} prominence.`,
  }
}

/* ── Neck Analysis ── */
function neckMetrics(landmarks) {
  const chin = lm(landmarks, 152)
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  const forehead = lm(landmarks, 10)
  const noseTip = lm(landmarks, 1)
  const faceH = chin.y - forehead.y || 0.3
  const ipd = distLandmarks(lm(landmarks, 33), lm(landmarks, 263)) || 0.001

  // Neck width estimate (jaw angle width)
  const jawWidth = distLandmarks(jawL, jawR)
  const neckWidthPct = ((jawWidth / ipd) * 100).toFixed(1)
  const neckWidthClass = parseFloat(neckWidthPct) > 120 ? 'Wide' : parseFloat(neckWidthPct) > 95 ? 'Balanced' : 'Slender'

  // Neck length estimate (chin to estimated neck base)
  // MediaPipe face mesh doesn't have neck points, estimate from jaw-to-chin proportions
  const chinToJawL = distLandmarks(chin, jawL)
  const chinToJawR = distLandmarks(chin, jawR)
  const avgChinToJaw = (chinToJawL + chinToJawR) / 2
  const neckLengthPct = ((avgChinToJaw / faceH) * 100).toFixed(1)
  const neckLengthClass = parseFloat(neckLengthPct) > 55 ? 'Long' : parseFloat(neckLengthPct) > 38 ? 'Balanced' : 'Short'

  // Neck-jaw angle (how defined the jaw-neck transition is)
  const angleL = angleBetween(lm(landmarks, 127), jawL, chin)
  const angleR = angleBetween(lm(landmarks, 356), jawR, chin)
  const avgAngle = (angleL + angleR) / 2
  const jawNeckAngle = avgAngle > 150 ? 'Smooth' : avgAngle > 120 ? 'Defined' : 'Angular'

  // Neck tilt (forward head posture estimate from chin vs forehead z)
  const chinZ = chin.z || 0
  const foreZ = forehead.z || 0
  const tiltDiff = chinZ - foreZ
  const posture = tiltDiff > 0.02 ? 'Forward tilt' : tiltDiff < -0.02 ? 'Rear tilt' : 'Neutral'

  // Score
  let score = 75
  if (neckWidthClass === 'Balanced') score += 6
  if (neckLengthClass === 'Balanced') score += 5
  if (jawNeckAngle === 'Defined') score += 4
  if (posture === 'Neutral') score += 3
  if (neckWidthClass === 'Wide') score -= 3
  score = Math.min(99, Math.max(50, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Elegant' : score >= 70 ? 'Balanced' : 'Compact',
    neckWidth: neckWidthPct,
    neckWidthClass,
    neckLength: neckLengthPct,
    neckLengthClass,
    jawNeckTransition: jawNeckAngle,
    jawNeckAngle: avgAngle.toFixed(1),
    headPosture: posture,
    explanation: `Your neck proportions show ${neckWidthClass.toLowerCase()} width (${neckWidthPct}% of IPD) and ${neckLengthClass.toLowerCase()} length (${neckLengthPct}% of face height). The jaw-to-neck transition is ${jawNeckAngle.toLowerCase()} at ${avgAngle.toFixed(1)}°. Head posture appears ${posture.toLowerCase()}.`,
  }
}

/* ── Ear Analysis ── */
function earMetrics(landmarks) {
  const earL = lm(landmarks, 234)  // right ear landmark
  const earR = lm(landmarks, 454)  // left ear landmark
  const eyeL = lm(landmarks, 33)   // right eye
  const eyeR = lm(landmarks, 263)  // left eye
  const noseTip = lm(landmarks, 1)
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = chin.y - forehead.y || 0.3
  const ipd = distLandmarks(eyeL, eyeR) || 0.001

  // Ear size estimate (distance from ear to nearest eye)
  const earSizeL = distLandmarks(earL, eyeL) / ipd
  const earSizeR = distLandmarks(earR, eyeR) / ipd
  const avgEarSize = ((earSizeL + earSizeR) / 2).toFixed(2)
  const earSizeClass = parseFloat(avgEarSize) > 1.3 ? 'Prominent' : parseFloat(avgEarSize) > 0.9 ? 'Balanced' : 'Small'

  // Ear symmetry
  const sizeDiff = Math.abs(earSizeL - earSizeR) / ipd * 100
  const earSymmetry = sizeDiff < 5 ? 'Symmetric' : sizeDiff < 12 ? 'Mildly asymmetric' : 'Asymmetric'

  // Ear protrusion (z-distance from face plane)
  const earZL = Math.abs(earL.z || 0)
  const earZR = Math.abs(earR.z || 0)
  const avgEarZ = (earZL + earZR) / 2
  const protrusion = avgEarZ > 0.08 ? 'Protruding' : avgEarZ > 0.04 ? 'Moderate' : 'Close-set'

  // Ear height (ear y-position relative to face — ideally ear top aligns with brow, bottom with nose base)
  const earTopY = earL.y - 0.03 // approximate top of ear from landmark
  const browY = lm(landmarks, 70).y  // brow level
  const noseBaseY = lm(landmarks, 2).y // nose base
  const earMidY = (earL.y + earR.y) / 2
  const faceMidY = (chin.y + forehead.y) / 2
  const earVerticalPos = earMidY > faceMidY ? 'Low-set' : earMidY < faceMidY - 0.02 ? 'High-set' : 'Mid-set'

  // Score
  let score = 78
  if (earSizeClass === 'Balanced') score += 6
  if (earSymmetry === 'Symmetric') score += 5
  if (protrusion === 'Moderate') score += 4
  if (earVerticalPos === 'Mid-set') score += 3
  if (earSizeClass === 'Prominent') score -= 2
  if (protrusion === 'Protruding') score -= 3
  score = Math.min(99, Math.max(50, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Proportioned' : score >= 70 ? 'Balanced' : 'Distinctive',
    earSize: avgEarSize,
    earSizeClass,
    earSymmetry,
    sizeDifference: sizeDiff.toFixed(1),
    protrusion,
    earProtrusion: avgEarZ.toFixed(3),
    earPosition: earVerticalPos,
    explanation: `Your ears are ${earSizeClass.toLowerCase()} (${avgEarSize}× IPD) and ${earSymmetry.toLowerCase()} (diff: ${sizeDiff.toFixed(1)}%). Protrusion is ${protrusion.toLowerCase()} with ${earVerticalPos.toLowerCase()} positioning. ${earSizeClass === 'Balanced' ? 'Ear proportions contribute to harmonious facial framing.' : 'Ear prominence affects the overall silhouette.'}`,
  }
}

async function skinQualityMetrics(landmarks, imageSrc, metrics) {
  const faceBox = bboxFullFace(landmarks, 0.02)

  // Sample real pixel data from forehead, left cheek, right cheek, chin, under-eye, nose
  const foreheadBox = {
    x: faceBox.x + faceBox.w * 0.2,
    y: faceBox.y + faceBox.h * 0.02,
    w: faceBox.w * 0.6,
    h: faceBox.h * 0.15,
  }
  const leftCheekBox = {
    x: faceBox.x + faceBox.w * 0.05,
    y: faceBox.y + faceBox.h * 0.4,
    w: faceBox.w * 0.3,
    h: faceBox.h * 0.25,
  }
  const rightCheekBox = {
    x: faceBox.x + faceBox.w * 0.65,
    y: faceBox.y + faceBox.h * 0.4,
    w: faceBox.w * 0.3,
    h: faceBox.h * 0.25,
  }
  const chinBox = {
    x: faceBox.x + faceBox.w * 0.25,
    y: faceBox.y + faceBox.h * 0.8,
    w: faceBox.w * 0.5,
    h: faceBox.h * 0.15,
  }
  const underEyeBoxL = {
    x: faceBox.x + faceBox.w * 0.15,
    y: faceBox.y + faceBox.h * 0.3,
    w: faceBox.w * 0.25,
    h: faceBox.h * 0.1,
  }
  const underEyeBoxR = {
    x: faceBox.x + faceBox.w * 0.6,
    y: faceBox.y + faceBox.h * 0.3,
    w: faceBox.w * 0.25,
    h: faceBox.h * 0.1,
  }
  // Nose bridge and jaw for full regional analysis
  const noseBridgeBox = {
    x: faceBox.x + faceBox.w * 0.35,
    y: faceBox.y + faceBox.h * 0.3,
    w: faceBox.w * 0.3,
    h: faceBox.h * 0.3,
  }
  const jawBox = {
    x: faceBox.x + faceBox.w * 0.15,
    y: faceBox.y + faceBox.h * 0.7,
    w: faceBox.w * 0.7,
    h: faceBox.h * 0.15,
  }

  let forehead, leftCheek, rightCheek, chin, underEyeL, underEyeR, noseBridge, jaw
  try {
    ;[forehead, leftCheek, rightCheek, chin, underEyeL, underEyeR, noseBridge, jaw] = await Promise.all([
      sampleRegionStats(imageSrc, foreheadBox),
      sampleRegionStats(imageSrc, leftCheekBox),
      sampleRegionStats(imageSrc, rightCheekBox),
      sampleRegionStats(imageSrc, chinBox),
      sampleRegionStats(imageSrc, underEyeBoxL),
      sampleRegionStats(imageSrc, underEyeBoxR),
      sampleRegionStats(imageSrc, noseBridgeBox),
      sampleRegionStats(imageSrc, jawBox),
    ])
  } catch {
    return {
      score: 75, scoreLabel: 'Good condition',
      tone: 'Even', texture: 'Moderate', clarity: 'Moderate',
      redness: 'Normal', brightness: '0', underEyeHealth: 'Good', underEyeBrightness: '0',
      regions: [],
      explanation: 'Skin quality analysis could not be performed on this image.',
    }
  }

  const avgBrightness = (safeNum(forehead.brightness) + safeNum(leftCheek.brightness) + safeNum(rightCheek.brightness) + safeNum(chin.brightness)) / 4
  const avgRedness = (Math.abs(safeNum(forehead.redness)) + Math.abs(safeNum(leftCheek.redness)) + Math.abs(safeNum(rightCheek.redness)) + Math.abs(safeNum(chin.redness))) / 4
  const underEyeAvg = (safeNum(underEyeL.brightness) + safeNum(underEyeR.brightness)) / 2

  // Per-region data
  const regions = [
    { name: 'Forehead', brightness: safeRound(forehead.brightness), redness: parseFloat(safeFixed(forehead.redness, 1)) },
    { name: 'Left cheek', brightness: safeRound(leftCheek.brightness), redness: parseFloat(safeFixed(leftCheek.redness, 1)) },
    { name: 'Right cheek', brightness: safeRound(rightCheek.brightness), redness: parseFloat(safeFixed(rightCheek.redness, 1)) },
    { name: 'Nose bridge', brightness: safeRound(noseBridge.brightness), redness: parseFloat(safeFixed(noseBridge.redness, 1)) },
    { name: 'Chin', brightness: safeRound(chin.brightness), redness: parseFloat(safeFixed(chin.redness, 1)) },
    { name: 'Jaw line', brightness: safeRound(jaw.brightness), redness: parseFloat(safeFixed(jaw.redness, 1)) },
  ]

  // Skin tone classification
  let tone = 'Even'
  const toneVariance = Math.abs(leftCheek.brightness - rightCheek.brightness)
  if (toneVariance > 15) tone = 'Slightly uneven'
  if (toneVariance > 30) tone = 'Noticeably uneven'

  // Regional variance (max-min brightness across all regions)
  const regionBrights = regions.map(r => r.brightness)
  const maxRB = Math.max(...regionBrights)
  const minRB = Math.min(...regionBrights)
  const regionalVariance = maxRB - minRB

  // Skin tone classification by brightness
  let skinTone = 'Medium'
  if (avgBrightness > 180) skinTone = 'Fair'
  else if (avgBrightness > 150) skinTone = 'Light'
  else if (avgBrightness > 120) skinTone = 'Medium'
  else if (avgBrightness > 90) skinTone = 'Olive'
  else if (avgBrightness > 60) skinTone = 'Tan'
  else skinTone = 'Deep'

  // Redness classification
  let rednessLabel = 'Normal'
  if (avgRedness > 12) rednessLabel = 'Mild redness'
  if (avgRedness > 20) rednessLabel = 'Moderate redness'

  // Brightness/hydration classification
  let texture = 'Smooth'
  if (avgBrightness < 100) texture = 'Dull'
  if (avgBrightness < 80) texture = 'Very dull'
  if (avgBrightness > 160) texture = 'Well-hydrated'

  // Pore congestion estimate (nose brightness vs forehead)
  const poreEstimate = noseBridge.brightness > forehead.brightness + 10
    ? 'Oily T-zone'
    : noseBridge.brightness < forehead.brightness - 15 ? 'Dry T-zone' : 'Balanced T-zone'

  // Pigmentation estimate (max regional brightness variance)
  let pigmentation = 'Even'
  if (regionalVariance > 25) pigmentation = 'Mild variation'
  if (regionalVariance > 40) pigmentation = 'Noticeable hyperpigmentation'

  // Under-eye classification
  let underEye = 'Good'
  if (underEyeAvg < 120) underEye = 'Shadowed'
  if (underEyeAvg < 95) underEye = 'Dark circles present'
  if (underEyeAvg > 140) underEye = 'Bright'

  // Clarity
  let clarity = 'Good'
  if (avgRedness > 15 || toneVariance > 20) clarity = 'Moderate'
  if (avgRedness > 25 || toneVariance > 35) clarity = 'Needs attention'

  // Overall skin score (weighted composite)
  let score = 70
  if (avgBrightness > 120 && avgBrightness < 180) score += 10
  else if (avgBrightness > 100) score += 5
  if (avgRedness > 20) score -= 8
  else if (avgRedness > 12) score -= 3
  if (toneVariance < 10) score += 8
  else if (toneVariance < 20) score += 4
  else if (toneVariance > 30) score -= 5
  if (underEyeAvg > 130) score += 5
  else if (underEyeAvg < 100) score -= 3
  if (regionalVariance > 40) score -= 3
  if (metrics?.quality) {
    const q = parseInt(metrics.quality, 10)
    if (!isNaN(q)) score = Math.round(score * 0.6 + q * 0.4)
  }
  score = Math.min(99, Math.max(45, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Clear' : score >= 70 ? 'Good condition' : 'Needs attention',
    skinTone,
    tone,
    texture,
    clarity,
    redness: rednessLabel,
    brightness: safeFixed(avgBrightness, 0),
    underEyeHealth: underEye,
    underEyeBrightness: safeFixed(underEyeAvg, 0),
    poreEstimate,
    pigmentation,
    regionalVariance: regionalVariance.toFixed(0),
    regions,
    explanation: `Forehead brightness ${safeFixed(avgBrightness, 0)} · cheek redness index ${safeFixed(avgRedness, 1)} · tone uniformity ${toneVariance < 10 ? 'high' : toneVariance < 20 ? 'moderate' : 'varied'}. Under-eye region shows ${underEye.toLowerCase()} appearance. ${tone !== 'Even' ? 'Tone appears ' + tone.toLowerCase() + '.' : 'Skin tone is relatively even across regions.'} ${rednessLabel !== 'Normal' ? 'Mild redness detected — consider anti-inflammatory skincare.' : ''}`,
  }
}

/* ── Sexual Dimorphism Metrics ── */
function dimorphismMetrics(landmarks, metrics) {
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  const chin = lm(landmarks, 152)
  const forehead = lm(landmarks, 10)
  const cheekL = lm(landmarks, 127)
  const cheekR = lm(landmarks, 356)
  const noseTip = lm(landmarks, 1)
  const noseBridge = lm(landmarks, 6)
  const mouthL = lm(landmarks, 61)
  const mouthR = lm(landmarks, 291)
  const upperLip = lm(landmarks, 13)
  const lowerLip = lm(landmarks, 14)
  const lb = lm(landmarks, 105)
  const rb = lm(landmarks, 334)
  const rInner = lm(landmarks, 70)
  const lInner = lm(landmarks, 300)
  const eyeL = lm(landmarks, 33)
  const eyeR = lm(landmarks, 263)
  const ipd = distLandmarks(eyeL, eyeR) || 0.001
  const faceH = chin.y - forehead.y || 0.3
  const faceW = Math.abs(jawR.x - jawL.x) || 0.3
  const cheekW = Math.abs(cheekR.x - cheekL.x) || 0.3

  // Helper: map 0-1 value to 0-100 scale (0=feminine, 100=masculine)
  function scoreFeature(masculineScore, label) {
    const clamped = Math.max(0, Math.min(100, masculineScore))
    const rangeLabel = clamped >= 80 ? 'Very Masculine' : clamped >= 60 ? 'Masculine' : clamped >= 40 ? 'Moderate' : clamped >= 20 ? 'Feminine' : 'Very Feminine'
    return { score: clamped, label: rangeLabel }
  }

  // Eyebrows: thicker, lower-set, straighter = masculine
  const browEyeGap = ((eyeL.y - lb.y) + (eyeR.y - rb.y)) / 2 / faceH
  const rTop = lm(landmarks, 107)
  const rBot = lm(landmarks, 52)
  const lTop = lm(landmarks, 336)
  const lBot = lm(landmarks, 282)
  const browThickness = ((distLandmarks(rTop, rBot) + distLandmarks(lTop, lBot)) / 2) / faceH
  const browArch = ((rTop.y - lb.y) + (lTop.y - rb.y)) / 2
  let browScore = 50
  browScore += (browThickness > 0.07 ? 15 : browThickness > 0.045 ? 5 : -10)
  browScore += (browEyeGap < 0.1 ? 12 : browEyeGap > 0.16 ? -10 : 0)
  browScore += (Math.abs(browArch) < 0.005 ? 10 : -5) // straighter = more masculine
  const eyebrows = scoreFeature(browScore, 'Eyebrows')

  // Nose: larger bridge width, more prominent = masculine
  const noseW = distLandmarks(lm(landmarks, 48), lm(landmarks, 278))
  const noseH = distLandmarks(noseBridge, noseTip)
  const noseRatio = noseW / (noseH || 0.001)
  const noseFaceRatio = noseW / ipd
  let noseScore = 50
  noseScore += (noseFaceRatio > 0.45 ? 15 : noseFaceRatio > 0.35 ? 5 : -10)
  noseScore += (noseRatio > 0.8 ? 10 : noseRatio > 0.6 ? 0 : -8)
  const nose = scoreFeature(noseScore, 'Nose')

  // Cheeks: wider, flatter = masculine. Prominent cheekbones = feminine
  const cheekProminence = ((cheekL.z || 0) + (cheekR.z || 0)) / 2
  const cheekWidthRatio = cheekW / faceW
  let cheekScore = 50
  cheekScore += (cheekWidthRatio > 0.85 ? 8 : cheekWidthRatio < 0.7 ? -5 : 0)
  cheekScore += (cheekProminence > 0.02 ? -10 : cheekProminence < -0.01 ? 8 : 0)
  const cheeks = scoreFeature(cheekScore, 'Cheeks')

  // Lips: thinner = masculine, fuller = feminine
  const lipFullness = distLandmarks(upperLip, lm(landmarks, 0)) + distLandmarks(lowerLip, lm(landmarks, 17))
  const lipFullnessRatio = lipFullness / ipd
  const philtrum = distLandmarks(noseTip, upperLip)
  const philtrumRatio = philtrum / (lipFullness || 0.001)
  let lipScore = 50
  lipScore += (lipFullnessRatio > 0.18 ? -12 : lipFullnessRatio > 0.12 ? -4 : 8)
  lipScore += (philtrumRatio > 1.5 ? 8 : philtrumRatio < 1 ? -5 : 0)
  const lips = scoreFeature(lipScore, 'Lips')

  // Jaw: wider, more angular = masculine
  const jawWidth = Math.abs(jawR.x - jawL.x)
  const jawWidthRatio = jawWidth / faceW
  const angleL = Math.abs(Math.atan2(chin.y - jawL.y, chin.x - jawL.x) * 180 / Math.PI)
  const angleR = Math.abs(Math.atan2(chin.y - jawR.y, chin.x - jawR.x) * 180 / Math.PI)
  const jawAngle = (angleL + angleR) / 2
  let jawScore = 50
  jawScore += (jawWidthRatio > 0.92 ? 15 : jawWidthRatio > 0.8 ? 5 : -8)
  jawScore += (jawAngle < 130 ? 10 : jawAngle > 150 ? -5 : 0)
  const jaw = scoreFeature(jawScore, 'Jaw')

  // Chin: wider, squarer = masculine
  const chinW = distLandmarks(lm(landmarks, 148), lm(landmarks, 377))
  const chinWidthRatio = chinW / faceW
  const chinHeight = distLandmarks(chin, lowerLip)
  const chinHeightRatio = chinHeight / faceH
  let chinScore = 50
  chinScore += (chinWidthRatio > 0.55 ? 12 : chinWidthRatio < 0.35 ? -8 : 0)
  chinScore += (chinHeightRatio > 0.1 ? 8 : chinHeightRatio < 0.06 ? -5 : 0)
  const chinFeature = scoreFeature(chinScore, 'Chin')

  // Neck: thicker = masculine
  const neckWidthRatio = distLandmarks(jawL, jawR) / ipd
  let neckScore = 50
  neckScore += (neckWidthRatio > 3 ? 12 : neckWidthRatio > 2.5 ? 4 : -8)
  const neck = scoreFeature(neckScore, 'Neck')

  // Eyes: larger = feminine, smaller = masculine
  const eyeSpan = distLandmarks(eyeL, eyeR) / faceW
  const eyeOpenL = distLandmarks(lm(landmarks, 159), lm(landmarks, 145))
  const eyeOpenR = distLandmarks(lm(landmarks, 386), lm(landmarks, 374))
  const eyeOpenRatio = ((eyeOpenL + eyeOpenR) / 2) / ipd
  let eyeScore = 50
  eyeScore += (eyeOpenRatio > 0.2 ? -12 : eyeOpenRatio < 0.12 ? 8 : 0)
  eyeScore += (eyeSpan > 0.42 ? -8 : eyeSpan < 0.32 ? 6 : 0)
  const eyes = scoreFeature(eyeScore, 'Eyes')

  // Ears: larger, more protruding = masculine
  const earL = lm(landmarks, 234)
  const earR = lm(landmarks, 454)
  const earSize = ((distLandmarks(earL, eyeL) + distLandmarks(earR, eyeR)) / 2) / ipd
  const earProtrusion = (Math.abs(earL.z || 0) + Math.abs(earR.z || 0)) / 2
  let earScore = 50
  earScore += (earSize > 1.2 ? 10 : earSize < 0.8 ? -8 : 0)
  earScore += (earProtrusion > 0.06 ? 6 : -4)
  const ears = scoreFeature(earScore, 'Ears')

  // Overall dimorphism score (weighted average)
  const allScores = [eyebrows.score, nose.score, cheeks.score, lips.score, jaw.score, chinFeature.score, neck.score, eyes.score, ears.score]
  const weights = [1.2, 1.1, 0.8, 1.0, 1.3, 1.1, 0.7, 0.9, 0.6]
  const weightedSum = allScores.reduce((s, v, i) => s + v * weights[i], 0)
  const weightTotal = weights.reduce((a, b) => a + b, 0)
  const overallScore = Math.round(weightedSum / weightTotal)
  const overallLabel = overallScore >= 80 ? 'Very Masculine' : overallScore >= 60 ? 'Masculine' : overallScore >= 40 ? 'Moderate' : overallScore >= 20 ? 'Feminine' : 'Very Feminine'

  const browSet =
    browEyeGap < 0.1 ? 'low-set' : browEyeGap > 0.16 ? 'higher-set' : 'moderately set'
  const browForm =
    Math.abs(browArch) < 0.005 ? 'straighter' : 'more arched'
  const features = [
    {
      name: 'Eyebrows',
      ...eyebrows,
      explanation:
        `Your brows score ${eyebrows.score} (${eyebrows.label.toLowerCase()}): ` +
        `${browSet}, ${browForm}, relative thickness ${(browThickness * 100).toFixed(1)}% of face height.`,
    },
    {
      name: 'Eyes',
      ...eyes,
      explanation:
        `Your eyes score ${eyes.score} (${eyes.label.toLowerCase()}): ` +
        `aperture ${(eyeOpenRatio * 100).toFixed(1)}% of IPD, span ${(eyeSpan * 100).toFixed(1)}% of face width.`,
    },
    {
      name: 'Nose',
      ...nose,
      explanation:
        `Your nose scores ${nose.score} (${nose.label.toLowerCase()}): ` +
        `alar width ${(noseFaceRatio * 100).toFixed(1)}% of IPD, width-to-length ${noseRatio.toFixed(2)}.`,
    },
    {
      name: 'Cheeks',
      ...cheeks,
      explanation:
        `Your cheeks score ${cheeks.score} (${cheeks.label.toLowerCase()}): ` +
        `cheek width ${(cheekWidthRatio * 100).toFixed(1)}% of face width` +
        `${cheekProminence > 0.01 ? ', more projected cheekbones' : cheekProminence < -0.01 ? ', flatter midface depth' : ''}.`,
    },
    {
      name: 'Lips',
      ...lips,
      explanation:
        `Your lips score ${lips.score} (${lips.label.toLowerCase()}): ` +
        `fullness ${(lipFullnessRatio * 100).toFixed(1)}% of IPD, philtrum-to-lip ${philtrumRatio.toFixed(2)}.`,
    },
    {
      name: 'Jaw',
      ...jaw,
      explanation:
        `Your jaw scores ${jaw.score} (${jaw.label.toLowerCase()}): ` +
        `width ${(jawWidthRatio * 100).toFixed(1)}% of face width, mean mandibular angle ${jawAngle.toFixed(0)}°.`,
    },
    {
      name: 'Chin',
      ...chinFeature,
      explanation:
        `Your chin scores ${chinFeature.score} (${chinFeature.label.toLowerCase()}): ` +
        `width ${(chinWidthRatio * 100).toFixed(1)}% of face width, height ${(chinHeightRatio * 100).toFixed(1)}% of face height.`,
    },
    {
      name: 'Neck',
      ...neck,
      explanation:
        `Your neck scores ${neck.score} (${neck.label.toLowerCase()}): ` +
        `breadth ${neckWidthRatio.toFixed(2)}× IPD from the jaw landmarks.`,
    },
    {
      name: 'Ears',
      ...ears,
      explanation:
        `Your ears score ${ears.score} (${ears.label.toLowerCase()}): ` +
        `relative size ${earSize.toFixed(2)}× IPD` +
        `${earProtrusion > 0.06 ? ', with more lateral protrusion' : ''}.`,
    },
  ]

  const topDrivers = [...features]
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, 3)
    .map((f) => `${f.name.toLowerCase()} (${f.label.toLowerCase()}, ${f.score})`)

  return {
    overallScore,
    overallLabel,
    scaleLeft: 'Hyper Feminine',
    scaleRight: 'Hyper Masculine',
    explanation:
      `Your overall dimorphism reads as ${overallLabel.toLowerCase()} (${overallScore}/100). ` +
      `The strongest measured drivers are ${topDrivers.join(', ')}.`,
    features,
  }
}

/* ── Averageness Metrics ── */
function averagenessMetrics(landmarks, metrics, answers = {}) {
  return computePrototypicalityReport(landmarks, metrics, answers)
}

function overallScore(cvReport, eyeAnalysis, metrics) {
  const weighted = []
  const add = (score, weight = 1) => {
    if (score != null && !Number.isNaN(score)) weighted.push({ score: Number(score), weight })
  }
  add(cvReport?.symmetry?.score, 1.25)
  add(cvReport?.proportions?.score, 1.25)
  add(metrics?.harmonyScore ? parseInt(metrics.harmonyScore, 10) : null, 1.3)
  add(cvReport?.skin?.score, 1.0)
  add(cvReport?.nose?.score, 0.85)
  add(cvReport?.lips?.score, 0.85)
  add(cvReport?.jawChin?.score, 0.9)
  add(cvReport?.cheeks?.score, 0.75)
  add(cvReport?.jaw?.score, 0.75)
  add(cvReport?.chin?.score, 0.75)
  add(cvReport?.smile?.score, 0.7)
  add(cvReport?.neck?.score, 0.65)
  add(cvReport?.ears?.score, 0.6)
  add(cvReport?.hair?.score, 0.7)
  add(eyeAnalysis?.overallScore, 0.9)
  if (weighted.length === 0) return 75
  const sum = weighted.reduce((a, w) => a + w.score * w.weight, 0)
  const totalW = weighted.reduce((a, w) => a + w.weight, 0)
  return Math.round(sum / totalW)
}

function overallLabel(score) {
  if (score >= 90) return 'Exceptional'
  if (score >= 82) return 'Above Average'
  if (score >= 74) return 'Average'
  if (score >= 65) return 'Below Average'
  return 'Needs Improvement'
}

function faceShapeFromLandmarks(landmarks, imageSize = null) {
  if (!landmarks?.length) {
    return {
      shape: 'Oval',
      facialLength: 'Average',
      foreheadWidth: 'Normal',
      midfaceWidth: 'Normal',
      lowerThirdWidth: 'Normal',
      explanation: 'Face shape could not be measured from landmarks.',
      overlay: null,
      overlaySpace: 'image',
    }
  }

  const w = imageSize?.width > 0 ? imageSize.width : 1
  const h = imageSize?.height > 0 ? imageSize.height : 1
  const pt = (idx) => {
    const p = lm(landmarks, idx)
    return { x: p.x * w, y: p.y * h }
  }
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

  let pTop = pt(10)
  const pChin = pt(152)
  let pRt = pt(103)
  let pLt = pt(332)
  const pRc = pt(234)
  const pLc = pt(454)
  const pRj = pt(132)
  const pLj = pt(361)

  const coreHeight = dist2(pChin, pt(9)) || h * 0.35
  pTop = { x: pTop.x, y: pTop.y - coreHeight * 0.15 }
  pRt = { x: pRt.x - coreHeight * 0.015, y: pRt.y - coreHeight * 0.1 }
  pLt = { x: pLt.x + coreHeight * 0.015, y: pLt.y - coreHeight * 0.1 }

  const facialLength = dist2(pTop, pChin)
  const midfaceWidth = dist2(pRc, pLc) || 1e-6
  const foreheadWidth = dist2(pRt, pLt)
  const jawWidth = dist2(pRj, pLj)

  const ratio = facialLength / midfaceWidth
  let length = 'Average'
  if (ratio > 1.45) length = 'Long'
  else if (ratio < 1.25) length = 'Short'

  const fhRatio = foreheadWidth / midfaceWidth
  let forehead = 'Normal'
  if (fhRatio > 0.85) forehead = 'Wide'
  else if (fhRatio < 0.75) forehead = 'Narrow'

  const jawRatio = jawWidth / midfaceWidth
  let lowerThird = 'Normal'
  if (jawRatio > 0.85) lowerThird = 'Wide'
  else if (jawRatio < 0.75) lowerThird = 'Narrow'

  // Midface vs mean of forehead + jaw (independent of length-to-midface).
  const midRelative = midfaceWidth / (((foreheadWidth + jawWidth) / 2) || 1e-6)
  let midface = 'Normal'
  if (midRelative > 1.1) midface = 'Wide'
  else if (midRelative < 0.92) midface = 'Narrow'

  let shape = 'Oval'
  if (length === 'Average') {
    if (lowerThird === 'Wide' && forehead === 'Wide') shape = 'Square'
    else if (lowerThird === 'Narrow') shape = 'Heart'
    else if (forehead === 'Narrow' && lowerThird === 'Normal') shape = 'Round'
    else shape = 'Oval'
  } else if (length === 'Short') {
    shape = lowerThird === 'Wide' ? 'Square' : 'Round'
  } else if (length === 'Long') {
    shape = forehead === 'Wide' && lowerThird === 'Wide' ? 'Oblong' : 'Oval'
  }

  const pts = [pTop, pRt, pRc, pRj, pChin, pLj, pLc, pLt]
  const boxW = dist2(pts[2], pts[6])
  const boxH = dist2(pts[0], pts[4])
  const center = {
    x: (pts[0].x + pts[4].x) / 2,
    y: (pts[0].y + pts[4].y) / 2,
  }
  const toPct = (p) => ({
    x: Math.round((p.x / w) * 10000) / 100,
    y: Math.round((p.y / h) * 10000) / 100,
  })

  // Legacy W/H ratio (kept for Face Shape cards)
  const foreheadLm = lm(landmarks, 10)
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  const chinLm = lm(landmarks, 152)
  const faceW = Math.abs(jawR.x - jawL.x)
  const faceH = Math.max(chinLm.y - foreheadLm.y, 1e-3)
  const whRatio = faceW / faceH

  return {
    shape,
    facialLength: length,
    foreheadWidth: forehead,
    midfaceWidth: midface,
    lowerThirdWidth: lowerThird,
    lengthToMidfaceRatio: ratio.toFixed(2),
    widthHeightRatio: whRatio.toFixed(2),
    explanation:
      `Your face is classified as ${shape.toLowerCase()} based on an 8-point facial outline ` +
      `(facial length ${length.toLowerCase()}, forehead ${forehead.toLowerCase()}, ` +
      `midface ${midface.toLowerCase()} relative to brow/jaw width, ` +
      `and lower third ${lowerThird.toLowerCase()}; length-to-midface ratio ${ratio.toFixed(2)}). ` +
      `The outline and ellipse show how temples, cheekbones, and jaw frame that shape.`,
    overlay: {
      polygon: pts.map(toPct),
      ellipse: {
        cx: Math.round((center.x / w) * 10000) / 100,
        cy: Math.round((center.y / h) * 10000) / 100,
        rx: Math.round(((boxW / 2) / w) * 10000) / 100,
        ry: Math.round(((boxH / 2) / h) * 10000) / 100,
      },
      crossV: [toPct(pts[0]), toPct(pts[4])],
      crossH: [toPct(pts[2]), toPct(pts[6])],
    },
    overlaySpace: 'image',
  }
}

const SYMMETRY_MIRROR_PAIRS = [
  [33, 263], [133, 362], [61, 291], [105, 334],
  [159, 386], [145, 374], [234, 454], [127, 356],
]

const SYMMETRY_REGION_DEFS = [
  { id: 'eyes', label: 'Eyes', pairs: [[33, 263], [133, 362], [159, 386], [145, 374]] },
  { id: 'brows', label: 'Brows', pairs: [[105, 334]] },
  { id: 'mouth', label: 'Mouth', pairs: [[61, 291]] },
  { id: 'jaw', label: 'Jaw', pairs: [[234, 454], [127, 356]] },
]

function pairDeviationPct(landmarks, li, ri, nose, faceH) {
  const l = lm(landmarks, li)
  const r = lm(landmarks, ri)
  const xMir = (Math.abs(Math.abs(l.x - nose.x) - Math.abs(r.x - nose.x)) / faceH) * 100
  const yMir = (Math.abs(l.y - r.y) / faceH) * 100
  const zMir = Math.abs(Math.abs(l.z || 0) - Math.abs(r.z || 0)) * 100
  return xMir * 0.55 + yMir * 0.30 + zMir * 0.15
}

function scoreFromAvgDev(avgDev) {
  return Math.max(55, Math.min(97, Math.round(92 - avgDev * 7.5)))
}

function symmetryScore(landmarks, metrics) {
  if (!landmarks?.length) return 70
  const nose = lm(landmarks, 1)
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = Math.max(chin.y - forehead.y, 0.2)
  const deviations = SYMMETRY_MIRROR_PAIRS.map(([li, ri]) =>
    pairDeviationPct(landmarks, li, ri, nose, faceH)
  )
  const avgDev = deviations.reduce((s, d) => s + d, 0) / deviations.length
  return scoreFromAvgDev(avgDev)
}

function symmetryRegions(landmarks) {
  if (!landmarks?.length) return []
  const nose = lm(landmarks, 1)
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = Math.max(chin.y - forehead.y, 0.2)
  return SYMMETRY_REGION_DEFS.map(({ id, label, pairs }) => {
    const deviations = pairs.map(([li, ri]) => pairDeviationPct(landmarks, li, ri, nose, faceH))
    const avgDev = deviations.reduce((s, d) => s + d, 0) / deviations.length
    return {
      id,
      label,
      avgDev: Math.round(avgDev * 100) / 100,
      score: scoreFromAvgDev(avgDev),
    }
  })
}

function symmetryLabel(score) {
  if (score >= 85) return 'Highly Symmetric'
  if (score >= 74) return 'Quite Symmetric'
  if (score >= 64) return 'Balanced'
  return 'Noticeable asymmetry'
}

function symmetryExplanation(score, label, regions = []) {
  const sorted = [...regions].sort((a, b) => a.score - b.score)
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]
  let regionClause = ''
  if (weakest && strongest) {
    if (weakest.score < 74) {
      regionClause =
        ` The largest measured left–right difference is in the ${weakest.label.toLowerCase()} ` +
        `(${weakest.score}), while ${strongest.label.toLowerCase()} is more even (${strongest.score}).`
    } else {
      regionClause =
        ` Regional balance is fairly even across ${regions.map((r) => r.label.toLowerCase()).join(', ')} ` +
        `(lowest ${weakest.label.toLowerCase()} at ${weakest.score}).`
    }
  }
  return (
    `Your facial symmetry score is ${score} (${label.toLowerCase()}).` +
    regionClause +
    ' Natural faces almost always show some left–right variation.'
  )
}

function facialThirdsFromLandmarks(landmarks) {
  if (!landmarks?.length) return null
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const subnasale = lm(landmarks, 2)
  const browY = (lm(landmarks, 105).y + lm(landmarks, 334).y) / 2
  const faceH = chin.y - forehead.y
  if (!(faceH > 0.05)) return null
  let upper = (browY - forehead.y) / faceH
  let middle = (subnasale.y - browY) / faceH
  let lower = (chin.y - subnasale.y) / faceH
  const sum = upper + middle + lower
  if (sum > 0.01) {
    upper /= sum
    middle /= sum
    lower /= sum
  }
  return { upper, middle, lower }
}

function thirdsExplanation(upper, middle, lower) {
  if (upper < 0.28 && lower > 0.36) {
    return (
      `Your shorter forehead with a taller midface and longer mouth-to-chin area ` +
      `(upper ${upper.toFixed(2)}, middle ${middle.toFixed(2)}, lower ${lower.toFixed(2)}) ` +
      `shifts visual weight downward compared with evenly split thirds.`
    )
  }
  if (upper > 0.36 && lower < 0.3) {
    return (
      `Your taller forehead with a shorter lower third ` +
      `(upper ${upper.toFixed(2)}, middle ${middle.toFixed(2)}, lower ${lower.toFixed(2)}) ` +
      `shifts visual weight upward compared with evenly split thirds.`
    )
  }
  if (Math.abs(upper - middle) < 0.04 && Math.abs(middle - lower) < 0.04) {
    return (
      `Your facial thirds are closely balanced ` +
      `(upper ${upper.toFixed(2)}, middle ${middle.toFixed(2)}, lower ${lower.toFixed(2)}), ` +
      `so visual weight is distributed evenly from forehead through chin.`
    )
  }
  const focus = upper >= middle && upper >= lower ? 'upper' : middle >= lower ? 'middle' : 'lower'
  return (
    `Your facial thirds measure upper ${upper.toFixed(2)}, middle ${middle.toFixed(2)}, and lower ${lower.toFixed(2)}, ` +
    `so visual weight leans toward the ${focus} third compared with evenly split references.`
  )
}

function proportionsFromLandmarks(landmarks, metrics) {
  // Always measure thirds from the same landmarks as the proportion overlay
  // (10 → brow 105/334 → subnasale 2 → chin 152). Ignore legacy mouth-based metrics.
  const fromLm = facialThirdsFromLandmarks(landmarks)
  if (!fromLm) {
    return {
      score: null,
      upperThird: null,
      middleThird: null,
      lowerThird: null,
      label: null,
      explanation: 'Facial thirds could not be measured from landmarks.',
    }
  }

  const { upper, middle, lower } = fromLm
  const idealDev = Math.abs(upper - 0.33) + Math.abs(middle - 0.34) + Math.abs(lower - 0.33)
  const finalScore = Math.min(99, Math.max(40, Math.round(100 - idealDev * 120)))

  return {
    score: finalScore,
    upperThird: upper.toFixed(2),
    middleThird: middle.toFixed(2),
    lowerThird: lower.toFixed(2),
    label: finalScore >= 80 ? 'Well balanced' : finalScore >= 70 ? 'Good balance' : 'Slight variation',
    explanation: thirdsExplanation(upper, middle, lower),
  }
}

/**
 * Compute Qoves-style per-feature proportion ratios from landmarks.
 * Returns 4 tab ratios: naso-aural (ear), orbito-nasal (nose),
 * naso-oral (mouth), orbital (eye).
 */
function proportionRatios(landmarks) {
  // Landmark helpers
  const earTopL = lm(landmarks, 234)
  const earBotL = lm(landmarks, 127)
  const noseTip = lm(landmarks, 1)
  const [noseBaseL, noseBaseR] = noseAlae(landmarks)
  const eyeInnerL = lm(landmarks, 133)
  const eyeInnerR = lm(landmarks, 362)
  const eyeOuterL = lm(landmarks, 33)
  const eyeOuterR = lm(landmarks, 263)
  const [mouthL, mouthR] = mouthCheilions(landmarks)

  // Compute measurements
  const earHeight = Math.abs(earBotL.y - earTopL.y)
  const subnasale = lm(landmarks, 2)
  const noseHeight = Math.abs(noseTip.y - subnasale.y)
  const noseWidth = Math.abs(noseBaseR.x - noseBaseL.x)
  const eyeWidthL = Math.abs(eyeOuterL.x - eyeInnerL.x)
  const eyeWidthR = Math.abs(eyeOuterR.x - eyeInnerR.x)
  const eyeWidth = (eyeWidthL + eyeWidthR) / 2
  const innerEyeSpacing = Math.abs(eyeInnerR.x - eyeInnerL.x)
  const mouthWidth = Math.abs(mouthR.x - mouthL.x)

  // 1. Naso-Aural Ratio — ear height : nose height (ideal ≈ 1.00)
  const nasoAuralYour = noseHeight > 0.001 ? earHeight / noseHeight : 1
  const nasoAuralIdeal = 1.0
  const nasoAuralYourLabel = nasoAuralYour > 1.05 ? 'Ear > Nose' : nasoAuralYour < 0.95 ? 'Ear < Nose' : 'Ear ≈ Nose'

  // 2. Orbito-Nasal Ratio — nose width : inner eye spacing (ideal ≈ 1.00)
  const orbitoNasalYour = innerEyeSpacing > 0.001 ? noseWidth / innerEyeSpacing : 1
  const orbitoNasalIdeal = 1.0
  const orbitoNasalYourLabel = orbitoNasalYour > 1.05 ? 'Nose > Eye' : orbitoNasalYour < 0.95 ? 'Nose < Eye' : 'Nose ≈ Eye'

  // 3. Naso-Oral Proportion — mouth width : nose width (ideal ≈ 1.50–1.60)
  const nasoOralYour = noseWidth > 0.001 ? mouthWidth / noseWidth : 1
  const nasoOralIdeal = 1.6
  // Label compares mouth vs nose (not vs the 1.6 ideal)
  const nasoOralYourLabel = nasoOralYour > 1.05 ? 'Mouth > Nose' : nasoOralYour < 0.95 ? 'Mouth < Nose' : 'Mouth ≈ Nose'

  // 4. Orbital Proportion — inter-eye spacing vs eye width (ideal ≈ 1.00)
  const orbitalYour = eyeWidth > 0.001 ? innerEyeSpacing / eyeWidth : 1
  const orbitalIdeal = 1.0
  const orbitalYourLabel = orbitalYour > 1.05 ? 'Spacing > Eye' : orbitalYour < 0.95 ? 'Spacing < Eye' : 'Spacing = Eye'

  return {
    nasoAural: {
      ratioLabel: 'NASO-AURAL RATIO',
      yourValue: nasoAuralYour,
      idealValue: nasoAuralIdeal,
      yourLabel: nasoAuralYourLabel,
      idealLabel: 'Ear = Nose',
      expectation: 'Generally, the ears are expected to be roughly the same height as the nose.',
      explanation: 'Upload a side-profile photo for an accurate naso-aural measurement. Front-facing estimates are not clinically meaningful for this ratio.',
      dataSource: 'front_estimate',
      requiresProfile: true,
    },
    orbitoNasal: {
      ratioLabel: 'ORBITO-NASAL RATIO',
      yourValue: orbitoNasalYour,
      idealValue: orbitoNasalIdeal,
      yourLabel: orbitoNasalYourLabel,
      idealLabel: 'Nose = Eye',
      expectation: 'Generally, the outer edges of the nostrils are expected to align with the inner corners of the eyes.',
      explanation:
        `Your orbito-nasal ratio is ${orbitoNasalYour.toFixed(2)} (reference ≈ ${orbitoNasalIdeal.toFixed(2)}). ` +
        (orbitoNasalYour > 1.1
          ? 'The nasal base is wider than inner-eye spacing, so the central column reads broader.'
          : orbitoNasalYour < 0.9
            ? 'The nasal base is narrower than inner-eye spacing, so the central column reads more refined.'
            : 'Nose width aligns closely with inner-eye spacing.'),
    },
    nasoOral: {
      ratioLabel: 'NASO-ORAL PROPORTION',
      yourValue: nasoOralYour,
      idealValue: nasoOralIdeal,
      yourLabel: nasoOralYourLabel,
      idealLabel: 'Mouth > Nose',
      expectation: 'Generally, the width of the mouth is expected to be about 50–60% wider than the width of the nasal base.',
      explanation:
        `Your mouth-to-nose ratio is ${nasoOralYour.toFixed(2)} (reference ≈ ${nasoOralIdeal.toFixed(2)}). ` +
        (nasoOralYour < 1.3
          ? 'Mouth width is relatively contained versus the nasal base, so emphasis stays on the nose.'
          : nasoOralYour > 1.8
            ? 'Mouth width is relatively wide versus the nasal base, so the oral zone reads more prominent.'
            : 'Mouth width sits near the expected range relative to the nasal base.'),
    },
    orbital: {
      ratioLabel: 'ORBITAL PROPORTION',
      yourValue: orbitalYour,
      idealValue: orbitalIdeal,
      yourLabel: orbitalYourLabel,
      idealLabel: 'Spacing = Eye',
      expectation: 'Generally, the space between the eyes is expected to be equal to the width of one eye.',
      explanation:
        `Your inter-eye spacing to eye-width ratio is ${orbitalYour.toFixed(2)} (reference ≈ ${orbitalIdeal.toFixed(2)}), ` +
        `so the eyes read as ${
          orbitalYour >= 0.95 && orbitalYour <= 1.05
            ? 'evenly spaced'
            : orbitalYour < 0.95
              ? 'somewhat close-set'
              : 'somewhat wide-set'
        }.`,
    },
  }
}

async function buildNasoAuralVisual(photos, faceCrop, nasoAuralOverlay) {
  const profileSrc = photos?.rightProfile
  if (!profileSrc) {
    return { imageSrc: faceCrop, overlay: nasoAuralOverlay, photoSource: 'front' }
  }

  try {
    const mpProfile = await analyzeWithMediaPipe(profileSrc)
    const fullBox = { x: 0, y: 0, w: 1, h: 1 }
    const profileOverlays = proportionRatioOverlays(mpProfile.landmarks, fullBox)
    return {
      imageSrc: profileSrc,
      overlay: profileOverlays.nasoAural,
      photoSource: 'rightProfile',
    }
  } catch {
    return { imageSrc: faceCrop, overlay: nasoAuralOverlay, photoSource: 'front' }
  }
}

function distLandmarks(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function angleBetween(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const magAB = Math.hypot(ab.x, ab.y) || 0.001
  const magCB = Math.hypot(cb.x, cb.y) || 0.001
  return Math.acos(Math.max(-1, Math.min(1, dot / (magAB * magCB)))) * (180 / Math.PI)
}

function classifyBrowColor(rAvg, gAvg, bAvg) {
  const brightness = (rAvg + gAvg + bAvg) / 3
  const warmth = rAvg - bAvg
  if (brightness < 50) return 'Black'
  if (brightness < 80) return warmth > 15 ? 'Dark brown' : 'Dark brown'
  if (brightness < 110) return warmth > 20 ? 'Medium brown' : 'Brown'
  if (brightness < 140) return warmth > 15 ? 'Light brown' : 'Ash brown'
  return 'Light blonde'
}

function classifyBrowDensity(darkPixelRatio) {
  if (darkPixelRatio > 0.7) return 'Thick'
  if (darkPixelRatio > 0.5) return 'Moderate'
  if (darkPixelRatio > 0.3) return 'Sparse'
  return 'Very sparse'
}

function classifyUnibrow(glabellaDarkRatio) {
  if (glabellaDarkRatio > 0.45) return 'Noticeable'
  if (glabellaDarkRatio > 0.25) return 'Mild'
  return 'None'
}

function classifyBrowThickness(thicknessRatio) {
  if (thicknessRatio > 0.08) return 'Thick'
  if (thicknessRatio > 0.05) return 'Medium'
  return 'Thin'
}

function classifyInnerAngle(angle) {
  if (angle < 35) return 'Converging'
  if (angle < 50) return 'Parallel'
  return 'Diverging'
}

function classifyTailAngle(angle) {
  if (angle > 140) return 'Gentle taper'
  if (angle > 120) return 'Moderate taper'
  return 'Sharp taper'
}

function symmetryDeviationData(landmarks) {
  // Corresponding landmark pairs (right, left) along each brow
  const pairs = [
    [70, 300],    // inner start
    [63, 293],    // inner-mid
    [105, 334],   // peak
    [66, 296],    // arch
    [107, 336],   // outer-arch
    [55, 285],    // mid-tail
    [65, 295],    // outer tail
  ]
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = chin.y - forehead.y || 0.3

  return pairs.map(([rIdx, lIdx]) => {
    const rPt = lm(landmarks, rIdx)
    const lPt = lm(landmarks, lIdx)
    const yDiff = ((rPt.y - lPt.y) / faceH) * 100 // percentage of face height
    return { rIdx, lIdx, yDiff: parseFloat(yDiff.toFixed(2)) }
  })
}

function eyebrowMetrics(landmarks) {
  const lb = lm(landmarks, 105)   // right brow peak
  const rb = lm(landmarks, 334)   // left brow peak
  const le = lm(landmarks, 159)   // left eye top
  const re = lm(landmarks, 386)   // right eye top
  const forehead = lm(landmarks, 10)
  const chin = lm(landmarks, 152)
  const faceH = chin.y - forehead.y || 0.3
  const faceW = Math.hypot(
    lm(landmarks, 234).x - lm(landmarks, 454).x,
    lm(landmarks, 234).y - lm(landmarks, 454).y,
  ) || 0.3

  // ── Position ──
  const browEyeGap = ((le.y - lb.y) + (re.y - rb.y)) / 2 / faceH
  const position = browEyeGap < 0.1 ? 'High set' : browEyeGap < 0.16 ? 'Mid set' : 'Low set'

  // ── Tilt ──
  const rInner = lm(landmarks, 70)
  const lInner = lm(landmarks, 300)
  const tilt = ((lb.y - rInner.y) + (rb.y - lInner.y)) / 2
  const tiltLabel = tilt < -0.008 ? 'Upturned' : tilt > 0.008 ? 'Downturned' : 'Neutral'

  // ── Shape & Peak ──
  const rArch = lm(landmarks, 66)
  const lArch = lm(landmarks, 296)
  const arch = ((rArch.y - lb.y) + (lArch.y - rb.y)) / 2
  const shape = arch < -0.012 ? 'Arched' : arch > 0.005 ? 'Straight' : 'Soft arch'
  const peakMm = ((Math.abs(arch) / faceH) * 120 + 18).toFixed(2)

  // ── Brow Thickness (vertical span of brow landmarks) ──
  const rTop = lm(landmarks, 107)  // right brow upper edge near peak
  const rBot = lm(landmarks, 52)   // right brow lower edge near peak
  const lTop = lm(landmarks, 336)  // left brow upper edge near peak
  const lBot = lm(landmarks, 282)  // left brow lower edge near peak
  const rThickness = distLandmarks(rTop, rBot) / faceH
  const lThickness = distLandmarks(lTop, lBot) / faceH
  const avgThickness = (rThickness + lThickness) / 2
  const thicknessLabel = classifyBrowThickness(avgThickness)

  // ── Inner Brow Angle (angle at the inner start of brow) ──
  const rBrowMid = lm(landmarks, 63)
  const lBrowMid = lm(landmarks, 293)
  const rInnerAngle = angleBetween(rBrowMid, rInner, lm(landmarks, 9))
  const lInnerAngle = angleBetween(lBrowMid, lInner, lm(landmarks, 9))
  const avgInnerAngle = (rInnerAngle + lInnerAngle) / 2
  const innerAngleLabel = classifyInnerAngle(avgInnerAngle)

  // ── Brow Tail Angle (angle at the outer tail) ──
  const rTail = lm(landmarks, 46)   // right brow tail end
  const lTail = lm(landmarks, 276)  // left brow tail end
  const rTailAngle = angleBetween(lb, rTail, lm(landmarks, 124))
  const lTailAngle = angleBetween(rb, lTail, lm(landmarks, 353))
  const avgTailAngle = (rTailAngle + lTailAngle) / 2
  const tailAngleLabel = classifyTailAngle(avgTailAngle)

  // ── Tail Length (peak to tail / face width) ──
  const rTailLen = distLandmarks(lb, rTail) / faceW
  const lTailLen = distLandmarks(rb, lTail) / faceW
  const avgTailLen = ((rTailLen + lTailLen) / 2 * 100).toFixed(1)
  const tailLengthLabel = parseFloat(avgTailLen) > 18 ? 'Long' : parseFloat(avgTailLen) > 13 ? 'Moderate' : 'Short'

  // ── Inner Brow Set (distance between inner brow points / interpupillary distance) ──
  const ipd = distLandmarks(lm(landmarks, 33), lm(landmarks, 263)) || 0.001
  const innerSetDist = distLandmarks(rInner, lInner) / ipd
  const innerSetLabel = classifyInnerAngle(innerSetDist * 45) // remap to angle-like scale

  // ── Symmetry deviation data for SVG chart ──
  const symmetryData = symmetryDeviationData(landmarks)
  const maxDeviation = Math.max(...symmetryData.map(d => Math.abs(d.yDiff)))
  const avgDeviation = symmetryData.reduce((sum, d) => sum + Math.abs(d.yDiff), 0) / symmetryData.length
  const symmetryLabel = avgDeviation < 0.8 ? 'Highly symmetric' : avgDeviation < 1.5 ? 'Mildly asymmetric' : 'Noticeably asymmetric'
  const symmetryScore = Math.max(50, Math.round(100 - avgDeviation * 20))

  return {
    position,
    tilt: tiltLabel,
    virility: shape === 'Straight' ? 'Moderate' : 'Soft',
    shape,
    peakHeight: peakMm,
    peakMin: '18.23',
    peakMax: '23.87',
    inRange: parseFloat(peakMm) >= 18.23 && parseFloat(peakMm) <= 23.87,
    // New detailed metrics
    thickness: thicknessLabel,
    thicknessValue: avgThickness.toFixed(3),
    innerBrowAngle: avgInnerAngle.toFixed(1),
    innerBrowAngleLabel: innerAngleLabel,
    tailAngle: avgTailAngle.toFixed(1),
    tailAngleLabel: tailAngleLabel,
    tailLength: avgTailLen,
    tailLengthLabel,
    innerSet: innerSetDist.toFixed(2),
    innerSetLabel,
    symmetryScore,
    symmetryLabel,
    symmetryMaxDev: maxDeviation.toFixed(2),
    symmetryData,
    explanation: `Your brows sit in a ${position.toLowerCase()} position with a ${shape.toLowerCase()} form and ${tiltLabel.toLowerCase()} tilt. The ${thicknessLabel.toLowerCase()} brow structure with a ${tailLengthLabel.toLowerCase()} tail length contributes to a balanced periorbital frame. Inner brows are ${innerAngleLabel.toLowerCase()} with ${tailAngleLabel.toLowerCase()} taper.`,
  }
}

/* ── Cheek Analysis ── */
const CHEEK_LEFT = [116, 117, 118, 119, 120, 121, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 213, 214, 215]
const CHEEK_RIGHT = [345, 346, 347, 348, 349, 350, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 433, 434, 435]
const APPLE_LEFT = [116, 117, 118, 119, 120, 121, 126, 127, 128]
const APPLE_RIGHT = [345, 346, 347, 348, 349, 350, 355, 356, 357]

function cheekMetrics(landmarks) {
  const cheekL = lm(landmarks, 127)
  const cheekR = lm(landmarks, 356)
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  const chin = lm(landmarks, 152)
  const forehead = lm(landmarks, 10)
  const nose = lm(landmarks, 2)
  const ipd = distLandmarks(lm(landmarks, 33), lm(landmarks, 263)) || 0.001
  const faceH = chin.y - forehead.y || 0.3
  const faceW = distLandmarks(jawL, jawR) || 0.3

  // ── Cheek Width (cheek-to-cheek / face width) ──
  const cheekWidth = distLandmarks(cheekL, cheekR)
  const cheekWidthPct = ((cheekWidth / faceW) * 100).toFixed(1)
  const cheekWidthClass = parseFloat(cheekWidthPct) > 85 ? 'Wide' : parseFloat(cheekWidthPct) > 72 ? 'Moderate' : 'Narrow'

  // ── Cheekbone Height (distance from cheekbone to nose tip / face height) ──
  const cheekboneHeightL = (nose.y - cheekL.y) / faceH
  const cheekboneHeightR = (nose.y - cheekR.y) / faceH
  const avgCheekboneHeight = ((cheekboneHeightL + cheekboneHeightR) / 2 * 100).toFixed(1)
  const cheekboneHeightClass = parseFloat(avgCheekboneHeight) > 12 ? 'High' : parseFloat(avgCheekboneHeight) > 6 ? 'Medium' : 'Low'

  // ── Cheekbone Prominence (z-depth, estimated from landmark z values) ──
  const zL = cheekL.z || 0
  const zR = cheekR.z || 0
  const avgZ = (zL + zR) / 2
  const prominence = avgZ > 0.02 ? 'Prominent' : avgZ > -0.01 ? 'Moderate' : 'Flat'

  // ── Apple Volume (angular fullness of cheek apple region) ──
  const appleL = APPLE_LEFT.map(i => lm(landmarks, i))
  const appleR = APPLE_RIGHT.map(i => lm(landmarks, i))
  // Measure convexity: average distance from center to outer contour
  const appleCenterL = { x: appleL.reduce((s, p) => s + p.x, 0) / appleL.length, y: appleL.reduce((s, p) => s + p.y, 0) / appleL.length }
  const appleCenterR = { x: appleR.reduce((s, p) => s + p.x, 0) / appleR.length, y: appleR.reduce((s, p) => s + p.y, 0) / appleR.length }
  const avgAppleSize = (distLandmarks(appleCenterL, { x: appleL[0].x, y: appleL[0].y }) + distLandmarks(appleCenterR, { x: appleR[0].x, y: appleR[0].y })) / 2
  const appleVolume = avgAppleSize / faceW > 0.08 ? 'Full' : avgAppleSize / faceW > 0.05 ? 'Moderate' : 'Flat'

  // ── Midface Length (nose tip to cheekbone / face height) ──
  const midfaceLength = ((nose.y - ((cheekL.y + cheekR.y) / 2)) / faceH * 100).toFixed(1)
  const midfaceClass = parseFloat(midfaceLength) > 25 ? 'Long' : parseFloat(midfaceLength) > 18 ? 'Balanced' : 'Short'

  // ── Cheek Symmetry ──
  const cheekHeightDiff = Math.abs(cheekL.y - cheekR.y) / faceH * 100
  const cheekWidthDiff = Math.abs(distLandmarks(cheekL, chin) - distLandmarks(cheekR, chin)) / faceW * 100
  const asymmetry = ((cheekHeightDiff + cheekWidthDiff) / 2).toFixed(2)
  const symmetryScore = Math.max(55, Math.round(100 - parseFloat(asymmetry) * 15))
  const symmetryLabel = parseFloat(asymmetry) < 0.5 ? 'Highly symmetric' : parseFloat(asymmetry) < 1.5 ? 'Mildly asymmetric' : 'Noticeably asymmetric'

  // ── Jaw-to-Cheek Transition ──
  const jawCheekAngleL = angleBetween(jawL, cheekL, lm(landmarks, 116))
  const jawCheekAngleR = angleBetween(jawR, cheekR, lm(landmarks, 345))
  const avgJawCheek = ((jawCheekAngleL + jawCheekAngleR) / 2).toFixed(1)
  const jawCheekClass = parseFloat(avgJawCheek) > 140 ? 'Smooth' : parseFloat(avgJawCheek) > 110 ? 'Defined' : 'Angular'

  // ── Score ──
  let score = 72
  if (cheekboneHeightClass === 'High') score += 8
  else if (cheekboneHeightClass === 'Medium') score += 4
  if (prominence === 'Prominent') score += 5
  if (appleVolume === 'Full') score += 5
  if (symmetryScore > 85) score += 5
  if (cheekWidthClass === 'Moderate') score += 3
  if (midfaceClass === 'Balanced') score += 4
  if (cheekWidthClass === 'Narrow') score -= 3
  if (symmetryScore < 70) score -= 5
  score = Math.min(99, Math.max(50, score))

  return {
    score,
    scoreLabel: score >= 85 ? 'Strong' : score >= 70 ? 'Defined' : 'Soft',
    cheekWidth: cheekWidthPct,
    cheekWidthClass,
    cheekboneHeight: avgCheekboneHeight,
    cheekboneHeightClass,
    prominence,
    appleVolume,
    midfaceLength,
    midfaceClass,
    asymmetry,
    symmetryScore,
    symmetryLabel,
    jawCheekTransition: jawCheekClass,
    jawCheekAngle: avgJawCheek,
    explanation: `Your cheeks display ${cheekWidthClass.toLowerCase()} width with ${cheekboneHeightClass.toLowerCase()} cheekbone placement. The cheekbones appear ${prominence.toLowerCase()} with ${appleVolume.toLowerCase()} apple volume. Midface is ${midfaceClass.toLowerCase()} (${midfaceLength}% of face height) with a ${jawCheekClass.toLowerCase()} jaw-to-cheek transition. Cheek symmetry is ${symmetryLabel.toLowerCase()} (asymmetry: ${asymmetry}%).`,
  }
}

async function cheekPixelAnalysis(landmarks, imageSrc) {
  const img = await loadImage(imageSrc)

  function samplePixels(box) {
    const sx = Math.max(0, Math.round(box.x * img.width))
    const sy = Math.max(0, Math.round(box.y * img.height))
    const sw = Math.max(1, Math.round(box.w * img.width))
    const sh = Math.max(1, Math.round(box.h * img.height))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    return ctx.getImageData(0, 0, sw, sh)
  }

  function analyzeRegion(data) {
    let rSum = 0, gSum = 0, bSum = 0, brightSum = 0, n = 0
    let darkPixels = 0
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2]
      rSum += r; gSum += g; bSum += b
      brightSum += 0.299 * r + 0.587 * g + 0.114 * b
      if (0.299 * r + 0.587 * g + 0.114 * b < 100) darkPixels++
      n++
    }
    return {
      rAvg: rSum / n, gAvg: gSum / n, bAvg: bSum / n,
      brightness: brightSum / n,
      darkRatio: darkPixels / n,
    }
  }

  // Sample cheek pixel regions
  const faceBox = bboxFullFace(landmarks, 0.02)
  const lCheekBox = {
    x: faceBox.x + faceBox.w * 0.05,
    y: faceBox.y + faceBox.h * 0.35,
    w: faceBox.w * 0.3,
    h: faceBox.h * 0.25,
  }
  const rCheekBox = {
    x: faceBox.x + faceBox.w * 0.65,
    y: faceBox.y + faceBox.h * 0.35,
    w: faceBox.w * 0.3,
    h: faceBox.h * 0.25,
  }
  // Apple region (higher, more central)
  const lAppleBox = {
    x: faceBox.x + faceBox.w * 0.1,
    y: faceBox.y + faceBox.h * 0.32,
    w: faceBox.w * 0.22,
    h: faceBox.h * 0.15,
  }
  const rAppleBox = {
    x: faceBox.x + faceBox.w * 0.68,
    y: faceBox.y + faceBox.h * 0.32,
    w: faceBox.w * 0.22,
    h: faceBox.h * 0.15,
  }

  let lCheekData, rCheekData, lAppleData, rAppleData
  try {
    lCheekData = analyzeRegion(samplePixels(lCheekBox))
    rCheekData = analyzeRegion(samplePixels(rCheekBox))
    lAppleData = analyzeRegion(samplePixels(lAppleBox))
    rAppleData = analyzeRegion(samplePixels(rAppleBox))
  } catch {
    return { blushLevel: 'None', skinTexture: 'Smooth', contourDef: 'Moderate' }
  }

  // ── Blush (redness in apple region) ──
  const avgAppleRedness = ((lAppleData.rAvg - (lAppleData.gAvg + lAppleData.bAvg) / 2) + (rAppleData.rAvg - (rAppleData.gAvg + rAppleData.bAvg) / 2)) / 2
  const blushLevel = avgAppleRedness > 15 ? 'Natural flush' : avgAppleRedness > 8 ? 'Subtle warmth' : 'None'

  // ── Skin texture (brightness variance) ──
  const avgCheekBrightness = (lCheekData.brightness + rCheekData.brightness) / 2
  const cheekTexture = avgCheekBrightness > 150 ? 'Smooth & luminous' : avgCheekBrightness > 110 ? 'Smooth' : avgCheekBrightness > 80 ? 'Textured' : 'Rough'

  // ── Contour definition (dark pixel ratio — shadow under cheekbone) ──
  const avgDarkRatio = (lCheekData.darkRatio + rCheekData.darkRatio) / 2
  const contourDef = avgDarkRatio > 0.25 ? 'Well-defined' : avgDarkRatio > 0.12 ? 'Moderate' : 'Soft'

  // ── Evenness between left and right ──
  const cheekEvenness = Math.abs(lCheekData.brightness - rCheekData.brightness)
  const evennessLabel = cheekEvenness < 8 ? 'Even' : cheekEvenness < 20 ? 'Slightly uneven' : 'Uneven'

  return {
    blushLevel,
    blushIntensity: avgAppleRedness.toFixed(1),
    skinTexture: cheekTexture,
    contourDef,
    cheekBrightness: avgCheekBrightness.toFixed(0),
    leftCheekBrightness: lCheekData.brightness.toFixed(0),
    rightCheekBrightness: rCheekData.brightness.toFixed(0),
    evennessLabel,
    evennessDiff: cheekEvenness.toFixed(1),
    appleBrightness: ((lAppleData.brightness + rAppleData.brightness) / 2).toFixed(0),
    appleRedness: avgAppleRedness.toFixed(1),
  }
}

async function browPixelAnalysis(landmarks, imageSrc) {
  const img = await loadImage(imageSrc)

  function samplePixels(box) {
    const sx = Math.max(0, Math.round(box.x * img.width))
    const sy = Math.max(0, Math.round(box.y * img.height))
    const sw = Math.max(1, Math.round(box.w * img.width))
    const sh = Math.max(1, Math.round(box.h * img.height))
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    return ctx.getImageData(0, 0, sw, sh)
  }

  // Brow region boxes
  const rBrowBox = bboxFromIndices(landmarks, RIGHT_BROW, 0.01)
  const lBrowBox = bboxFromIndices(landmarks, LEFT_BROW, 0.01)
  const browsBox = bboxBrowsRegion(landmarks)

  // Glabella region (between brows) for unibrow detection
  const rInnerPt = lm(landmarks, 70)
  const lInnerPt = lm(landmarks, 300)
  const glabellaCx = (rInnerPt.x + lInnerPt.x) / 2
  const glabellaCy = (rInnerPt.y + lInnerPt.y) / 2
  const browSpan = Math.abs(lInnerPt.x - rInnerPt.x)
  const glabellaBox = {
    x: Math.max(0, glabellaCx - browSpan * 0.25),
    y: Math.max(0, glabellaCy - browSpan * 0.2),
    w: browSpan * 0.5,
    h: browSpan * 0.4,
  }

  let rData, lData, glData
  try {
    rData = samplePixels(rBrowBox)
    lData = samplePixels(lBrowBox)
    glData = samplePixels(glabellaBox)
  } catch {
    return { color: 'Dark', colorHex: '#3a2a1a', density: 'Moderate', unibrow: 'None' }
  }

  // ── Brow Color (average RGB of both brow regions) ──
  let rSum = 0, gSum = 0, bSum = 0, count = 0
  for (let i = 0; i < rData.data.length; i += 4) {
    rSum += rData.data[i]; gSum += rData.data[i + 1]; bSum += rData.data[i + 2]; count++
  }
  for (let i = 0; i < lData.data.length; i += 4) {
    rSum += lData.data[i]; gSum += lData.data[i + 1]; bSum += lData.data[i + 2]; count++
  }
  const rAvg = rSum / count
  const gAvg = gSum / count
  const bAvg = bSum / count
  const colorName = classifyBrowColor(rAvg, gAvg, bAvg)
  const colorHex = `rgb(${Math.round(rAvg)},${Math.round(gAvg)},${Math.round(bAvg)})`

  // ── Brow Density (ratio of dark pixels in brow region) ──
  let darkPixels = 0
  let totalPixels = 0
  for (let i = 0; i < rData.data.length; i += 4) {
    const lum = 0.299 * rData.data[i] + 0.587 * rData.data[i + 1] + 0.114 * rData.data[i + 2]
    if (lum < 120) darkPixels++
    totalPixels++
  }
  for (let i = 0; i < lData.data.length; i += 4) {
    const lum = 0.299 * lData.data[i] + 0.587 * lData.data[i + 1] + 0.114 * lData.data[i + 2]
    if (lum < 120) darkPixels++
    totalPixels++
  }
  const darkRatio = darkPixels / (totalPixels || 1)
  const densityLabel = classifyBrowDensity(darkRatio)
  const densityPct = Math.round(darkRatio * 100)

  // ── Unibrow detection (dark pixels in glabella region) ──
  let glDark = 0
  let glTotal = 0
  for (let i = 0; i < glData.data.length; i += 4) {
    const lum = 0.299 * glData.data[i] + 0.587 * glData.data[i + 1] + 0.114 * glData.data[i + 2]
    if (lum < 130) glDark++
    glTotal++
  }
  const glDarkRatio = glDark / (glTotal || 1)
  const unibrowLabel = classifyUnibrow(glDarkRatio)

  // ── Edge sharpness (gradient magnitude in brow region) ──
  const allData = samplePixels(browsBox)
  const pw = allData.width
  const ph = allData.height
  let edgeSum = 0
  let edgeCount = 0
  for (let y = 1; y < ph - 1; y++) {
    for (let x = 1; x < pw - 1; x++) {
      const idx = (y * pw + x) * 4
      const idxR = (y * pw + (x + 1)) * 4
      const idxB = ((y + 1) * pw + x) * 4
      const gx = allData.data[idxR] - allData.data[idx]
      const gy = allData.data[idxB] - allData.data[idx]
      edgeSum += Math.sqrt(gx * gx + gy * gy)
      edgeCount++
    }
  }
  const avgEdge = edgeSum / (edgeCount || 1)
  const edgeSharpness = avgEdge > 30 ? 'Defined' : avgEdge > 18 ? 'Moderate' : 'Soft'

  return {
    color: colorName,
    colorHex,
    density: densityLabel,
    densityPct,
    unibrow: unibrowLabel,
    edgeSharpness,
  }
}

/**
 * Hair pixel analysis from top-head photo.
 * Samples the crown/top-of-head region to estimate real hair density, coverage, and color.
 */
async function hairPixelAnalysis(landmarks, topHeadSrc) {
  if (!topHeadSrc) {
    return {
      score: 78, scoreLabel: 'Natural', hairline: 'Average',
      densityEstimate: 'Moderate', coverageEstimate: 'Good', foreheadExposure: 'Moderate',
      hairColor: 'Dark', hairColorHex: '#2a1a0a', textureType: 'Unknown',
      thinningArea: 'None detected', crownVisibility: 'N/A',
      explanation: 'Upload a top-of-head photo for real hair density & coverage analysis.',
    }
  }

  try {
    const img = await loadImage(topHeadSrc)
    const cw = img.width
    const ch = img.height

    // Sample the top 40% of the image (crown + hairline region)
    const topRegion = {
      x: 0, y: 0, w: cw, h: Math.round(ch * 0.4),
    }
    // Sample the full image for overall coverage
    const fullRegion = { x: 0, y: 0, w: cw, h: ch }

    function samplePixels(region) {
      const canvas = document.createElement('canvas')
      canvas.width = region.w
      canvas.height = region.h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h)
      return ctx.getImageData(0, 0, region.w, region.h)
    }

    const topData = samplePixels(topRegion)
    const fullData = samplePixels(fullRegion)

    // ── Hair Color (average RGB of dark pixels in top region) ──
    let darkR = 0, darkG = 0, darkB = 0, darkCount = 0
    for (let i = 0; i < topData.data.length; i += 4) {
      const r = topData.data[i], g = topData.data[i + 1], b = topData.data[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      if (lum < 100) { darkR += r; darkG += g; darkB += b; darkCount++ }
    }
    const hairColorHex = darkCount > 10
      ? `rgb(${Math.round(darkR / darkCount)},${Math.round(darkG / darkCount)},${Math.round(darkB / darkCount)})`
      : '#2a1a0a'
    const avgR = darkCount > 10 ? darkR / darkCount : 40
    const avgG = darkCount > 10 ? darkG / darkCount : 25
    const avgB = darkCount > 10 ? darkB / darkCount : 15
    const hairColor = avgR < 60 && avgG < 40 ? 'Black' : avgR < 100 ? 'Dark Brown'
      : avgR < 150 ? 'Medium Brown' : avgR > 180 && avgG > 150 ? 'Blonde' : 'Light Brown'

    // ── Hair Density (ratio of dark pixels in full image = hair coverage) ──
    let hairPixels = 0
    let totalPixels = 0
    for (let i = 0; i < fullData.data.length; i += 4) {
      const r = fullData.data[i], g = fullData.data[i + 1], b = fullData.data[i + 2]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      // Hair is typically dark
      if (lum < 110) hairPixels++
      totalPixels++
    }
    const hairRatio = hairPixels / (totalPixels || 1)
    const densityPct = Math.round(hairRatio * 100)
    const densityEstimate = densityPct > 55 ? 'Thick' : densityPct > 35 ? 'Moderate' : densityPct > 20 ? 'Fine' : 'Thin'

    // ── Hairline detection (scanning from top for first bright row = forehead) ──
    const topW = topData.width
    const topH = topData.height
    let hairlineRow = 0
    for (let y = 0; y < topH; y++) {
      let brightCount = 0
      for (let x = 0; x < topW; x += 3) { // sample every 3rd pixel
        const idx = (y * topW + x) * 4
        const lum = 0.299 * topData.data[idx] + 0.587 * topData.data[idx + 1] + 0.114 * topData.data[idx + 2]
        if (lum > 140) brightCount++
      }
      if (brightCount > topW * 0.15) { hairlineRow = y; break }
    }
    const hairlinePct = Math.round((hairlineRow / topH) * 100)
    const foreheadExposure = hairlinePct > 30 ? 'High' : hairlinePct > 15 ? 'Moderate' : 'Low'
    const hairline = hairlinePct > 25 ? 'Receding' : hairlinePct > 12 ? 'Average' : 'Full'

    // ── Crown visibility (bottom-right and bottom-left quadrants of top region for thinning) ──
    const halfW = Math.floor(topW / 2)
    const halfH = Math.floor(topH / 2)
    let crownDarkL = 0, crownDarkR = 0, crownTotalL = 0, crownTotalR = 0
    for (let y = halfH; y < topH; y++) {
      for (let x = 0; x < topW; x += 2) {
        const idx = (y * topW + x) * 4
        const lum = 0.299 * topData.data[idx] + 0.587 * topData.data[idx + 1] + 0.114 * topData.data[idx + 2]
        if (x < halfW) { crownTotalL++; if (lum < 100) crownDarkL++ }
        else { crownTotalR++; if (lum < 100) crownDarkR++ }
      }
    }
    const crownL = crownDarkL / (crownTotalL || 1)
    const crownR = crownDarkR / (crownTotalR || 1)
    const crownDiff = Math.abs(crownL - crownR)
    const thinningArea = crownDiff > 0.15 ? 'Crown asymmetry detected' : crownL < 0.3 && crownR < 0.3 ? 'Crown thinning' : 'None detected'
    const crownVisibility = crownL < 0.3 && crownR < 0.3 ? 'Visible thinning' : 'Normal coverage'

    // ── Coverage estimate ──
    const coverageEstimate = densityPct > 45 ? 'Full coverage' : densityPct > 25 ? 'Good coverage' : densityPct > 15 ? 'Moderate coverage' : 'Sparse coverage'

    // ── Texture type (based on edge analysis — rough edges suggest curly, smooth suggests straight) ──
    let edgeSum = 0, edgeCount = 0
    for (let y = 1; y < topH - 1; y += 2) {
      for (let x = 1; x < topW - 1; x += 2) {
        const idx = (y * topW + x) * 4
        const idxR = (y * topW + (x + 1)) * 4
        const idxB = ((y + 1) * topW + x) * 4
        const gx = topData.data[idxR] - topData.data[idx]
        const gy = topData.data[idxB] - topData.data[idx]
        edgeSum += Math.sqrt(gx * gx + gy * gy)
        edgeCount++
      }
    }
    const avgEdge = edgeSum / (edgeCount || 1)
    const textureType = avgEdge > 35 ? 'Curly/Wavy' : avgEdge > 20 ? 'Wavy' : 'Straight'

    // Score
    let score = 75
    if (densityEstimate === 'Thick') score += 8; else if (densityEstimate === 'Moderate') score += 4; else if (densityEstimate === 'Thin') score -= 5
    if (hairline === 'Full') score += 6; else if (hairline === 'Receding') score -= 4
    if (thinningArea === 'None detected') score += 4; else score -= 3
    if (coverageEstimate.includes('Full') || coverageEstimate.includes('Good')) score += 3
    score = Math.min(99, Math.max(40, score))

    return {
      score,
      scoreLabel: score >= 85 ? 'Healthy' : score >= 70 ? 'Natural' : 'Monitor',
      hairline,
      densityEstimate,
      coverageEstimate,
      foreheadExposure,
      hairColor,
      hairColorHex,
      textureType,
      thinningArea,
      crownVisibility,
      densityPct,
      explanation: `Hair analysis from top-of-head photo: ${densityEstimate.toLowerCase()} hair with ${coverageEstimate.toLowerCase()}. Hairline is ${hairline.toLowerCase()} with ${foreheadExposure.toLowerCase()} forehead exposure. ${thinningArea === 'None detected' ? 'No significant thinning detected at the crown.' : thinningArea + '.'}`,
    }
  } catch {
    return {
      score: 78, scoreLabel: 'Natural', hairline: 'Average',
      densityEstimate: 'Moderate', coverageEstimate: 'Good', foreheadExposure: 'Moderate',
      hairColor: 'Dark', hairColorHex: '#2a1a0a', textureType: 'Unknown',
      thinningArea: 'None detected', crownVisibility: 'N/A',
      explanation: 'Hair analysis from top-of-head photo.',
    }
  }
}

/**
 * Smile pixel analysis from dedicated smile photo.
 * Examines teeth visibility, smile arc, gum exposure, and lip symmetry when smiling.
 */
async function smilePixelAnalysis(landmarks, smileSrc) {
  if (!smileSrc) {
    return {
      teethVisibility: 'N/A', smileArc: 'N/A', gumExposure: 'N/A',
      teethWhiteness: 'N/A', smileWidthPx: 'N/A',
      explanation: 'Upload a smile photo for enhanced teeth & smile analysis.',
    }
  }

  try {
    const img = await loadImage(smileSrc)

    // Use mouth landmarks from the primary face for crop region
    const mouthL = lm(landmarks, 61)
    const mouthR = lm(landmarks, 291)
    const upperLip = lm(landmarks, 13)
    const lowerLip = lm(landmarks, 14)

    // Expand mouth region generously for smile analysis
    const cx = (mouthL.x + mouthR.x) / 2
    const cy = (upperLip.y + lowerLip.y) / 2
    const mouthW = Math.abs(mouthR.x - mouthL.x) * 1.4
    const mouthH = Math.abs(lowerLip.y - upperLip.y) * 2.5

    const sx = Math.max(0, Math.round((cx - mouthW / 2) * img.width))
    const sy = Math.max(0, Math.round((cy - mouthH / 2) * img.height))
    const sw = Math.min(img.width - sx, Math.round(mouthW * img.width))
    const sh = Math.min(img.height - sy, Math.round(mouthH * img.height))

    if (sw < 5 || sh < 5) {
      return { teethVisibility: 'N/A', smileArc: 'N/A', gumExposure: 'N/A', teethWhiteness: 'N/A', smileWidthPx: 'N/A', explanation: 'Could not crop smile region.' }
    }

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    const data = ctx.getImageData(0, 0, sw, sh)

    // ── Teeth visibility: bright (white) pixels between upper and lower lip ──
    const lipMidY = Math.round(sh * 0.35) // upper lip boundary in crop
    const lipBotY = Math.round(sh * 0.65) // lower lip boundary in crop
    let brightPixels = 0
    let totalMouthPixels = 0
    let whitenessR = 0, whitenessG = 0, whitenessB = 0, whitenCount = 0

    for (let y = lipMidY; y < lipBotY; y++) {
      for (let x = Math.round(sw * 0.1); x < Math.round(sw * 0.9); x++) {
        const idx = (y * sw + x) * 4
        const r = data.data[idx], g = data.data[idx + 1], b = data.data[idx + 2]
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        totalMouthPixels++
        // Teeth are bright + low saturation
        const maxC = Math.max(r, g, b)
        const minC = Math.min(r, g, b)
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0
        if (lum > 160 && sat < 0.3) {
          brightPixels++
          whitenessR += r; whitenessG += g; whitenessB += b; whitenCount++
        }
      }
    }
    const teethRatio = brightPixels / (totalMouthPixels || 1)
    const teethVisibility = teethRatio > 0.3 ? 'High' : teethRatio > 0.12 ? 'Moderate' : teethRatio > 0.04 ? 'Low' : 'Minimal'

    // ── Teeth whiteness ──
    const avgWR = whitenCount > 0 ? whitenessR / whitenCount : 200
    const avgWG = whitenCount > 0 ? whitenessG / whitenCount : 200
    const avgWB = whitenCount > 0 ? whitenessB / whitenCount : 200
    const whitenessScore = (avgWR + avgWG + avgWB) / 3
    const teethWhiteness = whitenessScore > 220 ? 'Very White' : whitenessScore > 190 ? 'White' : whitenessScore > 160 ? 'Natural' : 'Yellowish'

    // ── Smile arc (curvature of upper teeth line) ──
    // Sample brightness at top of mouth region at left, center, right
    const arcY = lipMidY + 2
    const leftBright = sampleArcBrightness(data, sw, Math.round(sw * 0.15), arcY, 4)
    const centerBright = sampleArcBrightness(data, sw, Math.round(sw * 0.5), arcY, 4)
    const rightBright = sampleArcBrightness(data, sw, Math.round(sw * 0.85), arcY, 4)
    const smileArc = centerBright > leftBright && centerBright > rightBright ? 'Consonant (ideal U-shape)'
      : centerBright > (leftBright + rightBright) / 2 ? 'Slightly curved'
      : 'Flat'

    // ── Gum exposure (pink pixels above upper teeth line) ──
    const gumY = lipMidY - 3
    let pinkPixels = 0, gumTotal = 0
    if (gumY > 0) {
      for (let x = Math.round(sw * 0.2); x < Math.round(sw * 0.8); x++) {
        const idx = (gumY * sw + x) * 4
        const r = data.data[idx], g = data.data[idx + 1], b = data.data[idx + 2]
        gumTotal++
        if (r > 150 && g < 130 && b < 130 && r > g + 30) pinkPixels++
      }
    }
    const gumRatio = pinkPixels / (gumTotal || 1)
    const gumExposure = gumRatio > 0.2 ? 'Gummy smile' : gumRatio > 0.08 ? 'Slight gum show' : 'Minimal'

    const smileWidthPx = Math.round(Math.abs(mouthR.x - mouthL.x) * img.width)

    return {
      teethVisibility,
      smileArc,
      gumExposure,
      teethWhiteness,
      smileWidthPx,
      explanation: `Smile analysis: ${teethVisibility.toLowerCase()} teeth visibility with ${smileArc.toLowerCase()}. Gum exposure is ${gumExposure.toLowerCase()}. Teeth appear ${teethWhiteness.toLowerCase()}.`,
    }
  } catch {
    return {
      teethVisibility: 'N/A', smileArc: 'N/A', gumExposure: 'N/A',
      teethWhiteness: 'N/A', smileWidthPx: 'N/A',
      explanation: 'Smile photo analysis unavailable.',
    }
  }
}

/** Sample average brightness at a point ± spread in x */
function sampleArcBrightness(data, rowWidth, cx, cy, spread) {
  let sum = 0, count = 0
  for (let x = Math.max(0, cx - spread); x <= Math.min(rowWidth - 1, cx + spread); x++) {
    const idx = (cy * rowWidth + x) * 4
    sum += 0.299 * data.data[idx] + 0.587 * data.data[idx + 1] + 0.114 * data.data[idx + 2]
    count++
  }
  return sum / (count || 1)
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function buildCvReport(landmarks, imageSrc, metrics, photos = {}, answers = {}) {
  const faceBox = bboxFullFace(landmarks, 0.08)
  const symScore = symmetryScore(landmarks, metrics)
  const symLabel = symmetryLabel(symScore)
  const prop = proportionsFromLandmarks(landmarks, metrics)

  const [faceCrop, browsData] = await Promise.all([
    cropNormalized(imageSrc, faceBox),
    analyzeBrowsCrop(landmarks, imageSrc),
  ])

  const symmetryDots = dotsInImage(landmarks, SYMMETRY_DOTS)
  const symmetryMidline = {
    top: pointInImage(landmarks, 10),
    bot: pointInImage(landmarks, 152),
  }
  const symRegions = symmetryRegions(landmarks)
  const proportionLines = proportionLinesInImage(landmarks)
  const ratioOverlays = proportionRatioOverlays(landmarks)
  const ratios = proportionRatios(landmarks)
  Object.keys(ratios).forEach((key) => {
    ratios[key].overlay = ratioOverlays[key]
    ratios[key].imageSrc = faceCrop
  })

  const earVisual = await buildNasoAuralVisual(photos, faceCrop, ratioOverlays.nasoAural)
  ratios.nasoAural.imageSrc = earVisual.imageSrc
  ratios.nasoAural.overlay = earVisual.overlay
  ratios.nasoAural.photoSource = earVisual.photoSource

  const brow = eyebrowMetrics(landmarks)

  // Brow pixel analysis (color, density, unibrow, edge sharpness)
  let browPixels = { color: 'Dark', colorHex: '#3a2a1a', density: 'Moderate', densityPct: 50, unibrow: 'None', edgeSharpness: 'Moderate' }
  try {
    browPixels = await browPixelAnalysis(landmarks, imageSrc)
  } catch { /* graceful fallback */ }

  // Feature crops
  const noseBox = bboxFromIndices(landmarks, NOSE_BRIDGE, 0.035)
  const mouthBox = bboxFromIndices(landmarks, MOUTH, 0.04)
  const jawBox = mergeBboxes(bboxFromIndices(landmarks, JAW_LEFT, 0.02), bboxFromIndices(landmarks, JAW_RIGHT, 0.02), 0.01)
  const chinBox = bboxFromIndices(landmarks, CHIN, 0.03)
  const cheekLBox = bboxFromIndices(landmarks, CHEEK_LEFT, 0.02)
  const cheekRBox = bboxFromIndices(landmarks, CHEEK_RIGHT, 0.02)
  const cheekBox = mergeBboxes(cheekLBox, cheekRBox, 0.015)
  const jawFrontBox = mergeBboxes(mouthBox, jawBox, 0.03)

  const [noseCrop, mouthCrop, jawCrop, cheekCrop, chinCrop] = await Promise.all([
    cropNormalized(imageSrc, noseBox),
    cropNormalized(imageSrc, mouthBox),
    cropNormalized(imageSrc, jawFrontBox),
    cropNormalized(imageSrc, cheekBox),
    cropNormalized(imageSrc, mergeBboxes(mouthBox, chinBox, 0.02)),
  ])

  const nose = noseMetrics(landmarks)
  const lips = lipMetrics(landmarks)
  const jawChin = jawChinMetrics(landmarks)
  const jawData = jawMetrics(landmarks)
  const chinData = chinMetrics(landmarks)
  const smileData = smileMetrics(landmarks)
  const neckData = neckMetrics(landmarks)
  const earData = earMetrics(landmarks)
  const skin = await skinQualityMetrics(landmarks, imageSrc, metrics)

  // Enhanced smile analysis from smile photo
  let smilePixels = { teethVisibility: 'N/A', smileArc: 'N/A', gumExposure: 'N/A', teethWhiteness: 'N/A', smileWidthPx: 'N/A', explanation: '' }
  try {
    smilePixels = await smilePixelAnalysis(landmarks, photos.smile)
  } catch { /* graceful fallback */ }

  // Enhanced hair analysis from top-head photo
  let hairData = {
    score: 78, scoreLabel: 'Natural', hairline: 'Average',
    densityEstimate: 'Moderate', coverageEstimate: 'Good', foreheadExposure: 'Moderate',
    hairColor: 'Dark', hairColorHex: '#2a1a0a', textureType: 'Unknown',
    thinningArea: 'None detected', crownVisibility: 'N/A',
    explanation: 'Hair analysis estimated from facial proportions.',
  }
  try {
    hairData = await hairPixelAnalysis(landmarks, photos.topHead)
  } catch { /* graceful fallback */ }
  let faceImageSize = null
  try {
    const faceImg = await loadImage(imageSrc)
    faceImageSize = { width: faceImg.naturalWidth || faceImg.width, height: faceImg.naturalHeight || faceImg.height }
  } catch { /* optional for aspect-correct distances */ }
  const faceShape = faceShapeFromLandmarks(landmarks, faceImageSize)

  // Cheek analysis
  const cheek = cheekMetrics(landmarks)
  let cheekPixels = { blushLevel: 'None', skinTexture: 'Smooth', contourDef: 'Moderate', evennessLabel: 'Even' }
  try {
    cheekPixels = await cheekPixelAnalysis(landmarks, imageSrc)
  } catch { /* graceful fallback */ }

  // Hair region crop: frontal hairline + forehead + brows (protocol BEFORE)
  const browY = landmarks?.[105] && landmarks?.[334]
    ? Math.max(landmarks[105].y, landmarks[334].y)
    : faceBox.y + faceBox.h * 0.28
  const foreheadBox = {
    x: Math.max(0, faceBox.x - faceBox.w * 0.02),
    y: Math.max(0, faceBox.y - faceBox.h * 0.22),
    w: Math.min(1, faceBox.w * 1.04),
    h: Math.min(1 - Math.max(0, faceBox.y - faceBox.h * 0.22), browY + faceBox.h * 0.06 - Math.max(0, faceBox.y - faceBox.h * 0.22)),
  }
  const [foreheadCrop] = await Promise.all([
    cropNormalized(imageSrc, foreheadBox),
  ])

  // Neck region: lower face (from nostrils) through jaw and neck column
  const noseY = landmarks?.[2]?.y ?? faceBox.y + faceBox.h * 0.55
  const chinY = landmarks?.[152]?.y ?? faceBox.y + faceBox.h * 0.95
  const neckTop = Math.max(0, Math.min(noseY - faceBox.h * 0.04, faceBox.y + faceBox.h * 0.45))
  const lowerSpan = Math.max(chinY - neckTop, faceBox.h * 0.35)
  const neckBox = {
    x: Math.max(0, faceBox.x - faceBox.w * 0.06),
    y: neckTop,
    w: Math.min(1 - Math.max(0, faceBox.x - faceBox.w * 0.06), faceBox.w * 1.12),
    h: Math.min(1 - neckTop, chinY + lowerSpan * 0.7 - neckTop),
  }
  const [neckCrop] = await Promise.all([
    cropNormalized(imageSrc, neckBox),
  ])

  const reportData = {
    faceShape: {
      ...faceShape,
      imageSrc: faceCrop,
    },
    symmetry: {
      score: symScore,
      scoreLabel: symLabel,
      scaleLeft: 'Asymmetric',
      scaleRight: 'Symmetric',
      scaleMarkerPct: symScore,
      rangeHighlight: { left: 70, width: 28 },
      explanation: symmetryExplanation(symScore, symLabel, symRegions),
      imageSrc: faceCrop,
      symmetryDots,
      symmetryMidline,
      regions: symRegions,
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
      explanation: prop.explanation,
      imageSrc: faceCrop,
      proportionLines,
      ratios,
      faceBox,
      overlaySpace: 'image',
    },
    nose: {
      ...nose,
      imageSrc: noseCrop,
    },
    eyes: {
      score: 80,
      scoreLabel: 'Balanced',
    },
    eyebrows: {
      crop: browsData.crop,
      metrics: brow,
      color: browPixels.color,
      colorHex: browPixels.colorHex,
      density: browPixels.density,
      densityPct: browPixels.densityPct,
      unibrow: browPixels.unibrow,
      edgeSharpness: browPixels.edgeSharpness,
    },
    lips: {
      ...lips,
      imageSrc: mouthCrop,
    },
    jawChin: {
      ...jawChin,
      imageSrc: jawCrop,
    },
    cheeks: {
      ...cheek,
      imageSrc: cheekCrop,
      blushLevel: cheekPixels.blushLevel,
      blushIntensity: cheekPixels.blushIntensity,
      skinTexture: cheekPixels.skinTexture,
      contourDef: cheekPixels.contourDef,
      cheekBrightness: cheekPixels.cheekBrightness,
      leftCheekBrightness: cheekPixels.leftCheekBrightness,
      rightCheekBrightness: cheekPixels.rightCheekBrightness,
      evennessLabel: cheekPixels.evennessLabel,
      evennessDiff: cheekPixels.evennessDiff,
      appleBrightness: cheekPixels.appleBrightness,
      appleRedness: cheekPixels.appleRedness,
    },
    jaw: {
      ...jawData,
      imageSrc: jawCrop,
      photoSource: 'front',
    },
    chin: {
      ...chinData,
      imageSrc: chinCrop,
      photoSource: 'front',
    },
    smile: {
      ...smileData,
      ...smilePixels,
      imageSrc: photos.smile || mouthCrop,
    },
    neck: {
      ...neckData,
      imageSrc: neckCrop,
    },
    ears: {
      ...earData,
      imageSrc: faceCrop,
    },
    hair: {
      ...hairData,
      imageSrc: foreheadCrop,
      imageSrcTopHead: photos.topHead || null,
      photoSource: 'front',
    },
    skin: {
      ...skin,
    },
    dimorphism: dimorphismMetrics(landmarks, metrics),
    averageness: averagenessMetrics(landmarks, metrics, answers),
  }

  // Overall composite score
  const overall = overallScore(reportData, null, metrics)
  reportData.overall = {
    score: overall,
    scoreLabel: overallLabel(overall),
  }

  return reportData
}


