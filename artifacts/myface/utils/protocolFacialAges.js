/** Default when front visualAge is missing (matches backend visual_age base). */
export const PROTOCOL_FACE_AGE_FALLBACK = 28

function parseVisualAge(value) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

/**
 * Protocol page-1 facial ages (display only; does not rewrite DB).
 * Current = front metrics/cvReport visualAge, else 28.
 * Potential = AFTER projectedAnalysis.metrics.visualAge when ready, else current−5;
 * then clamp into [current−8, current−1] (if ≥ current → current−2 first).
 */
export function resolveProtocolFacialAges({ metrics, cvReport, projectedAnalysis } = {}) {
  const frontRaw =
    parseVisualAge(metrics?.visualAge)
    ?? parseVisualAge(cvReport?.overall?.visualAge)
  const faceAge = frontRaw ?? PROTOCOL_FACE_AGE_FALLBACK

  let rawPotential = null
  if (projectedAnalysis?.status === 'ready') {
    rawPotential =
      parseVisualAge(projectedAnalysis?.metrics?.visualAge)
      ?? parseVisualAge(projectedAnalysis?.cvReport?.overall?.visualAge)
  }
  if (rawPotential == null) rawPotential = faceAge - 5

  let potentialAge = rawPotential
  if (potentialAge >= faceAge) potentialAge = faceAge - 2
  const floor = faceAge - 8
  const ceiling = faceAge - 1
  if (potentialAge < floor) potentialAge = floor
  if (potentialAge > ceiling) potentialAge = ceiling

  return { faceAge, potentialAge }
}

function selfCheckProtocolFacialAges() {
  const miss = resolveProtocolFacialAges({})
  if (miss.faceAge !== 28 || miss.potentialAge !== 23) {
    throw new Error('protocol ages: missing front → 28 / 23')
  }
  const plain = resolveProtocolFacialAges({ metrics: { visualAge: 40 } })
  if (plain.faceAge !== 40 || plain.potentialAge !== 35) {
    throw new Error('protocol ages: fallback potential = current−5')
  }
  const after = resolveProtocolFacialAges({
    metrics: { visualAge: 40 },
    projectedAnalysis: { status: 'ready', metrics: { visualAge: 33 } },
  })
  if (after.faceAge !== 40 || after.potentialAge !== 33) {
    throw new Error('protocol ages: AFTER visualAge in window')
  }
  const high = resolveProtocolFacialAges({
    metrics: { visualAge: 40 },
    projectedAnalysis: { status: 'ready', metrics: { visualAge: 42 } },
  })
  if (high.potentialAge !== 38) {
    throw new Error('protocol ages: potential ≥ current → current−2')
  }
  const low = resolveProtocolFacialAges({
    metrics: { visualAge: 40 },
    projectedAnalysis: { status: 'ready', metrics: { visualAge: 20 } },
  })
  if (low.potentialAge !== 32) {
    throw new Error('protocol ages: potential < current−8 → current−8')
  }
  const notReady = resolveProtocolFacialAges({
    metrics: { visualAge: 40 },
    projectedAnalysis: { status: 'failed', metrics: { visualAge: 20 } },
  })
  if (notReady.potentialAge !== 35) {
    throw new Error('protocol ages: non-ready AFTER ignored')
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('protocolFacialAges')) {
  selfCheckProtocolFacialAges()
}
