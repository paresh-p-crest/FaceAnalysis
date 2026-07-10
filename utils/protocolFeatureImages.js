/**
 * Resolves BEFORE images for protocol PDF / viewer feature pages.
 * Priority: cvReport / eyeAnalysis stored crops → live landmark crop → auxiliary pose photos.
 */

import {
  cropFeatureBefore,
  cropFeatureBeforeForPdf,
  cropDualEyesForPdf,
  createMaskedFeaturePreview,
  featureOverlayPoints,
  getCropBox,
  normalizeToJpegDataUrl,
} from './aestheticProjection'

/** Min export px per feature — small regions must not expand into full-face crops. */
const FEATURE_MIN_PX = {
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

const CHEEK_OVERLAY_INDICES = [116, 123, 50, 280, 345, 352, 234, 454]

function storedCrop(cvReport, eyeAnalysis, featureId) {
  switch (featureId) {
    case 'hair':
      return cvReport?.hair?.imageSrc || null
    case 'eyes':
      return eyeAnalysis?.eyesCrop || cvReport?.eyebrows?.crop || cvReport?.eyes?.ocular?.imageSrc || null
    case 'eyebrows':
      return cvReport?.eyebrows?.crop || cvReport?.eyes?.eyebrows?.imageSrc || null
    case 'nose':
      return cvReport?.nose?.imageSrc || null
    case 'cheeks':
      return cvReport?.cheeks?.imageSrc || null
    case 'jaw':
      return cvReport?.jaw?.imageSrc || cvReport?.jawChin?.imageSrc || null
    case 'lips':
      return cvReport?.lips?.imageSrc || null
    case 'chin':
      return cvReport?.chin?.imageSrc || cvReport?.jawChin?.imageSrc || null
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
      if (cvReport?.ears?.imageSrcRight) return cvReport.ears.imageSrcRight
      if (cvReport?.ears?.imageSrcLeft) return cvReport.ears.imageSrcLeft
      const nasoAural = cvReport?.proportions?.ratios?.nasoAural
      if (nasoAural?.photoSource === 'rightProfile' && nasoAural?.imageSrc) {
        return nasoAural.imageSrc
      }
      return cvReport?.ears?.imageSrc || null
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

  if (featureId === 'hair' && photos?.topHead) {
    return normalizeToJpegDataUrl(photos.topHead)
  }
  if (featureId === 'ears' && (photos?.rightProfile || photos?.leftProfile)) {
    return normalizeToJpegDataUrl(photos.rightProfile || photos.leftProfile)
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
}) {
  switch (featureId) {
    case 'eyes': {
      const [brows, periorbital, eyes, dualEyes] = await Promise.all([
        resolveFeatureBeforeImage({ featureId: 'eyes', cropKey: 'eyebrows', photoJpeg, landmarks, cvReport, eyeAnalysis, photos }),
        resolveFeatureBeforeImage({ featureId: 'eyes', cropKey: 'periorbital', photoJpeg, landmarks, cvReport, eyeAnalysis, photos }),
        resolveFeatureBeforeImage({ featureId: 'eyes', cropKey: 'eyes', photoJpeg, landmarks, cvReport, eyeAnalysis, photos }),
        photoJpeg && landmarks?.length ? cropDualEyesForPdf(photoJpeg, landmarks, 160) : null,
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
      const masked = photoJpeg && landmarks?.length
        ? await createMaskedFeaturePreview(photoJpeg, landmarks, 'lips', 200)
        : lips
      return { before: lips, preview: masked || lips, pairBefore: lips }
    }
    case 'cheeks': {
      const cheeks = await resolveFeatureBeforeImage({ featureId: 'cheeks', photoJpeg, landmarks, cvReport, eyeAnalysis, photos })
      const box = getCropBox(landmarks, 'cheeks')
      const overlayPoints = box && landmarks?.length
        ? featureOverlayPoints(landmarks, box, CHEEK_OVERLAY_INDICES)
        : []
      return { before: cheeks, analysis: cheeks, pairBefore: cheeks, overlayPoints }
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
