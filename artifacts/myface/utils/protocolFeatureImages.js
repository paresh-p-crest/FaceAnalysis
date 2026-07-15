/**
 * Resolves BEFORE (and AFTER) images for protocol PDF / viewer feature pages.
 * BEFORE priority: live landmark crop (jaw/chin/ears/neck/hair/periorbital) or stored cvReport
 *   → then the other; see resolveFeatureBeforeImage.
 * AFTER: mirror that framing with projectedAnalysis.landmarks on projected/full; stored
 *   projectedAnalysis.cvReport crops are fallback only where live crop fails — backend boxes
 *   differ from getFeatureBox (esp. eyesCrop ≠ periorbital, ears.imageSrc = full face).
 *   When AFTER aspect/size ≠ BEFORE, cover-fit AFTER onto BEFORE canvas (AFTER-only; industry
 *   B&A same-format practice), remap landmarks, then crop. FEATURE_MIN_PX also scales by short side.
 */

import {
  cropFeatureBefore,
  cropFeatureBeforeForPdf,
  cropDualEyesForPdf,
  createMaskedFeaturePreview,
  getCropBox,
  normalizeToJpegDataUrl,
} from './aestheticProjection'
import { buildCheekAnalysisGuides, getCheekAnalysisBox } from './cheekGuides'
import { analyzeWithMediaPipe } from './mediapipeAnalysis'
import {
  coverFitAfterToBeforeCanvas,
  needsAfterCoverFitToBefore,
} from './alignAfterToBefore'

/** Min export px per feature — small regions must not expand into full-face crops. */
export const FEATURE_MIN_PX = {
  nose: 200,
  lips: 200,
  eyes: 220,
  eyebrows: 200,
  periorbital: 260,
  eyelashes: 200,
  underEye: 200,
  cheeks: 260,
  jaw: 300,
  chin: 240,
  neck: 280,
  skin: 280,
  hair: 400,
  ears: 320,
}

/**
 * Landmark crop key for AFTER so framing matches the BEFORE pair used on that page.
 * `null` = keep full projected face (protocol overview only).
 */
export function afterCropKeyForFeature(featureId) {
  switch (featureId) {
    case 'eyes':
      return 'periorbital'
    case 'overview':
    case 'full':
      return null
    default:
      return featureId
  }
}

function storedCrop(cvReport, eyeAnalysis, featureId) {
  switch (featureId) {
    case 'hair': {
      const hair = cvReport?.hair
      // Never use top-of-head photo for protocol BEFORE
      if (hair?.photoSource === 'topHead' || hair?.imageSrcTopHead === hair?.imageSrc) {
        return hair?.imageSrcFront || null
      }
      return hair?.imageSrcFront || hair?.imageSrc || null
    }
    case 'eyes':
      return eyeAnalysis?.eyesCrop || cvReport?.eyebrows?.crop || cvReport?.eyes?.ocular?.imageSrc || null
    case 'eyebrows':
      return cvReport?.eyebrows?.crop || cvReport?.eyes?.eyebrows?.imageSrc || null
    case 'nose':
      return cvReport?.nose?.imageSrc || null
    case 'cheeks':
      return cvReport?.cheeks?.imageSrc || null
    case 'jaw': {
      const jaw = cvReport?.jaw
      if (jaw?.photoSource === 'rightProfile') {
        return jaw.imageSrcFront || cvReport?.jawChin?.imageSrcFront || null
      }
      return jaw?.imageSrc || cvReport?.jawChin?.imageSrc || jaw?.imageSrcFront || null
    }
    case 'lips':
      return cvReport?.lips?.imageSrc || null
    case 'chin': {
      // Prefer frontal mouth/chin crop — never the right-profile full photo
      const chin = cvReport?.chin
      if (chin?.photoSource === 'rightProfile') {
        return chin.imageSrcFront || cvReport?.jawChin?.imageSrcFront || null
      }
      return chin?.imageSrc || cvReport?.jawChin?.imageSrc || chin?.imageSrcFront || null
    }
    case 'skin':
      return (
        cvReport?.cheeks?.imageSrc ||
        cvReport?.symmetry?.imageSrc ||
        cvReport?.faceShape?.imageSrc ||
        null
      )
    case 'neck':
      return cvReport?.neck?.imageSrc || null
    case 'ears': {
      // Frontal ear crop only — ignore profile photo bindings for BEFORE
      const ears = cvReport?.ears
      if (ears?.photoSource === 'profile' || ears?.photoSource === 'rightProfile') {
        return ears.imageSrcFront || null
      }
      return ears?.imageSrc || ears?.imageSrcFront || null
    }
    default:
      return null
  }
}

function isFullFrameCrop(dataUrl, photoJpeg) {
  if (!dataUrl || !photoJpeg) return false
  return dataUrl === photoJpeg
}

async function liveCrop(photoJpeg, landmarks, cropKey, minPx) {
  if (!photoJpeg || !landmarks?.length) return null
  try {
    const cropped = await cropFeatureBeforeForPdf(photoJpeg, landmarks, cropKey, minPx)
    if (cropped && !isFullFrameCrop(cropped, photoJpeg)) return cropped
  } catch {
    /* fall through */
  }
  try {
    const cropped = await cropFeatureBefore(photoJpeg, landmarks, cropKey)
    if (cropped && !isFullFrameCrop(cropped, photoJpeg)) return cropped
  } catch {
    /* fall through */
  }
  return null
}

/**
 * @returns {Promise<string|null>} JPEG data URL for the feature BEFORE slot
 */
export async function resolveFeatureBeforeImage({
  featureId,
  projectionId,
  photoJpeg,
  landmarks,
  cvReport,
  eyeAnalysis,
  photos,
  cropKey,
}) {
  const key = cropKey || projectionId || featureId

  // Hair: frontal hairline/forehead crop (not top-of-head scalp photo)
  if (featureId === 'hair' || key === 'hair') {
    const minPx = FEATURE_MIN_PX.hair
    const cropped = await liveCrop(photoJpeg, landmarks, 'hair', minPx)
    if (cropped) return cropped
    const stored = storedCrop(cvReport, eyeAnalysis, 'hair')
    if (stored) return stored
    return photoJpeg || null
  }

  // Chin / jaw / ears BEFORE use frontal crops (see liveCrop / storedCrop below).
  // Live-first here must stay aligned with AFTER_LIVE_FIRST_FEATURES in resolveFeatureAfterImage.
  // Jaw: front-facing lower-face crop (never right profile full photo)
  if (featureId === 'jaw' || key === 'jaw') {
    const minPx = FEATURE_MIN_PX.jaw
    const cropped = await liveCrop(photoJpeg, landmarks, 'jaw', minPx)
    if (cropped) return cropped
    const stored = storedCrop(cvReport, eyeAnalysis, 'jaw')
    if (stored) return stored
    return photoJpeg || null
  }

  // Ears: front-facing ear crop (never right/left profile full photo)
  if (featureId === 'ears' || key === 'ears') {
    const minPx = FEATURE_MIN_PX.ears
    const cropped = await liveCrop(photoJpeg, landmarks, 'ears', minPx)
    if (cropped) return cropped
    const stored = storedCrop(cvReport, eyeAnalysis, 'ears')
    if (stored) return stored
    return photoJpeg || null
  }

  // Chin: always frontal landmark crop when possible
  if (featureId === 'chin' || key === 'chin') {
    const minPx = FEATURE_MIN_PX.chin
    const cropped = await liveCrop(photoJpeg, landmarks, 'chin', minPx)
    if (cropped) return cropped
    const stored = storedCrop(cvReport, eyeAnalysis, 'chin')
    if (stored) return stored
    return photoJpeg || null
  }

  // Neck: prefer live lower-face+neck framing over legacy tight stored crops
  if (featureId === 'neck' || key === 'neck') {
    const minPx = FEATURE_MIN_PX.neck
    const cropped = await liveCrop(photoJpeg, landmarks, 'neck', minPx)
    if (cropped) return cropped
    const stored = storedCrop(cvReport, eyeAnalysis, 'neck')
    if (stored) return stored
    return photoJpeg || null
  }

  const stored = storedCrop(cvReport, eyeAnalysis, key === 'periorbital' ? 'eyes' : key)
  if (stored && key !== 'periorbital' && key !== 'eyelashes' && key !== 'underEye') {
    return stored
  }

  const minPx = FEATURE_MIN_PX[key] || FEATURE_MIN_PX[featureId] || 280
  const cropped = await liveCrop(photoJpeg, landmarks, key, minPx)
  if (cropped) return cropped

  return key === featureId ? (photoJpeg || null) : null
}

/**
 * Per-page image slots for PDF layout (brows vs eyes vs lips mask, etc.).
 */
export async function resolveFeatureImageSlots({
  featureId,
  photoJpeg,
  landmarks,
  cvReport,
  eyeAnalysis,
  photos,
  lipPreviewMask = 'oval',
}) {
  switch (featureId) {
    case 'eyes': {
      const [brows, periorbital, eyes, dualEyes] = await Promise.all([
        resolveFeatureBeforeImage({ featureId: 'eyes', cropKey: 'eyebrows', photoJpeg, landmarks, cvReport, eyeAnalysis, photos }),
        resolveFeatureBeforeImage({ featureId: 'eyes', cropKey: 'periorbital', photoJpeg, landmarks, cvReport, eyeAnalysis, photos }),
        resolveFeatureBeforeImage({ featureId: 'eyes', cropKey: 'eyes', photoJpeg, landmarks, cvReport, eyeAnalysis, photos }),
        photoJpeg && landmarks?.length ? cropDualEyesForPdf(photoJpeg, landmarks, 220) : null,
      ])
      return {
        before: periorbital || brows || eyes,
        pairBefore: periorbital || brows,
        preview: dualEyes || eyes,
        brows,
        eyes,
      }
    }
    case 'lips': {
      const lips = await resolveFeatureBeforeImage({ featureId: 'lips', photoJpeg, landmarks, cvReport, eyeAnalysis, photos })
      const maskShape = lipPreviewMask === 'contour' ? 'lipContour' : 'oval'
      const masked = photoJpeg && landmarks?.length
        ? await createMaskedFeaturePreview(photoJpeg, landmarks, 'lips', 200, { maskShape })
        : lips
      return { before: lips, preview: masked || lips, pairBefore: lips }
    }
    case 'cheeks': {
      const cheeks = await resolveFeatureBeforeImage({ featureId: 'cheeks', photoJpeg, landmarks, cvReport, eyeAnalysis, photos })
      // Same box as live cheek crop (getFeatureBox → getCheekAnalysisBox)
      const box = getCheekAnalysisBox(landmarks) || getCropBox(landmarks, 'cheeks')
      const guides = box && landmarks?.length ? buildCheekAnalysisGuides(landmarks, box) : null
      return {
        before: cheeks,
        analysis: cheeks,
        pairBefore: cheeks,
        overlayPoints: guides?.points || [],
        overlaySegments: guides?.segments || [],
      }
    }
    case 'jaw':
    case 'chin':
    case 'nose': {
      const main = await resolveFeatureBeforeImage({ featureId, photoJpeg, landmarks, cvReport, eyeAnalysis, photos })
      return { before: main, pairBefore: main }
    }
    default: {
      const main = await resolveFeatureBeforeImage({ featureId, photoJpeg, landmarks, cvReport, eyeAnalysis, photos })
      return { before: main, pairBefore: main }
    }
  }
}

/**
 * Profile inset — only when a real profile photo exists (no synthetic front-photo crop).
 * @returns {Promise<{ src: string, isRealProfile: boolean }|null>}
 */
export async function resolveProfileBeforeImage({ photos, cvReport }) {
  if (photos?.rightProfile) {
    return { src: await normalizeToJpegDataUrl(photos.rightProfile), isRealProfile: true }
  }
  if (photos?.leftProfile) {
    return { src: await normalizeToJpegDataUrl(photos.leftProfile), isRealProfile: true }
  }

  const nasoAural = cvReport?.proportions?.ratios?.nasoAural
  if (nasoAural?.photoSource === 'rightProfile' && nasoAural?.imageSrc) {
    return { src: nasoAural.imageSrc, isRealProfile: true }
  }

  return null
}

/**
 * Batch-resolve all feature page images for PDF / viewer.
 */
export async function resolveAllFeatureImages({
  featurePages,
  photoJpeg,
  landmarks,
  cvReport,
  eyeAnalysis,
  photos,
  lipPreviewMask = 'oval',
}) {
  const entries = await Promise.all(
    featurePages.map(async (page) => {
      const [slots, profile] = await Promise.all([
        resolveFeatureImageSlots({
          featureId: page.id,
          photoJpeg,
          landmarks,
          cvReport,
          eyeAnalysis,
          photos,
          lipPreviewMask,
        }),
        page.layoutHints?.profileImage
          ? resolveProfileBeforeImage({ photos, cvReport })
          : Promise.resolve(null),
      ])
      return [
        page.id,
        {
          before: slots.before,
          slots,
          profile: profile?.src || null,
          profileIsReal: profile?.isRealProfile ?? false,
        },
      ]
    })
  )
  return Object.fromEntries(entries)
}

/**
 * Features where protocol BEFORE always live-crops via getFeatureBox (see resolveFeatureBeforeImage).
 * Do NOT prefer projectedAnalysis.cvReport / eyeAnalysis stored crops for these — backend boxes differ:
 * - eyes: eyesCrop is eyes-only; BEFORE page uses periorbital (brows+eyes)
 * - ears: cvReport.ears.imageSrc is full-face, not an ear tile
 * - jaw / chin / neck / hair: Python crop pads ≠ frontend FEATURE_MIN_PX boxes
 * Keep this list in sync with resolveFeatureBeforeImage live-first branches.
 */
const AFTER_LIVE_FIRST_FEATURES = new Set(['eyes', 'jaw', 'chin', 'ears', 'neck', 'hair'])

/**
 * FEATURE_MIN_PX is absolute pixels tuned for typical front photos (~1200px short side).
 * Projected AFTER is often smaller (e.g. 896px); the same floor expands the box more and
 * makes AFTER look zoomed-out vs BEFORE. Scale the floor by afterShort/beforeShort so
 * expandBoxToMinSize applies comparable FOV on both. See expandBoxToMinSize in aestheticProjection.
 */
/**
 * Measure image pixel size { w, h } or null.
 */
async function measureImageSize(src) {
  if (!src || typeof src !== 'string') return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      resolve(w > 0 && h > 0 ? { w, h } : null)
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function measureImageShortSide(src) {
  const size = await measureImageSize(src)
  return size ? Math.min(size.w, size.h) : null
}

function scaleFeatureMinPx(baseMinPx, minPxScale) {
  if (!baseMinPx || baseMinPx <= 0) return 0
  const s = Number.isFinite(minPxScale) && minPxScale > 0 ? minPxScale : 1
  return Math.max(1, Math.round(baseMinPx * s))
}

/**
 * Crop / resolve AFTER for a feature page.
 * Mirror BEFORE framing: getFeatureBox live crop on AFTER mesh first for live-first features;
 * stored projectedAnalysis.cvReport as fallback (and primary for nose/lips/cheeks/…).
 * minPxScale: multiply FEATURE_MIN_PX by AFTER/BEFORE short-side ratio (pair zoom parity).
 * Half-split does not use this.
 *
 * @returns {Promise<string|null>} JPEG data URL (or original URL if normalize fails earlier)
 */
export async function resolveFeatureAfterImage({
  featureId,
  afterFullUrl,
  landmarks,
  afterLandmarks,
  afterCvReport = null,
  afterEyeAnalysis = null,
  cropKey,
  forPdf = false,
  minPxScale = 1,
}) {
  if (!afterFullUrl && !afterCvReport) return null

  const key =
    cropKey !== undefined ? cropKey : afterCropKeyForFeature(featureId)
  if (!key) {
    if (!afterFullUrl) return null
    try {
      return await normalizeToJpegDataUrl(afterFullUrl)
    } catch {
      return afterFullUrl
    }
  }

  const storedId = featureId === 'eyes' ? 'eyes' : featureId
  const liveFirst =
    AFTER_LIVE_FIRST_FEATURES.has(featureId) ||
    key === 'periorbital' ||
    key === 'eyelashes' ||
    key === 'underEye'

  let fullJpeg = null
  if (afterFullUrl) {
    try {
      fullJpeg = await normalizeToJpegDataUrl(afterFullUrl)
    } catch {
      fullJpeg = afterFullUrl
    }
  }

  const mesh =
    (Array.isArray(afterLandmarks) && afterLandmarks.length >= 10 && afterLandmarks) ||
    (Array.isArray(landmarks) && landmarks.length >= 10 && landmarks) ||
    null

  async function tryLiveCrop() {
    if (!fullJpeg || !mesh) return null
    const baseMin = FEATURE_MIN_PX[key] || FEATURE_MIN_PX[featureId] || 280
    // Scale absolute FEATURE_MIN_PX when AFTER canvas is smaller/larger than BEFORE
    const minPx = scaleFeatureMinPx(baseMin, minPxScale)
    if (forPdf || minPx > 0) {
      const cropped = await liveCrop(fullJpeg, mesh, key, minPx)
      if (cropped) return cropped
    }
    try {
      const cropped = await cropFeatureBefore(fullJpeg, mesh, key)
      if (cropped && !isFullFrameCrop(cropped, fullJpeg)) return cropped
    } catch {
      /* fall through */
    }
    return null
  }

  if (liveFirst) {
    const live = await tryLiveCrop()
    if (live) return live
    const fromCv = storedCrop(afterCvReport, afterEyeAnalysis, storedId)
    if (fromCv) return fromCv
    return fullJpeg || null
  }

  // Nose / lips / cheeks / eyebrows / … — stored crops usually match frontend boxes
  const fromCv = storedCrop(afterCvReport, afterEyeAnalysis, storedId)
  if (fromCv) return fromCv

  const live = await tryLiveCrop()
  if (live) return live
  return fullJpeg || null
}

/**
 * Batch-resolve AFTER images for feature pages.
 * Prefer AFTER landmarks + getFeatureBox (parity with BEFORE); stored cvReport where live-first
 * does not apply or live crop fails. Pass beforeFullUrl so AFTER can cover-fit to BEFORE canvas
 * (AR/size) and FEATURE_MIN_PX can scale with short-side ratio.
 * @returns {Promise<Record<string, string|null>>}
 */
export async function resolveAllFeatureAfterImages({
  featurePages,
  afterFullUrl,
  landmarks,
  afterLandmarks = null,
  afterCvReport = null,
  afterEyeAnalysis = null,
  beforeFullUrl = null,
  forPdf = false,
}) {
  if (!afterFullUrl && !afterCvReport) return {}

  let afterMesh = Array.isArray(afterLandmarks) && afterLandmarks.length >= 10 ? afterLandmarks : null
  let meshSource = afterMesh ? 'projectedAnalysis.landmarks (db) + getFeatureBox' : null

  let afterJpegNorm = afterFullUrl
  if (afterFullUrl) {
    try {
      afterJpegNorm = await normalizeToJpegDataUrl(afterFullUrl)
    } catch {
      afterJpegNorm = afterFullUrl
    }
  }

  let beforeNorm = null
  if (beforeFullUrl) {
    try {
      beforeNorm = await normalizeToJpegDataUrl(beforeFullUrl)
    } catch {
      beforeNorm = beforeFullUrl
    }
  }

  // Industry B&A: same format/canvas. Cover-fit AFTER onto BEFORE WxH when AR or size differs.
  // BEFORE unchanged; disk projected/full unchanged. Face-centered when AFTER mesh available.
  if (beforeNorm && afterJpegNorm) {
    const [beforeSize, afterSize] = await Promise.all([
      measureImageSize(beforeNorm),
      measureImageSize(afterJpegNorm),
    ])
    if (
      beforeSize &&
      afterSize &&
      needsAfterCoverFitToBefore(beforeSize.w, beforeSize.h, afterSize.w, afterSize.h)
    ) {
      try {
        const fitted = await coverFitAfterToBeforeCanvas(
          beforeNorm,
          afterJpegNorm,
          afterMesh
        )
        if (fitted?.dataUrl) {
          const beforeAr = (beforeSize.w / beforeSize.h).toFixed(3)
          const afterAr = (afterSize.w / afterSize.h).toFixed(3)
          console.info(
            `[MyFace] Feature AFTER cover-fit to BEFORE canvas ` +
              `(${afterSize.w}x${afterSize.h} ar=${afterAr} → ${beforeSize.w}x${beforeSize.h} ar=${beforeAr})` +
              (forPdf ? ' [pdf]' : ' [protocol]')
          )
          afterJpegNorm = fitted.dataUrl
          if (fitted.remappedLandmarks?.length >= 10) {
            afterMesh = fitted.remappedLandmarks
            meshSource = 'projectedAnalysis.landmarks remapped after cover-fit'
          } else {
            afterMesh = null
          }
        }
      } catch (err) {
        console.warn('[MyFace] Feature AFTER cover-fit failed; using native AFTER', err)
      }
    }
  }

  if (!afterMesh && afterJpegNorm) {
    try {
      const detected = await analyzeWithMediaPipe(afterJpegNorm)
      if (detected?.landmarks?.length >= 10) {
        afterMesh = detected.landmarks
        meshSource = 'client MediaPipe on AFTER + getFeatureBox'
      }
    } catch {
      /* fall through to BEFORE landmarks */
    }
  }
  if (!afterMesh && Array.isArray(landmarks) && landmarks.length >= 10) {
    meshSource = 'BEFORE landmarks (fallback) + getFeatureBox'
  }
  if (!meshSource && afterCvReport) {
    meshSource = 'projectedAnalysis.cvReport crops (db fallback only)'
  }

  // Pair zoom: scale absolute FEATURE_MIN_PX by AFTER/BEFORE short-side ratio
  // (usually ~1 after cover-fit onto BEFORE canvas; kept as safety).
  let minPxScale = 1
  if (beforeNorm && afterJpegNorm) {
    const [beforeShort, afterShort] = await Promise.all([
      measureImageShortSide(beforeNorm),
      measureImageShortSide(afterJpegNorm),
    ])
    if (beforeShort && afterShort) {
      minPxScale = afterShort / beforeShort
      if (Math.abs(minPxScale - 1) >= 0.04) {
        console.info(
          `[MyFace] Feature AFTER minPx scale ${minPxScale.toFixed(3)} ` +
            `(before short ${beforeShort}px → after ${afterShort}px)` +
            (forPdf ? ' [pdf]' : ' [protocol]')
        )
      }
    }
  }

  if (meshSource) {
    console.info(
      `[MyFace] Feature AFTER crops using ${meshSource}` +
        (afterMesh ? ` (${afterMesh.length} points)` : '') +
        (forPdf ? ' [pdf]' : ' [protocol]')
    )
  } else {
    console.warn('[MyFace] Feature AFTER crops: no landmarks or cvReport; using full AFTER')
  }

  const entries = await Promise.all(
    featurePages.map(async (page) => {
      const after = await resolveFeatureAfterImage({
        featureId: page.id,
        afterFullUrl: afterJpegNorm || afterFullUrl,
        landmarks,
        afterLandmarks: afterMesh,
        afterCvReport,
        afterEyeAnalysis,
        forPdf,
        minPxScale,
      })
      return [page.id, after]
    })
  )
  return Object.fromEntries(entries)
}
