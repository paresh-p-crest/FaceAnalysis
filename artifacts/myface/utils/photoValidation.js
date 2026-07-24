/**
 * Comprehensive photo validation using MediaPipe FaceLandmarker + canvas heuristics.
 *
 * Checks performed:
 *  1. Face detected (exactly 1)
 *  2. Correct pose for the selected angle
 *  3. Neutral expression (mouth closed)
 *  4. Eyes open
 *  5. No glasses or sunglasses
 *  6. Hair not covering key landmarks
 *  7. Face centered
 *  8. Adequate brightness
 *  9. Image not blurry
 * 10. Face occupies sufficient area
 * 11. Image resolution adequate
 *
 * Returns { overall: 'pass'|'warn'|'fail', checks: Array<{name, pass, message, severity}> }
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

/* ── MediaPipe singleton ── */

let landmarker = null

async function getLandmarker() {
  if (landmarker) return landmarker
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  )
  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  })
  return landmarker
}

/* ── Image loading helpers ── */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function imageToCanvas(img, maxW = 640) {
  const scale = Math.min(1, maxW / img.width)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  return { canvas, ctx, w, h }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/* ──────────────────────────────────────────────
   MEDIAPIPE-BASED CHECKS (landmark analysis)
   ────────────────────────────────────────────── */

/**
 * Check 1: Exactly one face detected.
 */
function checkFaceCount(result) {
  const count = result.faceLandmarks?.length || 0
  if (count === 0) {
    return { name: 'faceDetected', pass: false, messageKey: 'Photo.validation.faceDetected.none', severity: 'error' }
  }
  if (count > 1) {
    return { name: 'faceDetected', pass: false, messageKey: 'Photo.validation.faceDetected.multiple', messageValues: { count }, severity: 'error' }
  }
  return { name: 'faceDetected', pass: true, messageKey: 'Photo.validation.faceDetected.ok', severity: 'ok' }
}

/**
 * Check 2: Correct pose for the selected angle.
 *
 * Uses the nose-tip position relative to the face bounding box to estimate yaw.
 * Nose landmark 1, face edges landmarks 234 (person's right) and 454 (person's left).
 *
 * noseRatio = (nose.x - leftEdge.x) / (rightEdge.x - leftEdge.x)
 *   0.0 → extreme right turn (person's right), 1.0 → extreme left turn (person's left)
 *   0.5 → frontal
 */
function checkPose(landmarks, expectedPose) {
  const nose = landmarks[1]
  const leftEdge = landmarks[234]   // person's right cheek
  const rightEdge = landmarks[454]  // person's left cheek
  const faceWidth = dist(leftEdge, rightEdge)

  if (faceWidth < 0.01) {
    return { name: 'correctPose', pass: true, messageKey: 'Photo.validation.correctPose.inconclusive', severity: 'info' }
  }

  const noseRatio = (nose.x - leftEdge.x) / faceWidth

  // Define acceptable ranges per pose
  // noseRatio: 0 = nose far left of image, 0.5 = center, 1 = nose far right of image
  const poseRanges = {
    front:        { min: 0.35, max: 0.65, labelKey: 'Photo.validation.expectedPose.front' },
    leftProfile:  { min: 0.45, max: 1.0,  labelKey: 'Photo.validation.expectedPose.leftProfile' },
    rightProfile: { min: 0.0,  max: 0.55, labelKey: 'Photo.validation.expectedPose.rightProfile' },
    left45:       { min: 0.35, max: 0.85, labelKey: 'Photo.validation.expectedPose.left45' },
    right45:      { min: 0.15, max: 0.65, labelKey: 'Photo.validation.expectedPose.right45' },
    smile:        { min: 0.30, max: 0.70, labelKey: 'Photo.validation.expectedPose.smile' },
    topHead:      { min: 0.20, max: 0.80, labelKey: 'Photo.validation.expectedPose.topHead' },
  }

  const range = poseRanges[expectedPose] || poseRanges.front
  const inRange = noseRatio >= range.min && noseRatio <= range.max

  // Non-front poses use 'warning' instead of 'error' since they're optional
  const severity = expectedPose === 'front' ? 'error' : 'warning'

  if (!inRange) {
    const detectedKey = noseRatio > 0.62
      ? 'Photo.validation.detectedPose.leftProfile'
      : noseRatio < 0.38
        ? 'Photo.validation.detectedPose.rightProfile'
        : 'Photo.validation.detectedPose.frontFacing'
    return {
      name: 'correctPose',
      pass: false,
      messageKey: 'Photo.validation.correctPose.wrong',
      messageValues: { detected: detectedKey, expected: range.labelKey },
      severity,
    }
  }
  return { name: 'correctPose', pass: true, messageKey: 'Photo.validation.correctPose.ok', messageValues: { pose: range.labelKey }, severity: 'ok' }
}

/**
 * Check 3: Neutral expression (mouth roughly closed).
 *
 * Measures mouth openness: vertical distance between upper lip (13) and lower lip (14)
 * relative to mouth width (61 → 291). Open mouth = non-neutral.
 */
function checkExpression(landmarks) {
  const upperLip = landmarks[13]
  const lowerLip = landmarks[14]
  const mouthLeft = landmarks[61]
  const mouthRight = landmarks[291]

  const mouthWidth = dist(mouthLeft, mouthRight)
  const mouthOpen = dist(upperLip, lowerLip)

  if (mouthWidth < 0.001) {
    return { name: 'neutralExpression', pass: true, messageKey: 'Photo.validation.neutralExpression.inconclusive', severity: 'info' }
  }

  const openRatio = mouthOpen / mouthWidth

  if (openRatio > 0.18) {
    return {
      name: 'neutralExpression',
      pass: false,
      messageKey: 'Photo.validation.neutralExpression.mouthOpen',
      severity: 'error',
    }
  }

  // Also detect extreme smile via mouth corner positions relative to lip center
  const lipCenterY = (upperLip.y + lowerLip.y) / 2
  const cornerAvgY = (mouthLeft.y + mouthRight.y) / 2
  const smileDeviation = (cornerAvgY - lipCenterY) / mouthWidth

  // Strong smile: corners significantly lower than lip center (positive in y-down)
  if (smileDeviation > 0.12) {
    return {
      name: 'neutralExpression',
      pass: false,
      messageKey: 'Photo.validation.neutralExpression.nonNeutral',
      severity: 'warning',
    }
  }

  return { name: 'neutralExpression', pass: true, messageKey: 'Photo.validation.neutralExpression.ok', severity: 'ok' }
}

/**
 * Check 4: Eyes open.
 *
 * Eye Aspect Ratio (EAR) for each eye: vertical spread / horizontal width.
 * Closed eyes → low EAR.
 */
function checkEyesOpen(landmarks) {
  // Left eye: top=159, bottom=145, outer=33, inner=133
  const leTop = landmarks[159]
  const leBot = landmarks[145]
  const leOuter = landmarks[33]
  const leInner = landmarks[133]

  // Right eye: top=386, bottom=374, outer=362, inner=263
  const reTop = landmarks[386]
  const reBot = landmarks[374]
  const reOuter = landmarks[362]
  const reInner = landmarks[263]

  const leftEAR = dist(leTop, leBot) / (dist(leOuter, leInner) || 0.001)
  const rightEAR = dist(reTop, reBot) / (dist(reOuter, reInner) || 0.001)
  const avgEAR = (leftEAR + rightEAR) / 2

  if (avgEAR < 0.08) {
    return {
      name: 'eyesOpen',
      pass: false,
      messageKey: 'Photo.validation.eyesOpen.closed',
      severity: 'error',
    }
  }
  if (avgEAR < 0.12) {
    return {
      name: 'eyesOpen',
      pass: false,
      messageKey: 'Photo.validation.eyesOpen.squinting',
      severity: 'warning',
    }
  }
  return { name: 'eyesOpen', pass: true, messageKey: 'Photo.validation.eyesOpen.ok', severity: 'ok' }
}

/**
 * Check 5: No glasses or sunglasses.
 *
 * Multi-signal approach:
 *  a) Canvas-based: dark horizontal band / high horizontal edge contrast at eye level
 *  b) Landmark-based: abnormal vertical distances between brow and eye (frames push brows up)
 *     and unusual eye region brightness asymmetry (lens reflections)
 */
function checkGlasses(ctx, w, h, landmarks) {
  const data = ctx.getImageData(0, 0, w, h).data

  // ── Canvas heuristic (pixel analysis) ──
  const yStart = Math.floor(h * 0.33)
  const yEnd = Math.floor(h * 0.50)
  const bandH = yEnd - yStart

  let canvasSignals = 0

  if (bandH >= 4) {
    // Horizontal brightness profile in eye band
    const profile = new Float32Array(w)
    for (let x = 0; x < w; x++) {
      let colSum = 0
      for (let y = yStart; y < yEnd; y++) {
        const idx = (y * w + x) * 4
        colSum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      }
      profile[x] = colSum / bandH
    }

    // Strong horizontal edges → frame rims
    let strongEdges = 0
    for (let x = 1; x < w - 1; x++) {
      const grad = Math.abs(profile[x + 1] - profile[x - 1])
      if (grad > 18) strongEdges++
    }
    const edgeRatio = strongEdges / w
    if (edgeRatio > 0.08 && strongEdges > 12) canvasSignals++

    // Dark horizontal runs → frame top bar / bridge
    let darkRuns = 0
    let inDark = false
    for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
      if (profile[x] < 80) {
        if (!inDark) { darkRuns++; inDark = true }
      } else {
        inDark = false
      }
    }
    if (darkRuns >= 3) canvasSignals++

    // Eye-band darkening → tinted lenses
    let bandSum = 0
    for (let x = 0; x < w; x++) bandSum += profile[x]
    const bandAvg = bandSum / w

    let overallSum = 0
    let overallCount = 0
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const idx = (y * w + x) * 4
        overallSum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        overallCount++
      }
    }
    const overallAvg = overallSum / overallCount
    if (bandAvg / (overallAvg || 1) < 0.85) canvasSignals++

    // Dark pixel fraction → sunglass tint
    let veryDarkPixels = 0
    const totalBandPixels = w * bandH
    for (let y = yStart; y < yEnd; y++) {
      for (let x = Math.floor(w * 0.2); x < Math.floor(w * 0.8); x++) {
        const idx = (y * w + x) * 4
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        if (lum < 60) veryDarkPixels++
      }
    }
    if (veryDarkPixels / (totalBandPixels * 0.6) > 0.15) canvasSignals++
  }

  // ── Landmark heuristic ──
  let landmarkSignals = 0

  if (landmarks) {
    // Brow-to-eye distance abnormally large → frames push brows up
    const leftBrowInner = landmarks[107]
    const leftEyeTop = landmarks[159]
    const rightBrowInner = landmarks[336]
    const rightEyeTop = landmarks[386]
    const leftEyeOuter = landmarks[33]
    const leftEyeInner = landmarks[133]
    const rightEyeOuter = landmarks[362]
    const rightEyeInner = landmarks[263]

    const leftEyeWidth = dist(leftEyeOuter, leftEyeInner)
    const rightEyeWidth = dist(rightEyeOuter, rightEyeInner)

    if (leftEyeWidth > 0.001 && rightEyeWidth > 0.001) {
      const leftBrowGap = (leftEyeTop.y - leftBrowInner.y) / leftEyeWidth
      const rightBrowGap = (rightEyeTop.y - rightBrowInner.y) / rightEyeWidth
      const avgBrowGap = (leftBrowGap + rightBrowGap) / 2

      // Normal brow-to-eye gap is ~0.2-0.5; glasses frames push it to 0.6+
      if (avgBrowGap > 0.55) landmarkSignals++
    }

    // Asymmetric eye region brightness can indicate lens reflections
    const leftEyeCenter = {
      x: (landmarks[33].x + landmarks[133].x) / 2,
      y: (landmarks[159].y + landmarks[145].y) / 2,
    }
    const rightEyeCenter = {
      x: (landmarks[362].x + landmarks[263].x) / 2,
      y: (landmarks[386].y + landmarks[374].y) / 2,
    }

    // Sample small patches around each eye center on the canvas
    const sampleRadius = Math.max(3, Math.floor(w * 0.02))
    const leftBright = sampleAreaBrightness(ctx, w, h, leftEyeCenter, sampleRadius)
    const rightBright = sampleAreaBrightness(ctx, w, h, rightEyeCenter, sampleRadius)

    if (leftBright !== null && rightBright !== null) {
      const brightDiff = Math.abs(leftBright - rightBright) / Math.max(leftBright, rightBright, 1)
      // Significant asymmetry around eyes → possible lens reflection
      if (brightDiff > 0.35) landmarkSignals++
    }
  }

  const totalSignals = canvasSignals + landmarkSignals

  if (totalSignals >= 3) {
    return { name: 'noGlasses', pass: false, messageKey: 'Photo.validation.noGlasses.detected', severity: 'error' }
  }
  if (totalSignals >= 2 && canvasSignals >= 1) {
    return { name: 'noGlasses', pass: false, messageKey: 'Photo.validation.noGlasses.possible', severity: 'warning' }
  }

  return { name: 'noGlasses', pass: true, messageKey: 'Photo.validation.noGlasses.ok', severity: 'ok' }
}

/**
 * Sample average brightness in a small circular area around a point.
 */
function sampleAreaBrightness(ctx, w, h, center, radius) {
  const cx = Math.round(center.x * w)
  const cy = Math.round(center.y * h)
  const x0 = Math.max(0, cx - radius)
  const y0 = Math.max(0, cy - radius)
  const x1 = Math.min(w, cx + radius)
  const y1 = Math.min(h, cy + radius)
  if (x1 <= x0 || y1 <= y0) return null

  const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
  let sum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    count++
  }
  return count > 0 ? sum / count : null
}

/**
 * Check 6: Hair not covering key facial landmarks.
 *
 * Compares the vertical gap between forehead top (landmark 10) and eyebrows
 * vs the gap between eyebrows and nose tip. A very low ratio suggests hair covering.
 */
function checkHairCovering(landmarks) {
  const foreheadTop = landmarks[10]  // top of forehead
  const leftBrow = landmarks[105]    // left brow midpoint
  const rightBrow = landmarks[334]   // right brow midpoint
  const noseTip = landmarks[2]       // nose tip

  const browY = (leftBrow.y + rightBrow.y) / 2
  const foreheadToBrow = browY - foreheadTop.y
  const browToNose = noseTip.y - browY

  if (browToNose < 0.001) {
    return { name: 'hairClear', pass: true, messageKey: 'Photo.validation.hairClear.inconclusive', severity: 'info' }
  }

  const ratio = foreheadToBrow / browToNose

  // Normal ratio is 0.4-0.8. Very low ratio means forehead area is compressed → hair covering.
  if (ratio < 0.2) {
    return {
      name: 'hairClear',
      pass: false,
      messageKey: 'Photo.validation.hairClear.covering',
      severity: 'error',
    }
  }
  if (ratio < 0.3) {
    return {
      name: 'hairClear',
      pass: false,
      messageKey: 'Photo.validation.hairClear.partial',
      severity: 'warning',
    }
  }

  // Also check forehead-to-eye vs eye-to-chin proportion
  const eyeCenterY = (landmarks[159].y + landmarks[386].y + landmarks[145].y + landmarks[374].y) / 4
  const foreheadToEye = eyeCenterY - foreheadTop.y
  const eyeToChin = landmarks[152].y - eyeCenterY

  if (eyeToChin > 0.01 && foreheadToEye / eyeToChin < 0.15) {
    return {
      name: 'hairClear',
      pass: false,
      messageKey: 'Photo.validation.hairClear.foreheadCovered',
      severity: 'warning',
    }
  }

  return { name: 'hairClear', pass: true, messageKey: 'Photo.validation.hairClear.ok', severity: 'ok' }
}

/** Face oval landmark indices */
const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

/**
 * Check 7: Face centered in the image.
 *
 * Compares the face bbox center to the image center.
 * Tolerance: face center within ~18% of image center on each axis.
 */
function checkFaceCentered(landmarks) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const idx of FACE_OVAL_INDICES) {
    const p = landmarks[idx]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const faceCX = (minX + maxX) / 2
  const faceCY = (minY + maxY) / 2

  const offsetX = Math.abs(faceCX - 0.5)
  const offsetY = Math.abs(faceCY - 0.5)

  if (offsetX > 0.18 || offsetY > 0.2) {
    const directionKeys = []
    if (offsetX > 0.18) directionKeys.push(faceCX < 0.5 ? 'Photo.validation.faceCentered.left' : 'Photo.validation.faceCentered.right')
    if (offsetY > 0.2) directionKeys.push(faceCY < 0.5 ? 'Photo.validation.faceCentered.tooHigh' : 'Photo.validation.faceCentered.tooLow')
    return {
      name: 'faceCentered',
      pass: false,
      messageKey: 'Photo.validation.faceCentered.offCenter',
      messageValues: { directionKeys },
      severity: 'warning',
    }
  }
  return { name: 'faceCentered', pass: true, messageKey: 'Photo.validation.faceCentered.ok', severity: 'ok' }
}

/**
 * Check 10: Face occupies sufficient area.
 *
 * Face bbox area vs total image area. Minimum 12% for good analysis.
 */
function checkFaceSize(landmarks) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0
  for (const idx of FACE_OVAL_INDICES) {
    const p = landmarks[idx]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const faceW = maxX - minX
  const faceH = maxY - minY
  const faceArea = faceW * faceH  // in normalized 0-1 coords, image area = 1

  if (faceArea < 0.06) {
    return {
      name: 'faceSize',
      pass: false,
      messageKey: 'Photo.validation.faceSize.tooSmall',
      severity: 'error',
    }
  }
  if (faceArea < 0.12) {
    return {
      name: 'faceSize',
      pass: false,
      messageKey: 'Photo.validation.faceSize.small',
      severity: 'warning',
    }
  }
  return { name: 'faceSize', pass: true, messageKey: 'Photo.validation.faceSize.ok', severity: 'ok' }
}

/* ──────────────────────────────────────────────
   CANVAS-BASED CHECKS (image quality)
   ────────────────────────────────────────────── */

/**
 * Check 8: Adequate brightness.
 */
function checkBrightness(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  let sum = 0
  const total = w * h
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const avg = sum / total
  if (avg < 40) return { name: 'brightness', pass: false, messageKey: 'Photo.validation.brightness.veryDark', severity: 'error' }
  if (avg < 60) return { name: 'brightness', pass: false, messageKey: 'Photo.validation.brightness.dark', severity: 'warning' }
  if (avg > 230) return { name: 'brightness', pass: false, messageKey: 'Photo.validation.brightness.overexposed', severity: 'error' }
  if (avg > 210) return { name: 'brightness', pass: false, messageKey: 'Photo.validation.brightness.bright', severity: 'warning' }
  return { name: 'brightness', pass: true, messageKey: 'Photo.validation.brightness.ok', severity: 'ok' }
}

/**
 * Check 9: Image not blurry (Laplacian variance).
 */
function checkBlur(ctx, w, h) {
  const data = ctx.getImageData(0, 0, w, h).data
  const gray = new Float32Array(w * h)
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4
    gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
  }

  let sum = 0
  let count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const laplacian =
        -4 * gray[y * w + x] +
        gray[(y - 1) * w + x] +
        gray[(y + 1) * w + x] +
        gray[y * w + x - 1] +
        gray[y * w + x + 1]
      sum += laplacian * laplacian
      count++
    }
  }
  const variance = sum / count
  if (variance < 20) return { name: 'sharpness', pass: false, messageKey: 'Photo.validation.sharpness.veryBlurry', severity: 'error' }
  if (variance < 40) return { name: 'sharpness', pass: false, messageKey: 'Photo.validation.sharpness.blurry', severity: 'warning' }
  return { name: 'sharpness', pass: true, messageKey: 'Photo.validation.sharpness.ok', severity: 'ok' }
}

/**
 * Check 11: Image resolution adequate.
 */
function checkDimensions(img) {
  const minPx = 400
  if (img.width < minPx || img.height < minPx) {
    return {
      name: 'resolution',
      pass: false,
      messageKey: 'Photo.validation.resolution.tooSmall',
      messageValues: { width: img.width, height: img.height, minPx },
      severity: 'error',
    }
  }
  return { name: 'resolution', pass: true, messageKey: 'Photo.validation.resolution.ok', severity: 'ok' }
}

/* ──────────────────────────────────────────────
   MAIN VALIDATION ENTRY POINT
   ────────────────────────────────────────────── */

/**
 * Validate a photo against all guidelines.
 *
 * @param {string} dataUrl - Image data URL
 * @param {string} poseId - Expected pose ('front', 'leftProfile', 'rightProfile', 'left45', 'right45', 'smile', 'topHead')
 * @returns {{ overall: 'pass'|'warn'|'fail', checks: Array }}
 */
export async function validatePhoto(dataUrl, poseId = 'front') {
  const img = await loadImage(dataUrl)
  const { ctx, w, h } = imageToCanvas(img)

  const isFront = poseId === 'front'
  const isSmile = poseId === 'smile'
  const isNonFront = !isFront // profile, 45°, smile, topHead

  // ── Canvas-only checks (always run) ──
  const brightness = checkBrightness(ctx, w, h)
  const blur = checkBlur(ctx, w, h)

  const canvasChecks = [brightness, blur]

  // ── MediaPipe checks ──
  let mpChecks = []
  try {
    const detector = await getLandmarker()
    const result = detector.detect(img)

    const faceCount = result.faceLandmarks?.length || 0

    if (faceCount === 0) {
      if (isNonFront) {
        // MediaPipe often can't detect faces in profile/angle shots — pass with info
        mpChecks.push({
          name: 'faceDetected',
          pass: true,
          messageKey: 'Photo.validation.faceDetected.limitedAngle',
          severity: 'info',
        })
        // Skip all other landmark checks since no landmarks available
      } else {
        mpChecks.push(checkFaceCount(result))
      }
    } else {
      // Face detected — run face count check
      mpChecks.push(checkFaceCount(result))

      if (faceCount === 1) {
        const lm = result.faceLandmarks[0]

        // Pose check (always runs — has different ranges per pose)
        mpChecks.push(checkPose(lm, poseId))

        // Expression check — skip for smile, relax for profile/angle
        if (isSmile) {
          mpChecks.push({
            name: 'neutralExpression',
            pass: true,
            messageKey: 'Photo.validation.neutralExpression.smileExpected',
            severity: 'ok',
          })
        } else if (isNonFront) {
          const exp = checkExpression(lm)
          exp.severity = 'info'
          mpChecks.push(exp)
        } else {
          mpChecks.push(checkExpression(lm))
        }

        // Eyes open check — relax for profile angles (one eye may be hidden)
        if (isNonFront) {
          mpChecks.push({
            name: 'eyesOpen',
            pass: true,
            messageKey: 'Photo.validation.eyesOpen.limitedAngle',
            severity: 'info',
          })
        } else {
          mpChecks.push(checkEyesOpen(lm))
        }

        // Hair check — skip for topHead / non-front poses where hair at back/side is expected
        if (isNonFront) {
          mpChecks.push({
            name: 'hairClear',
            pass: true,
            messageKey: 'Photo.validation.hairClear.skippedTopHead',
            severity: 'info',
          })
        } else {
          mpChecks.push(checkHairCovering(lm))
        }

        // Face centered — relax for profile/angle poses (face is naturally offset)
        if (isNonFront) {
          mpChecks.push({
            name: 'faceCentered',
            pass: true,
            messageKey: 'Photo.validation.correctPose.ok',
            severity: 'info',
          })
        } else {
          mpChecks.push(checkFaceCentered(lm))
        }

        mpChecks.push(checkFaceSize(lm))

        // Glasses uses both canvas context and landmarks — soften for profile poses
        if (isNonFront) {
          mpChecks.push({
            name: 'noGlasses',
            pass: true,
            messageKey: 'Photo.validation.correctPose.ok',
            severity: 'info',
          })
        } else {
          mpChecks.push(checkGlasses(ctx, w, h, lm))
        }
      }
    }
  } catch {
    // MediaPipe failed — still run canvas checks but note the limitation
    if (isNonFront) {
      mpChecks.push({
        name: 'mediaPipe',
        pass: true,
        messageKey: 'Photo.validation.mediaPipe.unavailableAngle',
        severity: 'info',
      })
    } else {
      mpChecks.push({
        name: 'mediaPipe',
        pass: true,
        messageKey: 'Photo.validation.mediaPipe.error',
        severity: 'info',
      })
    }
  }

  const checks = [...canvasChecks, ...mpChecks]

  // Overall result:
  // For non-front poses: only fail on canvas errors (brightness, blur), not landmark errors
  // For front pose: any error → fail
  let hasError, hasWarning
  if (isNonFront) {
    // Only canvas checks can cause failure for non-front poses
    hasError = canvasChecks.some((c) => c.severity === 'error' && !c.pass)
    hasWarning = canvasChecks.some((c) => c.severity === 'warning' && !c.pass)
    // Also check landmark errors but only from checks that actually ran (not "limited" ones)
    const landmarkErrors = mpChecks.filter((c) => {
      if (c.severity !== 'error' || c.pass) return false
      const skipKeys = new Set([
        'Photo.validation.faceDetected.limitedAngle',
        'Photo.validation.eyesOpen.limitedAngle',
        'Photo.validation.hairClear.skippedTopHead',
      ])
      return !skipKeys.has(c.messageKey)
    })
    hasError = hasError || landmarkErrors.length > 0
  } else {
    hasError = checks.some((c) => c.severity === 'error' && !c.pass)
    hasWarning = checks.some((c) => c.severity === 'warning' && !c.pass)
  }

  return {
    overall: hasError ? 'fail' : hasWarning ? 'warn' : 'pass',
    checks,
  }
}

const NESTED_MSG_KEY_PREFIX = 'Photo.'

/** Resolve a validation check message via next-intl `t`. */
export function translateValidationMessage(check, t) {
  if (!check?.messageKey || !t) return check?.message || ''
  const values = { ...(check.messageValues || {}) }
  if (values.directionKeys) {
    values.direction = values.directionKeys.map((key) => t(key)).filter(Boolean).join(' and ')
    delete values.directionKeys
  }
  for (const [key, val] of Object.entries(values)) {
    if (typeof val === 'string' && val.startsWith(NESTED_MSG_KEY_PREFIX)) {
      values[key] = t(val)
    }
  }
  return t(check.messageKey, values)
}
