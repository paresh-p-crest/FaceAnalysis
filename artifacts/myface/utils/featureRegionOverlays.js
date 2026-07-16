/**
 * Notebook-style filled region overlays for interactive chin/cheeks heroes.
 * Cheek indices from mediapipe_cheeks.ipynb.
 * Chin is geometric: lip→menton span with beard extension below landmark 152
 * (MediaPipe menton sits above thick goatees; notebook crescent sat on the sulcus).
 * Coords remapped into the existing hero crop's 0–100 space (no pixel re-crop).
 */

import { lm, bboxFullFace, bboxFromIndices, mergeBboxes, MOUTH } from './faceCrop.js'
import { getCheekAnalysisBox } from './cheekGuides.js'
import { getFeatureBox } from './aestheticProjection.js'

/** Lower-jaw oval arc (L→R through menton 152) — face contour, not labiomental. */
export const CHIN_JAW_ARC_INDICES = [
  172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397,
]

/** @deprecated kept for callers; chin fill is built geometrically in buildChinPointsInCrop. */
export const CHIN_REGION_INDICES = CHIN_JAW_ARC_INDICES

/** Viewer's-left / subject's-right cheek — mediapipe_cheeks.ipynb (final indices) */
export const RIGHT_CHEEK_REGION_INDICES = [
  114, 120, 47, 142, 203, 205, 207, 213, 215, 138, 132, 177, 147, 137, 234, 227,
  116, 117, 118, 119, 121,
]

/** Viewer's-right / subject's-left cheek */
export const LEFT_CHEEK_REGION_INDICES = [
  343, 349, 277, 371, 423, 425, 427, 433, 435, 367, 361, 401, 376, 366, 454, 447,
  345, 346, 347, 348, 350,
]

/** Match backend/cv_report.py cheek_box / chin_front_box when using baked imageSrc. */
const BACKEND_CHEEK_LEFT = [
  116, 117, 118, 119, 120, 121, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 213, 214, 215,
]
const BACKEND_CHEEK_RIGHT = [
  345, 346, 347, 348, 349, 350, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 433, 434, 435,
]
const BACKEND_CHIN = [
  152, 148, 176, 149, 150, 136, 176, 377, 400, 378, 379, 365, 397, 288, 361, 323, 145, 153, 154, 155,
]

function normalizeLandmarks(landmarks) {
  if (!landmarks?.length) return null
  if (landmarks[0]?.x != null && landmarks[0]?.id != null) {
    const arr = []
    landmarks.forEach((pt) => {
      arr[pt.id] = { x: pt.x, y: pt.y, z: pt.z || 0 }
    })
    return arr
  }
  if (landmarks[0]?.x != null) return landmarks
  if (Array.isArray(landmarks[0])) {
    return landmarks.map((p) => ({ x: p[0], y: p[1], z: p[2] ?? 0 }))
  }
  return null
}

function pointsInCropPct(landmarks, indices, box) {
  if (!box?.w || !box?.h) return null
  const pts = []
  for (const idx of indices) {
    const p = lm(landmarks, idx)
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null
    pts.push({
      x: ((p.x - box.x) / box.w) * 100,
      y: ((p.y - box.y) / box.h) * 100,
    })
  }
  return pts
}

/**
 * Closed Catmull-Rom → cubic Bezier path (periodic, interpolating).
 * Approximates notebook scipy splprep(per=True, s=0) + splev.
 * @param {{x:number,y:number}[]} points in any consistent space
 * @returns {string|null} SVG path `d`
 */
export function smoothClosedPath(points) {
  if (!points || points.length < 3) return null
  const n = points.length
  const tension = 1 / 6

  const at = (i) => points[((i % n) + n) % n]

  let d = `M ${at(0).x} ${at(0).y}`
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`
  }
  return `${d} Z`
}

function pathFromIndices(landmarks, indices, box) {
  const pts = pointsInCropPct(landmarks, indices, box)
  if (!pts) return null
  return smoothClosedPath(pts)
}

/**
 * Chin pad in crop-% space.
 * MediaPipe menton (152) sits on the bony tip — with a goatee the visible chin is lower.
 * Top edge is placed between lower lip and menton (below the labiomental sulcus);
 * bottom extends past menton along the lip→menton axis so the beard tip is covered.
 */
function buildChinPointsInCrop(landmarks, box) {
  if (!box?.w || !box?.h) return null
  const toPct = (idx) => {
    const p = lm(landmarks, idx)
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return null
    return {
      x: ((p.x - box.x) / box.w) * 100,
      y: ((p.y - box.y) / box.h) * 100,
    }
  }

  const lip = toPct(17) || toPct(18)
  const menton = toPct(152)
  if (!lip || !menton) return null

  const jaw = []
  for (const idx of CHIN_JAW_ARC_INDICES) {
    const p = toPct(idx)
    if (!p) return null
    jaw.push(p)
  }

  const span = Math.max(3, menton.y - lip.y)
  // Clear the sulcus under the lip; cover soft-tissue / beard below menton.
  const topY = lip.y + span * 0.48
  const beardTipY = Math.min(98, menton.y + span * 0.7)
  const drop = beardTipY - menton.y

  const mentonIdx = CHIN_JAW_ARC_INDICES.indexOf(152)
  const extendedJaw = jaw.map((p, i) => {
    if (i === mentonIdx) return { x: menton.x, y: beardTipY }
    // Pull lower-jaw points down toward the beard silhouette
    const t = Math.max(0, Math.min(1, (p.y - topY) / Math.max(1e-3, menton.y - topY)))
    return { x: p.x, y: Math.min(99, p.y + t * drop) }
  })

  const xs = extendedJaw.map((p) => p.x)
  const xLeft = Math.min(...xs)
  const xRight = Math.max(...xs)
  const topLeft = { x: xLeft + (menton.x - xLeft) * 0.2, y: topY }
  const topMid = { x: menton.x, y: topY }
  const topRight = { x: xRight - (xRight - menton.x) * 0.2, y: topY }
  const beardTip = { x: menton.x, y: beardTipY }

  // Clockwise: top L→R, right jaw inward, beard tip, left jaw outward
  return [
    topLeft,
    topMid,
    topRight,
    ...extendedJaw.slice(mentonIdx + 1).reverse(),
    beardTip,
    ...extendedJaw.slice(0, mentonIdx).reverse(),
  ]
}

function chinPathInCrop(landmarks, box) {
  const pts = buildChinPointsInCrop(landmarks, box)
  if (!pts || pts.length < 4) return null
  return smoothClosedPath(pts)
}

function usesParsingHero(featureId, featureParsing) {
  return (
    featureParsing?.status === 'ready' &&
    Boolean(featureParsing?.crops?.[featureId]?.publicUrl)
  )
}

/**
 * Convert SegFormer pixel bbox [x1,y1,x2,y2] → normalized crop box using front image size.
 */
export function parsingCropBox(featureParsing, featureId, imgW, imgH) {
  if (!usesParsingHero(featureId, featureParsing) || !imgW || !imgH) return null
  const bbox = featureParsing?.crops?.[featureId]?.bbox
  if (!Array.isArray(bbox) || bbox.length < 4) return null
  const [x1, y1, x2, y2] = bbox.map(Number)
  if (![x1, y1, x2, y2].every((n) => Number.isFinite(n)) || x2 <= x1 || y2 <= y1) return null
  return {
    x: x1 / imgW,
    y: y1 / imgH,
    w: (x2 - x1) / imgW,
    h: (y2 - y1) / imgH,
  }
}

function bakedCheekBox(landmarks) {
  return mergeBboxes(
    bboxFromIndices(landmarks, BACKEND_CHEEK_LEFT, 0.02),
    bboxFromIndices(landmarks, BACKEND_CHEEK_RIGHT, 0.02),
    0.015,
  )
}

function bakedChinBox(landmarks) {
  return mergeBboxes(
    bboxFromIndices(landmarks, MOUTH, 0.04),
    bboxFromIndices(landmarks, BACKEND_CHIN, 0.03),
    0.02,
  )
}

/**
 * Crop box matching whatever hero resolveFeatureHero will show.
 * Prefer real SegFormer bbox when the parsing crop is the hero.
 *
 * @param {'cheeks'|'chin'} featureId
 * @param {Array} landmarks
 * @param {object|null} featureParsing
 * @param {number|null} imgW front photo natural width (required for parsing bbox)
 * @param {number|null} imgH front photo natural height
 */
export function resolveFeatureHeroBox(featureId, landmarks, featureParsing = null, imgW = null, imgH = null) {
  const lmArr = normalizeLandmarks(landmarks)
  if (!lmArr?.length) return null

  const fromParsing = parsingCropBox(featureParsing, featureId, imgW, imgH)
  if (fromParsing) return fromParsing

  if (featureId === 'cheeks') {
    if (usesParsingHero('cheeks', featureParsing)) {
      // Parsing crop without measurable front size yet — skin≈face, tight pad
      return bboxFullFace(lmArr, 0.02)
    }
    return bakedCheekBox(lmArr) || getCheekAnalysisBox(lmArr)
  }

  if (featureId === 'chin') {
    if (usesParsingHero('chin', featureParsing)) {
      return bboxFullFace(lmArr, 0.02)
    }
    return bakedChinBox(lmArr) || getFeatureBox(lmArr, 'chin')
  }

  return null
}

function pathsForFeature(featureId, landmarks, box) {
  if (featureId === 'cheeks') {
    const right = pathFromIndices(landmarks, RIGHT_CHEEK_REGION_INDICES, box)
    const left = pathFromIndices(landmarks, LEFT_CHEEK_REGION_INDICES, box)
    return [right, left].filter(Boolean)
  }
  if (featureId === 'chin') {
    const path = chinPathInCrop(landmarks, box)
    return path ? [path] : []
  }
  return []
}

/**
 * @param {Array} landmarks
 * @param {object|null} [featureParsing]
 * @param {{x,y,w,h}|null} [cropBox] explicit box (preferred when from parsing bbox)
 * @param {number|null} [imgW]
 * @param {number|null} [imgH]
 * @returns {{ paths: string[], box: object } | null}
 */
export function buildCheekRegions(landmarks, featureParsing = null, cropBox = null, imgW = null, imgH = null) {
  const lmArr = normalizeLandmarks(landmarks)
  if (!lmArr?.length) return null
  const box = cropBox || resolveFeatureHeroBox('cheeks', lmArr, featureParsing, imgW, imgH)
  if (!box) return null
  const paths = pathsForFeature('cheeks', lmArr, box)
  if (!paths.length) return null
  return { paths, box }
}

/**
 * @returns {{ paths: string[], box: object } | null}
 */
export function buildChinRegion(landmarks, featureParsing = null, cropBox = null, imgW = null, imgH = null) {
  const lmArr = normalizeLandmarks(landmarks)
  if (!lmArr?.length) return null
  const box = cropBox || resolveFeatureHeroBox('chin', lmArr, featureParsing, imgW, imgH)
  if (!box) return null
  const paths = pathsForFeature('chin', lmArr, box)
  if (!paths.length) return null
  return { paths, box }
}
