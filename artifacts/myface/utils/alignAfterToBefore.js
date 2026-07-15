/**
 * Warp / fit AFTER onto BEFORE's pixel canvas. Does not modify BEFORE.
 *
 * - alignAfterToBefore: MediaPipe similarity (overview / skin half-split).
 * - coverFitAfterToBeforeCanvas: post-capture format match (feature AFTER pairs) —
 *   industry B&A practice: same aspect + canvas size; framing may be adjusted in software.
 */

import { analyzeWithMediaPipe } from './mediapipeAnalysis'

/** Stable MediaPipe Face Mesh indices for similarity fit. */
const ANCHOR_INDICES = [
  33, 133, // left eye outer / inner
  362, 263, // right eye inner / outer
  1, // nose tip
  61, 291, // mouth corners
  10, // brow center-ish
]

/** Coarse face oval — center of mass for face-aware cover crop. */
const FACE_CENTER_INDICES = [10, 152, 234, 454, 1, 61, 291]

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function landmarksToPixels(landmarks, w, h, indices) {
  const pts = []
  for (const i of indices) {
    const lm = landmarks[i]
    if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') continue
    pts.push({ x: lm.x * w, y: lm.y * h })
  }
  return pts
}

function faceCenterPixels(landmarks, w, h) {
  const pts = landmarksToPixels(landmarks, w, h, FACE_CENTER_INDICES)
  if (pts.length < 3) return null
  let cx = 0
  let cy = 0
  for (const p of pts) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / pts.length, y: cy / pts.length }
}

/**
 * Umeyama 2D similarity: maps src → dst as s * R * p + t.
 * @returns {{ a: number, b: number, tx: number, ty: number } | null}
 *   where x' = a*x - b*y + tx, y' = b*x + a*y + ty  (a = s cos θ, b = s sin θ)
 */
function estimateSimilarity(srcPts, dstPts) {
  const n = Math.min(srcPts.length, dstPts.length)
  if (n < 2) return null

  let srcCx = 0
  let srcCy = 0
  let dstCx = 0
  let dstCy = 0
  for (let i = 0; i < n; i++) {
    srcCx += srcPts[i].x
    srcCy += srcPts[i].y
    dstCx += dstPts[i].x
    dstCy += dstPts[i].y
  }
  srcCx /= n
  srcCy /= n
  dstCx /= n
  dstCy /= n

  let sxx = 0
  let syy = 0
  let sxy = 0
  let syx = 0
  let srcVar = 0
  for (let i = 0; i < n; i++) {
    const sx = srcPts[i].x - srcCx
    const sy = srcPts[i].y - srcCy
    const dx = dstPts[i].x - dstCx
    const dy = dstPts[i].y - dstCy
    sxx += sx * dx
    syy += sy * dy
    sxy += sx * dy
    syx += sy * dx
    srcVar += sx * sx + sy * sy
  }
  if (srcVar < 1e-6) return null

  const a = (sxx + syy) / srcVar
  const b = (sxy - syx) / srcVar
  const scale = Math.hypot(a, b)
  if (!Number.isFinite(scale) || scale < 0.05 || scale > 20) return null

  const tx = dstCx - (a * srcCx - b * srcCy)
  const ty = dstCy - (b * srcCx + a * srcCy)
  return { a, b, tx, ty }
}

/**
 * Compute cover-fit source window on AFTER for BEFORE canvas.
 * Face-centered when landmarks available (ASPS-style anatomical framing).
 * @returns {{ scale: number, sx: number, sy: number, sw: number, sh: number, bw: number, bh: number, aw: number, ah: number }}
 */
export function computeCoverFitWindow(bw, bh, aw, ah, afterLandmarks = null) {
  const scale = Math.max(bw / aw, bh / ah)
  const sw = bw / scale
  const sh = bh / scale
  let sx = (aw - sw) / 2
  let sy = (ah - sh) / 2
  const face = afterLandmarks?.length >= 10 ? faceCenterPixels(afterLandmarks, aw, ah) : null
  if (face) {
    sx = face.x - sw / 2
    sy = face.y - sh / 2
  }
  sx = Math.max(0, Math.min(aw - sw, sx))
  sy = Math.max(0, Math.min(ah - sh, sy))
  return { scale, sx, sy, sw, sh, bw, bh, aw, ah }
}

/** Cover-fit AFTER into BEFORE pixel size (no rotation). Returns JPEG data URL. */
function coverFitToBefore(beforeImg, afterImg, afterLandmarks = null) {
  const bw = beforeImg.naturalWidth || beforeImg.width
  const bh = beforeImg.naturalHeight || beforeImg.height
  const aw = afterImg.naturalWidth || afterImg.width
  const ah = afterImg.naturalHeight || afterImg.height
  const win = computeCoverFitWindow(bw, bh, aw, ah, afterLandmarks)
  const canvas = document.createElement('canvas')
  canvas.width = bw
  canvas.height = bh
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, bw, bh)
  ctx.drawImage(afterImg, win.sx, win.sy, win.sw, win.sh, 0, 0, bw, bh)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), window: win }
}

/**
 * Remap overlay landmarks from AFTER image space → cover-fitted BEFORE canvas space.
 * Normalized coords stay valid for getFeatureBox on the fitted JPEG.
 */
export function remapLandmarksThroughCoverFit(landmarks, win) {
  if (!Array.isArray(landmarks) || landmarks.length < 10 || !win) return null
  const { scale, sx, sy, bw, bh, aw, ah } = win
  if (!bw || !bh || !aw || !ah) return null
  return landmarks.map((lm) => {
    if (!lm || typeof lm.x !== 'number' || typeof lm.y !== 'number') return lm
    const px = lm.x * aw
    const py = lm.y * ah
    const ox = (px - sx) * scale
    const oy = (py - sy) * scale
    return {
      ...lm,
      x: Math.max(0, Math.min(1, ox / bw)),
      y: Math.max(0, Math.min(1, oy / bh)),
    }
  })
}

/**
 * Match AFTER format to BEFORE canvas (same W×H / aspect) for fair feature pairs.
 * Industry: same presentation format; post-capture section adjust is accepted.
 * Face-centered cover when afterLandmarks provided. Does not modify BEFORE or disk.
 *
 * @returns {Promise<{ dataUrl: string, window: object, remappedLandmarks: Array|null }|null>}
 */
export async function coverFitAfterToBeforeCanvas(beforeSrc, afterSrc, afterLandmarks = null) {
  if (!beforeSrc || !afterSrc) return null
  const [beforeImg, afterImg] = await Promise.all([loadImage(beforeSrc), loadImage(afterSrc)])
  const bw = beforeImg.naturalWidth || beforeImg.width
  const bh = beforeImg.naturalHeight || beforeImg.height
  const aw = afterImg.naturalWidth || afterImg.width
  const ah = afterImg.naturalHeight || afterImg.height
  if (!bw || !bh || !aw || !ah) return null

  const { dataUrl, window } = coverFitToBefore(beforeImg, afterImg, afterLandmarks)
  const remapped = remapLandmarksThroughCoverFit(afterLandmarks, window)
  return { dataUrl, window, remappedLandmarks: remapped }
}

/** True when AR or pixel size differs enough to warrant cover-fit onto BEFORE canvas. */
export function needsAfterCoverFitToBefore(beforeW, beforeH, afterW, afterH) {
  if (!beforeW || !beforeH || !afterW || !afterH) return false
  const beforeAr = beforeW / beforeH
  const afterAr = afterW / afterH
  if (Math.abs(beforeAr - afterAr) / beforeAr > 0.02) return true
  if (Math.abs(beforeW - afterW) > 2 || Math.abs(beforeH - afterH) > 2) return true
  return false
}

/**
 * @param {string} beforeSrc - BEFORE image (data URL or URL); left unchanged
 * @param {string} afterSrc - AFTER image to warp onto BEFORE canvas
 * @returns {Promise<string>} JPEG data URL of AFTER aligned to BEFORE size/pose
 */
export async function alignAfterToBefore(beforeSrc, afterSrc) {
  if (!beforeSrc || !afterSrc) return afterSrc || null

  const [beforeImg, afterImg] = await Promise.all([loadImage(beforeSrc), loadImage(afterSrc)])
  const bw = beforeImg.naturalWidth || beforeImg.width
  const bh = beforeImg.naturalHeight || beforeImg.height
  const aw = afterImg.naturalWidth || afterImg.width
  const ah = afterImg.naturalHeight || afterImg.height
  if (!bw || !bh || !aw || !ah) {
    return coverFitToBefore(beforeImg, afterImg).dataUrl
  }

  let beforeLm
  let afterLm
  try {
    ;[{ landmarks: beforeLm }, { landmarks: afterLm }] = await Promise.all([
      analyzeWithMediaPipe(beforeSrc),
      analyzeWithMediaPipe(afterSrc),
    ])
  } catch (err) {
    console.warn('[alignAfterToBefore] MediaPipe failed; using cover-fit fallback', err)
    return coverFitToBefore(beforeImg, afterImg).dataUrl
  }

  const srcPts = landmarksToPixels(afterLm, aw, ah, ANCHOR_INDICES)
  const dstPts = landmarksToPixels(beforeLm, bw, bh, ANCHOR_INDICES)
  const sim = estimateSimilarity(srcPts, dstPts)
  if (!sim) {
    console.warn('[alignAfterToBefore] similarity solve failed; using cover-fit fallback')
    return coverFitToBefore(beforeImg, afterImg, afterLm).dataUrl
  }

  const canvas = document.createElement('canvas')
  canvas.width = bw
  canvas.height = bh
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, bw, bh)
  // x' = a x - b y + tx; y' = b x + a y + ty
  ctx.setTransform(sim.a, sim.b, -sim.b, sim.a, sim.tx, sim.ty)
  ctx.drawImage(afterImg, 0, 0)
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  return canvas.toDataURL('image/jpeg', 0.92)
}
