/** Coerce photo metadata or string to a usable URL (never `[object Object]`). */
export function coercePhotoUrl(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'object') {
    if (typeof value.publicUrl === 'string' && value.publicUrl.trim()) return value.publicUrl.trim()
    if (typeof value.url === 'string' && value.url.trim()) return value.url.trim()
    if (typeof value.src === 'string' && value.src.trim()) return value.src.trim()
  }
  return null
}

/** Front photo URL from a cloud assessment GET or list payload. */
export function resolveAssessmentFrontPhoto(assessment) {
  const stored = assessment?.photos || {}
  const fromStored = coercePhotoUrl(stored.front)
  if (fromStored) return fromStored
  const report = assessment?.analysis?.cvReport
  return (
    coercePhotoUrl(report?.faceShape?.imageSrc)
    || coercePhotoUrl(report?.symmetry?.imageSrc)
    || coercePhotoUrl(report?.proportions?.imageSrc)
    || coercePhotoUrl(report?.nose?.imageSrc)
    || null
  )
}

/** Front photo URL — baseline for AI visual comparisons (hair/outfit/aging). */
export function resolveAssessmentAiVisualsBaseline(assessment) {
  return resolveAssessmentFrontPhoto(assessment)
}

/** Display URL for an AI visual imageSrc (media URL, legacy data URL, or { publicUrl }). */
export function resolveAiVisualImageSrc(value) {
  return coercePhotoUrl(value)
}

/** Outfit slider BEFORE — white-tee baseline when generated, else front photo. */
export function resolveAssessmentOutfitBaseline(assessment) {
  const baseline = assessment?.aiVisuals?.outfitBaseline
  const fromBaseline = resolveAiVisualImageSrc(
    baseline && typeof baseline === 'object' ? baseline.imageSrc : baseline,
  )
  if (fromBaseline) return fromBaseline
  return resolveAssessmentFrontPhoto(assessment)
}

/**
 * Pose map of URL strings for PDF / UI (not `{ publicUrl }` metadata).
 * Matches AppProvider hydratePhotosFromAssessment shape.
 */
export function resolveAssessmentPosePhotos(assessment) {
  const hydrated = {
    front: null,
    leftProfile: null,
    rightProfile: null,
    left45: null,
    right45: null,
    smile: null,
    topHead: null,
  }
  const stored = assessment?.photos || {}
  Object.entries(stored).forEach(([poseId, meta]) => {
    const url = coercePhotoUrl(meta)
    if (url) hydrated[poseId] = url
  })
  const reportPhotos = assessment?.analysis?.cvReport?.photos || {}
  Object.entries(reportPhotos).forEach(([poseId, url]) => {
    const coerced = coercePhotoUrl(url)
    if (coerced && !hydrated[poseId]) hydrated[poseId] = coerced
  })
  if (!hydrated.front) hydrated.front = resolveAssessmentFrontPhoto(assessment)
  return hydrated
}
