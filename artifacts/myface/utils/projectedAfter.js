/** Resolve persisted full-face projected AFTER URL from assessment payload. */

export function resolveProjectedAfterUrl(projectedAfter) {
  if (!projectedAfter || projectedAfter.status !== 'ready') return null
  return projectedAfter.full?.publicUrl || null
}

/**
 * AFTER mesh from DB projected_analysis — only when CV on projected/full succeeded.
 * @returns {Array|null} overlay-style landmarks or null
 */
export function resolveAfterLandmarks(projectedAnalysis) {
  if (!projectedAnalysis || projectedAnalysis.status !== 'ready') return null
  const lm = projectedAnalysis.landmarks
  if (!Array.isArray(lm) || lm.length < 10) return null
  return lm
}

/**
 * AFTER cvReport + eyeAnalysis from projected_analysis (same crop fields as BEFORE analysis).
 * Protocol feature AFTER does not prefer these for eyes/jaw/chin/ears — see AFTER_LIVE_FIRST_FEATURES
 * in protocolFeatureImages.js (backend crop boxes ≠ frontend getFeatureBox).
 * @returns {{ cvReport: object, eyeAnalysis: object|null }|null}
 */
export function resolveAfterCvPayload(projectedAnalysis) {
  if (!projectedAnalysis || projectedAnalysis.status !== 'ready') return null
  const cvReport = projectedAnalysis.cvReport
  if (!cvReport || typeof cvReport !== 'object') return null
  return {
    cvReport,
    eyeAnalysis: projectedAnalysis.eyeAnalysis || null,
  }
}
