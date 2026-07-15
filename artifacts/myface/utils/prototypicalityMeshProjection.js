import { lm } from './faceCrop'
import { PROTOTYPICALITY_MESH_CONNECTIONS } from './faceMeshConnections'

/**
 * Build a front x/y MediaPipe feature mesh from landmarks (notebook CONNECTIONS).
 * Fits segments into a padded square viewBox (0–100) with uniform scale.
 *
 * @returns {{ viewBox: string, segments: Array<{ x1: number, y1: number, x2: number, y2: number }> } | null}
 */
export function buildFrontMeshProjection(landmarks) {
  if (!landmarks?.length) return null

  const raw = []
  for (const edges of PROTOTYPICALITY_MESH_CONNECTIONS) {
    for (const [a, b] of edges) {
      const pa = lm(landmarks, a)
      const pb = lm(landmarks, b)
      raw.push({
        x1: pa.x,
        y1: pa.y,
        x2: pb.x,
        y2: pb.y,
      })
    }
  }
  if (!raw.length) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of raw) {
    minX = Math.min(minX, s.x1, s.x2)
    minY = Math.min(minY, s.y1, s.y2)
    maxX = Math.max(maxX, s.x1, s.x2)
    maxY = Math.max(maxY, s.y1, s.y2)
  }

  const spanX = Math.max(maxX - minX, 1e-4)
  const spanY = Math.max(maxY - minY, 1e-4)
  const pad = 0.08
  const size = Math.max(spanX, spanY) * (1 + pad * 2)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const originX = cx - size / 2
  const originY = cy - size / 2

  const segments = raw.map((s) => ({
    x1: ((s.x1 - originX) / size) * 100,
    y1: ((s.y1 - originY) / size) * 100,
    x2: ((s.x2 - originX) / size) * 100,
    y2: ((s.y2 - originY) / size) * 100,
  }))

  return {
    viewBox: '0 0 100 100',
    segments,
  }
}
