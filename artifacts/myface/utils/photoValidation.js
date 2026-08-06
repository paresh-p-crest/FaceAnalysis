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
 * Per-pose strictness model:
 *  • front           — all 11 checks enforced (error on any failure)
 *  • left45/right45  — all meaningful checks enforced (face must be detectable; wrong pose → fail)
 *  • smile           — same as 45° but neutral expression is skipped (open mouth expected)
 *  • leftProfile/rightProfile — canvas quality always enforced; MediaPipe face detection is
 *                               lenient (reliably fails at 90°); correctPose + faceSize still
 *                               flagged when landmarks are available
 *  • topHead         — same leniency as full profiles
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
  const createLandmarker = (delegate) =>
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate,
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    })

  // GPU is primary; MediaPipe Tasks throws at createFromOptions when WebGL is
  // unavailable (no built-in retry), so fall back to CPU and log it.
  try {
    landmarker = await createLandmarker('GPU')
  } catch (err) {
    console.warn('[MediaPipe] GPU delegate unavailable, falling back to CPU:', err)
    landmarker = await createLandmarker('CPU')
  }
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

function imageToCanvas(img) {
  // ponytail: no downscale cap, so canvas checks (brightness/blur/glasses) run on the
  // exact pixels the backend validates at submit (FE uploads the original file bytes).
  // If a future feature validates live video frames, reintroduce a maxW cap there instead.
  const w = img.width
  const h = img.height
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

/**
 * Extract Euler angles (degrees) from a MediaPipe 4×4 column-major transformation matrix.
 *
 * Layout (column-major → flat index):
 *   [0]  [4]  [8]  [12]   →   r00  r01  r02  tx
 *   [1]  [5]  [9]  [13]   →   r10  r11  r12  ty
 *   [2]  [6]  [10] [14]   →   r20  r21  r22  tz
 *   [3]  [7]  [11] [15]   →   0    0    0    1
 *
 * Convention: ZYX Euler (yaw around Y, pitch around X, roll around Z).
 * MediaPipe coord system: +X right, +Y up, +Z toward camera.
 *
 * @param {number[]} m  16-element flat array from result.facialTransformationMatrixes[0].data
 * @returns {{ yaw: number, pitch: number, roll: number }}  All values in degrees.
 */
function matrixToEulerAngles(m) {
  // Rotation sub-matrix elements (column-major indexing)
  const r10 = m[1], r11 = m[5], r12 = m[9]
  const r00 = m[0],            r02 = m[8]
                                 const r22 = m[10]

  // Yaw (Y-axis rotation → left/right head turn)
  const yaw   = Math.atan2(r02, r22) * (180 / Math.PI)
  // Pitch (X-axis rotation → up/down tilt; used for topHead detection)
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r12))) * (180 / Math.PI)
  // Roll (Z-axis rotation → head tilt sideways)
  const roll  = Math.atan2(r10, r11) * (180 / Math.PI)

  return { yaw, pitch, roll }
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

/** Pose label i18n keys (shared between primary and fallback paths) */
const POSE_LABEL_KEYS = {
  front:        'Photo.validation.expectedPose.front',
  smile:        'Photo.validation.expectedPose.smile',
  left45:       'Photo.validation.expectedPose.left45',
  right45:      'Photo.validation.expectedPose.right45',
  leftProfile:  'Photo.validation.expectedPose.leftProfile',
  rightProfile: 'Photo.validation.expectedPose.rightProfile',
  topHead:      'Photo.validation.expectedPose.topHead',
}

/**
 * Check 2: Correct pose for the selected angle.
 *
 * Uses the nose-tip position relative to the face bounding box to estimate yaw.
 * Nose landmark 1, face edges landmarks 234 (person's right) and 454 (person's left).
 * HYBRID STRATEGY (confirmed by photo_pose_validation.ipynb):
 *
 * • front / smile / left45 / right45 / topHead
 *     → PRIMARY: yaw/pitch from facialTransformationMatrixes (3D, physically meaningful,
 *       camera/lens-independent). Falls back to noseRatio if the matrix is absent.
 *
 * noseRatio = (nose.x - leftEdge.x) / (rightEdge.x - leftEdge.x)
 *   0.0 → extreme right turn (person's right), 1.0 → extreme left turn (person's left)
 *   0.5 → frontal
 * • leftProfile / rightProfile (90° side views)
 *     → ALWAYS noseRatio (2D heuristic). At ≥ 90° MediaPipe frequently returns no
 *       transformation matrix because it can't fit a full 3D face model to a side profile.
 *       The noseRatio formula was already reliably accurate for these two poses.
 *
 * Degree thresholds (3D path) — calibrate against real uploads before locking:
 *   front / smile : |yaw| ≤ 15°
 *   right45       : yaw ∈ [+15°, +60°]  (positive yaw = subject's right side toward camera)
 *   left45        : yaw ∈ [−60°, −15°]
 *   topHead       : pitch ≤ −25°  (head pitched forward, camera looks at crown)
 *
 * noseRatio bands (2D path, profiles only):
 *   rightProfile  : noseRatio > 0.75
 *   leftProfile   : noseRatio < 0.25
 *
 * NOTE: left/right refer to the subject's own left/right (as if you were facing them),
 * not the camera's left/right — confirmed against real capture data on 2026-08-04;
 * the original positive-yaw-is-left assumption was backwards.
 *
 * @param {object[]} landmarks   MediaPipe face landmarks array
 * @param {object|null} matrix   result.facialTransformationMatrixes[0] (or null)
 * @param {string} expectedPose  One of the pose IDs above
 */
function checkPose(landmarks, matrix, expectedPose) {
  const severity = expectedPose === 'topHead' ? 'warning' : 'error'

  // ── Full-profile poses: always use noseRatio (3D matrix unreliable at 90°) ──
  // Skip the matrix path entirely for these two and fall through to the noseRatio block.
  const isFullProfile = expectedPose === 'leftProfile' || expectedPose === 'rightProfile'

  // ── Primary path: 3D transformation matrix (non-profile poses only) ──────
  const matrixData = matrix?.data
  const hasMatrix  = !isFullProfile && Array.isArray(matrixData) && matrixData.length === 16

  if (hasMatrix) {
    const { yaw, pitch } = matrixToEulerAngles(matrixData)

    const detectedClass = (() => {
      if (yaw >= 60)  return 'rightProfile'
      if (yaw <= -60) return 'leftProfile'
      if (yaw >= 15)  return 'right45'
      if (yaw <= -15) return 'left45'
      return 'front'
    })()

    // Calibration helper — uncomment to log real yaw/pitch against reference photos:
    // console.log(`[Pose Validation 3D] Detected: ${detectedClass} (yaw: ${yaw.toFixed(1)}°, pitch: ${pitch.toFixed(1)}°) | Expected: ${expectedPose}`)

    const inBand = (() => {
      switch (expectedPose) {
        case 'front':
        case 'smile':    return Math.abs(yaw) <= 15
        case 'right45':  return yaw >= 15  && yaw <= 60   // notebook: > 15° yaw = subject's right side to camera
        case 'left45':   return yaw >= -60 && yaw <= -15  // notebook: < -15° yaw = subject's left side to camera
        case 'topHead':  return pitch <= -25              // notebook threshold
        default:         return Math.abs(yaw) <= 15
      }
    })()

    if (!inBand) {
      const detectedKey = (() => {
        if (expectedPose === 'topHead') return 'Photo.validation.detectedPose.frontFacing'
        if (detectedClass === 'leftProfile') return 'Photo.validation.detectedPose.leftProfile'
        if (detectedClass === 'rightProfile') return 'Photo.validation.detectedPose.rightProfile'
        if (detectedClass === 'left45') return 'Photo.validation.detectedPose.left45'
        if (detectedClass === 'right45') return 'Photo.validation.detectedPose.right45'
        return 'Photo.validation.detectedPose.frontFacing'
      })()

      return {
        name: 'correctPose',
        pass: false,
        messageKey: 'Photo.validation.correctPose.wrong',
        messageValues: { detected: detectedKey, expected: POSE_LABEL_KEYS[expectedPose] ?? POSE_LABEL_KEYS.front },
        severity,
      }
    }

    return {
      name: 'correctPose',
      pass: true,
      messageKey: 'Photo.validation.correctPose.ok',
      messageValues: { pose: POSE_LABEL_KEYS[expectedPose] },
      severity: 'ok',
    }
  }

  // ── 2D noseRatio path: profiles (always) + fallback for non-profiles ──────
  // leftProfile / rightProfile always land here (3D matrix unreliable at 90°).
  // front / smile / 45° / topHead reach here only if the matrix was absent.
  // noseRatio = (nose.x − leftEdge.x) / faceWidth
  //   0.0 → extreme left turn (subject's left side to camera), 0.5 → frontal, 1.0 → extreme right turn
  const nose      = landmarks[1]
  const leftEdge  = landmarks[234]
  const rightEdge = landmarks[454]
  const faceWidth = dist(leftEdge, rightEdge)

  if (faceWidth < 0.01) {
    return { name: 'correctPose', pass: true, messageKey: 'Photo.validation.correctPose.inconclusive', severity: 'info' }
  }

  const noseRatio = (nose.x - leftEdge.x) / faceWidth

  // Define acceptable ranges per pose
  // noseRatio: 0 = nose far left of image, 0.5 = center, 1 = nose far right of image
  const detectedClass2D = noseRatio > 0.75 ? 'rightProfile'
    : noseRatio < 0.25 ? 'leftProfile'
    : noseRatio > 0.58 ? 'right45'
    : noseRatio < 0.42 ? 'left45'
    : 'front'

  // Calibration helper — uncomment to log real noseRatio against reference photos:
  // console.log(`[Pose Validation 2D] Detected: ${detectedClass2D} (noseRatio: ${noseRatio.toFixed(3)}) | Expected: ${expectedPose}`)

  // Bands are non-overlapping. NOTE: sensitivity varies with camera/lens so boundaries
  // are best confirmed against real captures rather than guessed.
  const poseRanges = {
    front:        { min: 0.42, max: 0.58, labelKey: POSE_LABEL_KEYS.front },
    right45:      { min: 0.58, max: 0.75, labelKey: POSE_LABEL_KEYS.right45 },
    left45:       { min: 0.25, max: 0.42, labelKey: POSE_LABEL_KEYS.left45 },
    rightProfile: { min: 0.75, max: 1.0,  labelKey: POSE_LABEL_KEYS.rightProfile },
    leftProfile:  { min: 0.0,  max: 0.25, labelKey: POSE_LABEL_KEYS.leftProfile },
    smile:        { min: 0.42, max: 0.58, labelKey: POSE_LABEL_KEYS.smile },
    topHead:      { min: 0.20, max: 0.80, labelKey: POSE_LABEL_KEYS.topHead },
  }

  const range   = poseRanges[expectedPose] || poseRanges.front
  const inRange = noseRatio >= range.min && noseRatio <= range.max

  if (!inRange) {
    const detectedKey = noseRatio > 0.58
      ? 'Photo.validation.detectedPose.rightProfile'
      : noseRatio < 0.42
        ? 'Photo.validation.detectedPose.leftProfile'
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

  const isFront    = poseId === 'front'
  const isSmile    = poseId === 'smile'
  const isTopHead  = poseId === 'topHead'
  // Full 90° profiles — MediaPipe genuinely struggles to detect faces at this angle
  const isProfile  = poseId === 'leftProfile' || poseId === 'rightProfile'
  // 45° angles — MediaPipe reliably detects faces; treat more like front
  const isAngle45  = poseId === 'left45' || poseId === 'right45'
  const isNonFront = !isFront

  // ── Canvas-only checks (always run) ──
  const brightness  = checkBrightness(ctx, w, h)
  const blur        = checkBlur(ctx, w, h)
  const dimensions  = checkDimensions(img)
  const canvasChecks = [brightness, blur, dimensions]

  // ── MediaPipe checks ──
  let mpChecks = []
  try {
    const detector  = await getLandmarker()
    const result    = detector.detect(img)
    const faceCount = result.faceLandmarks?.length || 0

    if (faceCount === 0) {
      if (isProfile || isTopHead) {
        // Full profile / top-of-head: MediaPipe reliably misses at 90°+ — treat as inconclusive,
        // not a failure, so legitimate profile shots aren't incorrectly blocked.
        mpChecks.push({
          name: 'faceDetected',
          pass: true,
          messageKey: 'Photo.validation.faceDetected.limitedAngle',
          severity: 'info',
        })
        // No landmarks available — skip landmark checks
      } else {
        // Front, 45°, smile: face must be detectable at these angles; treat as hard failure
        mpChecks.push(checkFaceCount(result))
      }
    } else {
      // Face detected — run face count check for all poses
      mpChecks.push(checkFaceCount(result))

      if (faceCount === 1) {
        const lm = result.faceLandmarks[0]

        // ── Pose direction (always runs when face detected — per-pose noseRatio ranges) ──
        const matrix = result.facialTransformationMatrixes?.[0] ?? null
        mpChecks.push(checkPose(lm, matrix, poseId))

        // ── Neutral expression ──
        if (isSmile) {
          // Smile pose: open/smiling mouth is expected
          mpChecks.push({
            name: 'neutralExpression',
            pass: true,
            messageKey: 'Photo.validation.neutralExpression.smileExpected',
            severity: 'ok',
          })
        } else if (isProfile || isTopHead) {
          // Full profile / top-of-head: expression landmark reliability is lower — downgrade to info
          const exp = checkExpression(lm)
          mpChecks.push({ ...exp, severity: 'info' })
        } else {
          // Front and 45°: enforce neutral expression
          mpChecks.push(checkExpression(lm))
        }

        // ── Eyes open ──
        if (isProfile || isTopHead) {
          // One eye is hidden in full profiles — skip
          mpChecks.push({
            name: 'eyesOpen',
            pass: true,
            messageKey: 'Photo.validation.eyesOpen.limitedAngle',
            severity: 'info',
          })
        } else {
          // Front, 45°, smile: both eyes visible — enforce
          mpChecks.push(checkEyesOpen(lm))
        }

        // ── Hair covering ──
        if (isNonFront) {
          // Hair at back/side is expected in non-front poses — skip
          mpChecks.push({
            name: 'hairClear',
            pass: true,
            messageKey: 'Photo.validation.hairClear.skippedTopHead',
            severity: 'info',
          })
        } else {
          mpChecks.push(checkHairCovering(lm))
        }

        // ── Face centered ──
        if (isNonFront) {
          // Face is naturally offset in profile/angle/top shots — skip centering check
          mpChecks.push({
            name: 'faceCentered',
            pass: true,
            messageKey: 'Photo.validation.correctPose.ok',
            severity: 'info',
          })
        } else {
          mpChecks.push(checkFaceCentered(lm))
        }

        // ── Face size (enforced for ALL poses) ──
        mpChecks.push(checkFaceSize(lm))

        // ── Glasses ──
        if (isProfile || isTopHead) {
          // Glasses detection is unreliable from side/top angles — skip
          mpChecks.push({
            name: 'noGlasses',
            pass: true,
            messageKey: 'Photo.validation.correctPose.ok',
            severity: 'info',
          })
        } else {
          // Front, 45°, smile: glasses are visible and should be detected
          mpChecks.push(checkGlasses(ctx, w, h, lm))
        }
      }
    }
  } catch (err) {
    // A thrown exception means the model failed to load/run entirely — no face checks
    // ran at all. This is NOT the same as "MediaPipe ran fine but found no face at an
    // extreme angle" (that case is handled above with a legitimate pass+info). Here we
    // have zero information about the photo, so it must not be treated as a pass —
    // otherwise a network/model failure would silently bypass every face-based check.
    console.error('[Photo Validation] MediaPipe detection failed:', err)
    mpChecks.push({
      name: 'mediaPipe',
      pass: false,
      messageKey: isNonFront
        ? 'Photo.validation.mediaPipe.unavailableAngle'
        : 'Photo.validation.mediaPipe.error',
      severity: 'error',
    })
  }

  const checks = [...canvasChecks, ...mpChecks]

  // ── Overall result ──
  let hasError = false
  let hasWarning = false

  // Message keys that represent auto-passed / inconclusive checks — exclude from overall scoring
  const INCONCLUSIVE_KEYS = new Set([
    'Photo.validation.faceDetected.limitedAngle',
    'Photo.validation.eyesOpen.limitedAngle',
    'Photo.validation.hairClear.skippedTopHead',
    'Photo.validation.correctPose.inconclusive',
    'Photo.validation.neutralExpression.inconclusive',
    'Photo.validation.hairClear.inconclusive',
  ])

  if (isFront) {
    // Front: every single check counts — strictest mode
    hasError   = checks.some((c) => !c.pass && c.severity === 'error')
    hasWarning = checks.some((c) => !c.pass && c.severity === 'warning')

  } else if (isAngle45 || isSmile) {
    // 45° and smile: MediaPipe detects faces reliably — enforce all meaningful checks.
    // Inconclusive/auto-pass checks are excluded so a no-face result on a 45° shot still errors.
    for (const c of checks) {
      if (c.pass || INCONCLUSIVE_KEYS.has(c.messageKey)) continue
      if (c.severity === 'error')   hasError   = true
      if (c.severity === 'warning') hasWarning = true
    }

  } else {
    // Full profile (leftProfile, rightProfile) and topHead:
    // Canvas errors always count. For landmark checks: include errors from checks that
    // actually ran (not auto-passed), and include correctPose + faceSize warnings
    // so a wrong-direction photo is still flagged even when no face was detected.
    hasError   = canvasChecks.some((c) => !c.pass && c.severity === 'error')
    hasWarning = canvasChecks.some((c) => !c.pass && c.severity === 'warning')

    for (const c of mpChecks) {
      if (c.pass || INCONCLUSIVE_KEYS.has(c.messageKey)) continue
      if (c.severity === 'error')   hasError   = true
      if (c.severity === 'warning') hasWarning = true
    }
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
