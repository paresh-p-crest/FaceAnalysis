/**
 * Resolves BEFORE images for protocol PDF / viewer feature pages.
 * Priority: cvReport / eyeAnalysis stored crops → live landmark crop → auxiliary pose photos.
 */

import {
  cropFeatureBefore,
  cropFeatureBeforeForPdf,
  normalizeToJpegDataUrl,
} from './aestheticProjection'

/** Min export px per feature — small regions must not expand into full-face crops. */
const FEATURE_MIN_PX = {
  nose: 200,
  lips: 200,
  eyes: 220,
  eyebrows: 200,
  cheeks: 260,
  jaw: 300,
  chin: 240,
  neck: 280,
  skin: 280,
  hair: 400,
  ears: 320,
}

function storedCrop(cvReport, eyeAnalysis, featureId) {
  switch (featureId) {
    case 'hair':
      return cvReport?.hair?.imageSrc || null
    case 'eyes':
      return eyeAnalysis?.eyesCrop || cvReport?.eyebrows?.crop || null
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
}) {
  const key = projectionId || featureId

  if (featureId === 'hair' && photos?.topHead) {
    return normalizeToJpegDataUrl(photos.topHead)
  }
  if (featureId === 'ears' && (photos?.rightProfile || photos?.leftProfile)) {
    return normalizeToJpegDataUrl(photos.rightProfile || photos.leftProfile)
  }

  // Prefer tight crops already computed during CV analysis
  const stored = storedCrop(cvReport, eyeAnalysis, featureId)
  if (stored) return stored

  const minPx = FEATURE_MIN_PX[key] || FEATURE_MIN_PX[featureId] || 280

  if (photoJpeg && landmarks?.length) {
    try {
      const cropped = await cropFeatureBeforeForPdf(photoJpeg, landmarks, key, minPx)
      if (cropped && !isFullFrameCrop(cropped, photoJpeg)) return cropped
    } catch {
      /* fall through */
    }
    try {
      const cropped = await cropFeatureBefore(photoJpeg, landmarks, key)
      if (cropped && !isFullFrameCrop(cropped, photoJpeg)) return cropped
    } catch {
      /* fall through */
    }
  }

  return photoJpeg || null
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
      const [beforeJpeg, profile] = await Promise.all([
        resolveFeatureBeforeImage({
          featureId: page.id,
          projectionId: page.projectionId,
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
          before: beforeJpeg,
          profile: profile?.src || null,
          profileIsReal: profile?.isRealProfile ?? false,
        },
      ]
    })
  )
  return Object.fromEntries(entries)
}
