/**
 * Cheek ANALYSIS guide geometry from MediaPipe landmarks (DB / analysis.landmarks).
 * Matches test.ipynb midface construction:
 * - ear-to-ear horizontal at blended nose-bridge / tip Y, extended 8% past ears
 * - absolute eye outer (130/359) → extended ear X at eye Y
 * - eye outer → outer nostril wing (102/331)
 * - extended cheek-line end → mouth corner (61/291)
 *
 * Coords are normalized 0–1 within the analysis crop box.
 */

import { lm } from './faceCrop.js'

/** Extend cheek / eye horizontals past the ear silhouette (notebook EXTENSION_FACTOR). */
const EXTENSION_FACTOR = 1.08

function normalizeLandmarks(landmarks) {
  if (!landmarks?.length) return null
  if (landmarks[0]?.x != null) return landmarks
  if (Array.isArray(landmarks[0])) {
    return landmarks.map((p) => ({ x: p[0], y: p[1], z: p[2] ?? 0 }))
  }
  return null
}

function asPoint(p) {
  if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null
  return { x: p.x, y: p.y }
}

function toCrop(p, box) {
  if (!p || !box?.w || !box?.h) return null
  return {
    x: (p.x - box.x) / box.w,
    y: (p.y - box.y) / box.h,
  }
}

/**
 * Midface box large enough for notebook cheek guides (eyes → extended ears → mouth).
 */
export function getCheekAnalysisBox(landmarks) {
  const lmArr = normalizeLandmarks(landmarks)
  if (!lmArr?.length) return null
  const ids = [130, 263, 359, 102, 331, 61, 291, 234, 454, 197, 2, 116, 345]
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const id of ids) {
    const p = asPoint(lm(lmArr, id))
    if (!p) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (maxX <= minX || maxY <= minY) return null
  // Extra pad for 1.08× ear extension past silhouette
  const padX = (maxX - minX) * 0.14
  const padY = (maxY - minY) * 0.12
  const x = Math.max(0, minX - padX)
  const y = Math.max(0, minY - padY)
  const x2 = Math.min(1, maxX + padX)
  const y2 = Math.min(1, maxY + padY)
  return { x, y, w: Math.max(0.2, x2 - x), h: Math.max(0.15, y2 - y) }
}

/**
 * @param {Array|{x,y}[]} landmarks 478 MediaPipe points from assessment
 * @param {{x,y,w,h}|null} cropBox analysis crop in image norm space
 * @returns {{ segments: Array<{x1,y1,x2,y2}>, points: Array<{x,y}> } | null}
 */
export function buildCheekAnalysisGuides(landmarks, cropBox) {
  const lmArr = normalizeLandmarks(landmarks)
  if (!lmArr?.length || !cropBox?.w) return null

  const p = (idx) => asPoint(lm(lmArr, idx))
  // Outer eye corners: 130 (right) matches notebook; left 359 often sits in the
  // iris — use 263 then push toward the ear so the vertex clears the sclera
  // (mirrors the right-side “just outside the eye” placement).
  const rEye = p(130)
  const lOuter = p(263) || p(359)
  const rNostril = p(102)
  const lNostril = p(331)
  const rMouth = p(61)
  const lMouth = p(291)
  const rEar = p(234)
  const lEar = p(454)
  const bridge = p(197)
  const tip = p(2)
  if (!rEye || !lOuter || !rEar || !lEar || !bridge || !tip) return null

  // Clear the left eyeball: push past outer canthus toward temple/ear
  // (0.22 was still on sclera after cover mismatch; 0.38 clears like the right side)
  const lEye = {
    x: lOuter.x + (lEar.x - lOuter.x) * 0.38,
    y: lOuter.y,
  }

  // Notebook: blend mid-nose bridge + tip so the cheek line sits slightly lower
  const targetY = bridge.y * 0.6 + tip.y * 0.4
  const faceCenterX = (rEar.x + lEar.x) / 2
  const extendedRx = faceCenterX + (rEar.x - faceCenterX) * EXTENSION_FACTOR
  const extendedLx = faceCenterX + (lEar.x - faceCenterX) * EXTENSION_FACTOR

  const rLineEnd = { x: extendedRx, y: targetY }
  const lLineEnd = { x: extendedLx, y: targetY }
  const rEyeExt = { x: extendedRx, y: rEye.y }
  const lEyeExt = { x: extendedLx, y: lEye.y }

  const rawSegs = [
    [rLineEnd, lLineEnd],
    [rEye, rEyeExt],
    [lEye, lEyeExt],
    [rEye, rNostril],
    [lEye, lNostril],
    [rLineEnd, rMouth],
    [lLineEnd, lMouth],
  ]

  const segments = []
  const points = []
  for (const [a, b] of rawSegs) {
    if (!a || !b) continue
    const ca = toCrop(a, cropBox)
    const cb = toCrop(b, cropBox)
    if (!ca || !cb) continue
    segments.push({ x1: ca.x, y1: ca.y, x2: cb.x, y2: cb.y })
    points.push(ca, cb)
  }
  if (!segments.length) return null
  return { segments, points }
}
