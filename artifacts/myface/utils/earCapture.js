/** Ear capture quality — mirrors backend/ear_analysis.py evaluate_ear_capture(). */

export const EAR_CAPTURE = {
  maxEdge: 0.15,
  minMeanConf: 0.28,
  helixYMin: 0.12,
  helixYMax: 0.52,
  lobeYMax: 0.68,
  vertMin: 0.05,
  vertMax: 0.26,
  rearXRightMin: 0.52,
  rearXLeftMax: 0.48,
  maxRepaired: 3,
}

function hasEarMeasurements(side) {
  const m = side?.measurements || {}
  return Boolean(m.verticalHeightNorm && m.helixTop && (m.softBottom || m.lobeBottom))
}

export function evaluateEarCapture(side) {
  const failed = { proper: false, score: 0, checks: { status: false } }
  if (!side || side.status !== 'ready' || !hasEarMeasurements(side)) return failed

  const m = side.measurements
  const helixY = Number(m.helixTop?.y)
  const lobeY = Number((m.softBottom || m.lobeBottom)?.y)
  const vertH = Number(m.verticalHeightNorm)
  const xMin = Number(m.xMinNorm)
  const xMax = Number(m.xMaxNorm)
  if (![helixY, lobeY, vertH].every(Number.isFinite)) return { ...failed, checks: { parse: false } }

  const confs = side.confidences || []
  const meanConf = confs.length ? confs.reduce((a, b) => a + Number(b), 0) / confs.length : 0
  const ec = Number(side.edgeCollapseFrac ?? 1)
  const repairedN = (side.repairedIndices || []).length
  const facingRight = side.poseId !== 'leftProfile'
  const C = EAR_CAPTURE

  const checks = {
    status: true,
    edge_ok: ec <= C.maxEdge,
    confidence_ok: meanConf >= C.minMeanConf,
    helix_band_ok: helixY >= C.helixYMin && helixY <= C.helixYMax,
    lobe_band_ok: lobeY >= helixY + 0.03 && lobeY <= C.lobeYMax,
    height_ok: vertH >= C.vertMin && vertH <= C.vertMax,
    rear_side_ok: facingRight ? xMax >= C.rearXRightMin : xMin <= C.rearXLeftMax,
    contour_ok: repairedN <= C.maxRepaired,
  }
  const proper = Object.values(checks).every(Boolean)
  const score = Object.values(checks).filter(Boolean).length / Object.keys(checks).length
  return { proper, score, meanConfidence: meanConf, checks }
}

export function isProperEarSide(side) {
  if (side?.earCapture && typeof side.earCapture.proper === 'boolean') {
    return side.earCapture.proper
  }
  return evaluateEarCapture(side).proper
}

/** Right profile first; left only when right fails earCapture gate. */
export function pickProfileEarSide(ears) {
  if (ears?.earLandmarkSource !== 'ear_landmarker') return null
  const sides = ears?.sides || {}
  for (const key of ['right', 'left']) {
    const side = sides[key]
    if (isProperEarSide(side)) return side
  }
  return null
}

export function resolveMeasurementProfilePose(ears, fallback = null) {
  if (!ears) return fallback
  const admin = ears.adminMeasurementProfilePose
  if (admin === 'leftProfile' || admin === 'rightProfile') return admin
  const byPose = ears.nasoAuralByPose || {}
  if (Object.keys(byPose).length) {
    if (byPose.rightProfile) return 'rightProfile'
    if (byPose.leftProfile) return 'leftProfile'
  }
  const side = pickProfileEarSide(ears)
  if (side?.poseId) return side.poseId
  const stored = ears.measurementProfilePose
  if (stored === 'leftProfile' || stored === 'rightProfile') return stored
  return fallback
}

export function resolveNasoAuralVariant(ears, poseId = null) {
  if (!ears) return null
  const pose = poseId || resolveMeasurementProfilePose(ears)
  if (!pose) return null
  return ears.nasoAuralByPose?.[pose] || null
}
