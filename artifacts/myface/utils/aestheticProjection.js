/**
 * Measurement-driven facial projection engine.
 * Uses landmark warps, localized healing, and composited overlays — not global filters.
 */

import {
  lm,
  FACE_OVAL,
  RIGHT_EYE,
  LEFT_EYE,
  RIGHT_BROW,
  LEFT_BROW,
  bboxFullFace,
  bboxFromIndices,
  bboxBrowsRegion,
  bboxEyesRegion,
  mergeBboxes,
} from './faceCrop'
import { getCheekAnalysisBox } from './cheekGuides'

const PREVIEW_BG = { r: 232, g: 238, b: 244 }
import { projectionStrengths } from './anthropometrics'
import { warpHorizontal, pathFromIndices, strokePath, healRegion, addNoiseOverlay } from './projectionCanvas'

const NOSE_INDICES = [1, 2, 98, 327, 48, 278, 44, 274, 6, 197, 195, 5, 4]
const MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
const JAW_LINE = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 454]
const CHEEK_L = [116, 117, 118, 119, 120, 121, 127, 234]
const CHEEK_R = [345, 346, 347, 348, 349, 350, 356, 454]

const FEATURE_BOOST = 2.6

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function landmarksFromOverlay(landmarks) {
  if (!landmarks?.length) return null
  if (landmarks[0]?.x != null && landmarks[0]?.id != null) {
    const arr = []
    landmarks.forEach((pt) => {
      arr[pt.id] = { x: pt.x, y: pt.y, z: pt.z || 0 }
    })
    return arr
  }
  return landmarks
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function buildMask(w, h, landmarks, indices) {
  const poly = pathFromIndices(landmarks, indices, w, h, lm)
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) mask[y * w + x] = 1
    }
  }
  return mask
}

function buildRectMask(w, h, box) {
  const mask = new Uint8Array(w * h)
  const x0 = Math.floor(box.x * w)
  const y0 = Math.floor(box.y * h)
  const x1 = Math.ceil((box.x + box.w) * w)
  const y1 = Math.ceil((box.y + box.h) * h)
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
      mask[y * w + x] = 1
    }
  }
  return mask
}

function subtractMask(base, ...others) {
  const out = new Uint8Array(base)
  others.forEach((m) => {
    if (!m) return
    for (let i = 0; i < out.length; i++) if (m[i]) out[i] = 0
  })
  return out
}

function boostStrength(strengths, feature, singleMode) {
  if (!singleMode) return strengths
  const out = { ...strengths }
  Object.keys(out).forEach((k) => {
    out[k] = k === feature ? Math.min(0.35, out[k] * FEATURE_BOOST) : out[k] * 0.15
  })
  return out
}

function detectHairMask(data, w, h, landmarks) {
  const browY = ((lm(landmarks, 105).y + lm(landmarks, 334).y) / 2) * h
  const foreheadY = lm(landmarks, 10).y * h
  const face = bboxFullFace(landmarks, 0.02)
  const x0 = Math.floor(face.x * w)
  const x1 = Math.ceil((face.x + face.w) * w)
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < Math.ceil(browY); y++) {
    for (let x = x0; x < x1 && x < w; x++) {
      if (x < 0) continue
      const idx = (y * w + x) * 4
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      if (lum < 115 || y < foreheadY - h * 0.02) mask[y * w + x] = 1
    }
  }
  return mask
}

function getFeatureBox(landmarks, featureKey) {
  switch (featureKey) {
    case 'hair': {
      // Frontal hairline + forehead + brows (not top-of-head scalp photo)
      const face = bboxFullFace(landmarks, 0.04)
      const brows = bboxBrowsRegion(landmarks)
      const y0 = Math.max(0, face.y - face.h * 0.22)
      const y1 = Math.min(1, brows.y + brows.h * 1.2)
      const x = Math.max(0, face.x - face.w * 0.02)
      const w = Math.min(1 - x, face.w * 1.04)
      return { x, y: y0, w, h: Math.max(0.16, y1 - y0) }
    }
    case 'eyebrows': return bboxBrowsRegion(landmarks)
    case 'eyes': return bboxEyesRegion(landmarks)
    case 'periorbital':
      return mergeBboxes(bboxBrowsRegion(landmarks), bboxEyesRegion(landmarks), 0.012)
    case 'eyelashes': {
      const eyes = bboxEyesRegion(landmarks)
      return {
        x: eyes.x,
        y: Math.max(0, eyes.y - eyes.h * 0.08),
        w: eyes.w,
        h: Math.min(1 - eyes.y, eyes.h * 1.12),
      }
    }
    case 'underEye': {
      const eyes = bboxEyesRegion(landmarks)
      const y = eyes.y + eyes.h * 0.55
      return {
        x: eyes.x,
        y,
        w: eyes.w,
        h: Math.min(1 - y, eyes.h * 0.55),
      }
    }
    case 'nose': return bboxFromIndices(landmarks, NOSE_INDICES, 0.05)
    case 'lips': return bboxFromIndices(landmarks, MOUTH, 0.05)
    case 'jaw': {
      // Frontal lower face: mouth through jawline to upper neck (not profile)
      const face = bboxFullFace(landmarks, 0.03)
      const mouth = bboxFromIndices(landmarks, MOUTH, 0.04)
      const jaw = bboxFromIndices(landmarks, JAW_LINE, 0.04)
      const chin = lm(landmarks, 152)
      const merged = mergeBboxes(mouth, jaw, 0.03)
      const y0 = Math.max(0, merged.y - face.h * 0.02)
      const y1 = Math.min(1, Math.max(merged.y + merged.h, chin.y + face.h * 0.18))
      const x = Math.max(0, Math.min(merged.x, face.x + face.w * 0.08))
      const x2 = Math.min(1, Math.max(merged.x + merged.w, face.x + face.w * 0.92))
      return { x, y: y0, w: Math.max(0.2, x2 - x), h: Math.max(0.18, y1 - y0) }
    }
    case 'cheeks': {
      // Must match cheekGuides crop so ANALYSIS overlay lands on the photo
      return getCheekAnalysisBox(landmarks) || bboxFromIndices(
        landmarks,
        [130, 263, 102, 331, 61, 291, 234, 454, 197, 2, 116, 345],
        0.1
      )
    }
    case 'chin': {
      // Frontal mouth + chin (upper lip through menton), matching protocol BEFORE framing
      return mergeBboxes(
        bboxFromIndices(landmarks, MOUTH, 0.04),
        bboxFromIndices(landmarks, [152, 148, 176, 377, 400], 0.06),
        0.02,
      )
    }
    case 'skin': {
      // Cheek-only skin patch (image-left = subject's right): strictly BELOW the lower
      // eyelid and ABOVE the upper lip, inset from the ear/jaw silhouette and stopped
      // before the nose ala. No eye, no lips, no nose — just cheek skin texture.
      const eye = bboxFromIndices(landmarks, RIGHT_EYE, 0.006)
      const cheek = bboxFromIndices(landmarks, CHEEK_L, 0.01)
      const lips = bboxFromIndices(landmarks, MOUTH, 0.01)
      // Subject's-right nasal ala / sidewall — inner (toward-nose) boundary.
      const noseLeftX = Math.min(
        lm(landmarks, 98).x,
        lm(landmarks, 64).x,
        lm(landmarks, 48).x,
        lm(landmarks, 129).x,
      )
      // Vertical: lower eyelid → upper lip, trimmed so neither eye nor lips are in frame.
      const y0 = Math.min(0.85, eye.y + eye.h + 0.02)
      const y1 = Math.max(y0 + 0.08, lips.y - 0.02)
      const h = y1 - y0
      // Horizontal: centered on the cheek between the silhouette and the nose ala.
      const medialX = Math.max(0, noseLeftX - 0.02)
      const cheekCenterX = (cheek.x + medialX) / 2
      const halfW = Math.max(0.09, Math.min((medialX - cheek.x) * 0.42, h * 0.7))
      const x0 = Math.max(0, cheekCenterX - halfW)
      const x1 = Math.min(1, medialX, cheekCenterX + halfW)
      return { x: x0, y: y0, w: Math.max(0.1, x1 - x0), h: Math.max(0.08, h) }
    }
    case 'neck': {
      // Lower face + neck: nostrils through jaw to collar (not a thin under-chin strip)
      const face = bboxFullFace(landmarks, 0.04)
      const noseTip = lm(landmarks, 2)
      const chin = lm(landmarks, 152)
      const y0 = Math.max(0, Math.min(noseTip.y - face.h * 0.04, face.y + face.h * 0.45))
      const lowerSpan = Math.max(chin.y - y0, face.h * 0.35)
      const y1 = Math.min(1, chin.y + lowerSpan * 0.7)
      const x = Math.max(0, face.x - face.w * 0.06)
      const w = Math.min(1 - x, face.w * 1.12)
      return { x, y: y0, w, h: Math.max(0.12, y1 - y0) }
    }
    case 'ears': {
      // Front-facing crop of one ear with adjacent face (eye/cheek) — not a profile photo
      const face = bboxFullFace(landmarks, 0.02)
      const ear = bboxFromIndices(landmarks, [454, 356, 389, 323, 361], 0.08)
      const eye = bboxFromIndices(landmarks, [263, 362, 386, 374], 0.04)
      const merged = mergeBboxes(ear, eye, 0.04)
      const x = Math.max(0, Math.min(merged.x, face.x + face.w * 0.35))
      const y = Math.max(0, merged.y - face.h * 0.06)
      const x2 = Math.min(1, Math.max(merged.x + merged.w, face.x + face.w * 0.98))
      const y2 = Math.min(1, merged.y + merged.h + face.h * 0.1)
      return { x, y, w: Math.max(0.12, x2 - x), h: Math.max(0.16, y2 - y) }
    }
    default: return bboxFullFace(landmarks, 0.04)
  }
}

function expandBoxToMinSize(box, minPx, canvasW, canvasH) {
  let x = box.x * canvasW
  let y = box.y * canvasH
  let w = box.w * canvasW
  let h = box.h * canvasH
  const short = Math.min(w, h)
  if (short >= minPx) return box
  const scale = Math.min(minPx / Math.max(short, 1), 2.2)
  const cx = x + w / 2
  const cy = y + h / 2
  w = Math.min(canvasW, w * scale)
  h = Math.min(canvasH, h * scale)
  x = Math.max(0, cx - w / 2)
  y = Math.max(0, cy - h / 2)
  if (x + w > canvasW) x = canvasW - w
  if (y + h > canvasH) y = canvasH - h
  return { x: x / canvasW, y: y / canvasH, w: w / canvasW, h: h / canvasH }
}

function cropDataUrl(canvas, box, minPx = 0) {
  const expanded =
    minPx > 0 ? expandBoxToMinSize(box, minPx, canvas.width, canvas.height) : box
  const x = Math.round(expanded.x * canvas.width)
  const y = Math.round(expanded.y * canvas.height)
  let cw = Math.max(1, Math.round(expanded.w * canvas.width))
  let ch = Math.max(1, Math.round(expanded.h * canvas.height))
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, x, y, cw, ch, 0, 0, cw, ch)
  if (minPx > 0 && Math.min(cw, ch) < minPx) {
    const scale = minPx / Math.min(cw, ch)
    const up = document.createElement('canvas')
    up.width = Math.round(cw * scale)
    up.height = Math.round(ch * scale)
    const uctx = up.getContext('2d')
    uctx.imageSmoothingEnabled = true
    uctx.imageSmoothingQuality = 'high'
    uctx.drawImage(c, 0, 0, up.width, up.height)
    return up.toDataURL('image/jpeg', 0.92)
  }
  return c.toDataURL('image/jpeg', 0.92)
}

function getProfileBox(landmarks) {
  const face = bboxFullFace(landmarks, 0.02)
  const jaw = bboxFromIndices(landmarks, JAW_LINE, 0.04)
  const merged = mergeBboxes(face, jaw, 0.01)
  return {
    x: merged.x + merged.w * 0.55,
    y: merged.y + merged.h * 0.08,
    w: merged.w * 0.42,
    h: merged.h * 0.82,
  }
}

/* ── Feature projection passes ── */

function projectHair(ctx, w, h, landmarks, s) {
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  const mask = detectHairMask(data, w, h, landmarks)

  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const idx = i * 4
    const y = Math.floor(i / w)
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    const crownBoost = (1 - y / h) * 28 * s
    if (lum < 105) {
      data[idx] = Math.max(0, data[idx] * (1 - 0.28 * s))
      data[idx + 1] = Math.max(0, data[idx + 1] * (1 - 0.24 * s))
      data[idx + 2] = Math.max(0, data[idx + 2] * (1 - 0.2 * s))
    }
    data[idx] = Math.min(255, data[idx] + crownBoost)
    data[idx + 1] = Math.min(255, data[idx + 1] + crownBoost * 0.85)
    data[idx + 2] = Math.min(255, data[idx + 2] + crownBoost * 0.55)
  }
  ctx.putImageData(img, 0, 0)

  const crownX = w / 2
  const crownY = Math.max(0, lm(landmarks, 10).y * h - h * 0.05)
  const face = bboxFullFace(landmarks, 0.05)
  const grad = ctx.createRadialGradient(crownX, crownY, w * 0.02, crownX, crownY, w * 0.38)
  grad.addColorStop(0, `rgba(255,248,240,${0.35 * s})`)
  grad.addColorStop(0.6, `rgba(220,200,180,${0.12 * s})`)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.fillStyle = grad
  ctx.fillRect(face.x * w, 0, face.w * w, lm(landmarks, 105).y * h + h * 0.02)
  ctx.restore()

  const strokeCanvas = document.createElement('canvas')
  strokeCanvas.width = w
  strokeCanvas.height = h
  const sctx = strokeCanvas.getContext('2d')
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 1.2 - Math.PI * 0.6
    sctx.strokeStyle = `rgba(18,10,6,${0.2 * s})`
    sctx.lineWidth = 2 + s * 5
    sctx.beginPath()
    sctx.moveTo(crownX, crownY)
    sctx.lineTo(crownX + Math.cos(angle) * w * 0.14, crownY + Math.sin(angle) * h * 0.08)
    sctx.stroke()
  }
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.85
  ctx.drawImage(strokeCanvas, 0, 0)
  ctx.restore()

  addNoiseOverlay(ctx, w, h, mask, 24 * s)
}

function projectEyebrows(ctx, w, h, landmarks, s) {
  const browColor = `rgba(35,22,14,${0.55 * s})`
  const overlay = document.createElement('canvas')
  overlay.width = w
  overlay.height = h
  const octx = overlay.getContext('2d')
  octx.globalCompositeOperation = 'source-over'

  const rPath = pathFromIndices(landmarks, RIGHT_BROW, w, h, lm)
  const lPath = pathFromIndices(landmarks, LEFT_BROW, w, h, lm)
  strokePath(octx, rPath, { color: browColor, width: 3 + s * 14, blur: 1.5, alpha: 1 })
  strokePath(octx, lPath, { color: browColor, width: 3 + s * 14, blur: 1.5, alpha: 1 })

  const lb = lm(landmarks, 105)
  const rb = lm(landmarks, 334)
  const asym = (lb.y - rb.y) * h
  if (Math.abs(asym) > 1) {
    const fixPath = asym > 0 ? lPath : rPath
    strokePath(octx, fixPath, { color: `rgba(25,15,8,${0.35 * s})`, width: 2 + s * 8, blur: 2 })
  }

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(overlay, 0, 0)
  ctx.restore()
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.5 * s
  ctx.drawImage(overlay, 0, 0)
  ctx.restore()
}

function projectEyes(ctx, w, h, landmarks, s) {
  const underBox = bboxEyesRegion(landmarks)
  const underMask = buildRectMask(w, h, {
    x: underBox.x - 0.01,
    y: underBox.y + underBox.h * 0.48,
    w: underBox.w + 0.02,
    h: underBox.h * 0.58,
  })
  const cheekMask = buildRectMask(w, h, {
    x: underBox.x,
    y: underBox.y + underBox.h * 0.15,
    w: underBox.w,
    h: underBox.h * 0.35,
  })
  healRegion(ctx, w, h, underMask, cheekMask, 0.55 * s + 0.25)

  const eyeMask = buildMask(w, h, landmarks, [...RIGHT_EYE, ...LEFT_EYE])
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  for (let i = 0; i < eyeMask.length; i++) {
    if (!eyeMask[i]) continue
    const idx = i * 4
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    const sat = Math.max(data[idx], data[idx + 1], data[idx + 2]) - Math.min(data[idx], data[idx + 1], data[idx + 2])
    if (lum > 120 && sat < 50) {
      const lift = 22 * s
      data[idx] = Math.min(255, data[idx] + lift)
      data[idx + 1] = Math.min(255, data[idx + 1] + lift)
      data[idx + 2] = Math.min(255, data[idx + 2] + lift * 0.9)
    }
    if (lum < 95) {
      data[idx] = Math.min(255, data[idx] + 12 * s)
      data[idx + 1] = Math.min(255, data[idx + 1] + 10 * s)
      data[idx + 2] = Math.min(255, data[idx + 2] + 8 * s)
    }
  }
  ctx.putImageData(img, 0, 0)

  const upperLidMask = buildRectMask(w, h, {
    x: underBox.x,
    y: underBox.y,
    w: underBox.w,
    h: underBox.h * 0.35,
  })
  const openImg = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < upperLidMask.length; i++) {
    if (!upperLidMask[i]) continue
    const idx = i * 4
    openImg.data[idx + 2] = Math.max(0, openImg.data[idx + 2] - 8 * s)
  }
  ctx.putImageData(openImg, 0, 0)
}

function projectNose(ctx, w, h, landmarks, s, cvReport) {
  const ratio = parseFloat(cvReport?.nose?.widthLengthRatio || cvReport?.nose?.noseRatio || '0.7')
  const refine = ratio > 0.72 ? s * 1.2 : s * 0.65
  const noseTop = lm(landmarks, 6).y * h
  const noseBot = lm(landmarks, 2).y * h
  const centerX = ((lm(landmarks, 48).x + lm(landmarks, 278).x) / 2) * w

  warpHorizontal(
    ctx,
    w,
    h,
    (x, y) => y > noseTop && y < noseBot + h * 0.02,
    (x) => {
      const dist = (x - centerX) / w
      return dist * refine * w * 0.14
    }
  )

  const overlay = document.createElement('canvas')
  overlay.width = w
  overlay.height = h
  const octx = overlay.getContext('2d')
  const bridge = pathFromIndices(landmarks, [6, 197, 195, 5, 4, 1], w, h, lm)
  strokePath(octx, bridge, { color: `rgba(255,240,230,${0.4 * s})`, width: 2 + s * 5, blur: 3 })
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.drawImage(overlay, 0, 0)
  ctx.restore()
}

function projectJawChinNeck(ctx, w, h, landmarks, s) {
  const jawPts = pathFromIndices(landmarks, JAW_LINE, w, h, lm)
  const overlay = document.createElement('canvas')
  overlay.width = w
  overlay.height = h
  const octx = overlay.getContext('2d')

  strokePath(octx, jawPts, { color: `rgba(15,10,8,${0.45 * s})`, width: 4 + s * 12, blur: 4 })
  const chin = lm(landmarks, 152)
  const cx = chin.x * w
  const cy = chin.y * h
  const chinGrad = octx.createRadialGradient(cx, cy, 2, cx, cy, w * 0.12)
  chinGrad.addColorStop(0, `rgba(255,235,220,${0.15 * s})`)
  chinGrad.addColorStop(1, 'rgba(0,0,0,0)')
  octx.fillStyle = chinGrad
  octx.fillRect(cx - w * 0.15, cy - h * 0.08, w * 0.3, h * 0.16)

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(overlay, 0, 0)
  ctx.restore()

  const neckBox = getFeatureBox(landmarks, 'neck')
  const neckOverlay = document.createElement('canvas')
  neckOverlay.width = w
  neckOverlay.height = h
  const nctx = neckOverlay.getContext('2d')
  const jawL = lm(landmarks, 234)
  const jawR = lm(landmarks, 454)
  nctx.strokeStyle = `rgba(20,15,12,${0.35 * s})`
  nctx.lineWidth = 3 + s * 8
  nctx.beginPath()
  nctx.moveTo(jawL.x * w, jawL.y * h)
  nctx.lineTo(chin.x * w, (chin.y + neckBox.h) * h)
  nctx.lineTo(jawR.x * w, jawR.y * h)
  nctx.stroke()
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(neckOverlay, 0, 0)
  ctx.restore()
}

function projectLips(ctx, w, h, landmarks, s) {
  const lipMask = buildMask(w, h, landmarks, MOUTH)
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  const ml = lm(landmarks, 61)
  const mr = lm(landmarks, 291)
  const midX = ((ml.x + mr.x) / 2) * w

  for (let i = 0; i < lipMask.length; i++) {
    if (!lipMask[i]) continue
    const idx = i * 4
    const x = i % w
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    const symPull = (x - midX) * 0.02 * s
    data[idx] = Math.min(255, data[idx] + (data[idx] - lum) * 0.25 * s + symPull)
    data[idx + 1] = Math.min(255, data[idx + 1] + (data[idx + 1] - lum) * 0.15 * s)
    data[idx + 2] = Math.min(255, data[idx + 2] + (data[idx + 2] - lum) * 0.1 * s)
  }
  ctx.putImageData(img, 0, 0)

  const overlay = document.createElement('canvas')
  overlay.width = w
  overlay.height = h
  const octx = overlay.getContext('2d')
  const lipPath = pathFromIndices(landmarks, MOUTH.slice(0, 12), w, h, lm)
  strokePath(octx, lipPath, { color: `rgba(120,40,35,${0.2 * s})`, width: 1 + s * 3, blur: 1 })
  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.6
  ctx.drawImage(overlay, 0, 0)
  ctx.restore()
}

function projectSkin(ctx, w, h, landmarks, s) {
  const faceMask = buildMask(w, h, landmarks, FACE_OVAL)
  const eyeMask = buildMask(w, h, landmarks, [...RIGHT_EYE, ...LEFT_EYE])
  const mouthMask = buildMask(w, h, landmarks, MOUTH)
  const browMask = buildMask(w, h, landmarks, [...RIGHT_BROW, ...LEFT_BROW])
  const skinMask = subtractMask(faceMask, eyeMask, mouthMask, browMask)

  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  const src = new Uint8ClampedArray(data)

  for (let pass = 0; pass < 2; pass++) {
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const mi = y * w + x
        if (!skinMask[mi]) continue
        const idx = mi * 4
        for (let c = 0; c < 3; c++) {
          let sum = 0
          let n = 0
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const ni = (y + dy) * w + (x + dx)
              if (skinMask[ni]) {
                sum += src[ni * 4 + c]
                n++
              }
            }
          }
          if (n > 0) data[idx + c] = Math.round(src[idx + c] * (1 - 0.4 * s) + (sum / n) * (0.4 * s))
        }
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        const redExcess = data[idx] - (data[idx + 1] + data[idx + 2]) / 2
        if (redExcess > 5) {
          data[idx] -= redExcess * 0.4 * s
          data[idx + 1] += redExcess * 0.15 * s
        }
        const target = lum + 4 * s
        data[idx] = Math.min(255, data[idx] + (target - lum) * 0.06 * s)
        data[idx + 1] = Math.min(255, data[idx + 1] + (target - lum) * 0.05 * s)
        data[idx + 2] = Math.min(255, data[idx + 2] + (target - lum) * 0.04 * s)
      }
    }
    src.set(data)
  }
  ctx.putImageData(img, 0, 0)
}

function projectCheeks(ctx, w, h, landmarks, s) {
  const cheekL = subtractMask(buildMask(w, h, landmarks, CHEEK_L), buildMask(w, h, landmarks, [...RIGHT_EYE, ...LEFT_EYE]))
  const cheekR = subtractMask(buildMask(w, h, landmarks, CHEEK_R), buildMask(w, h, landmarks, [...RIGHT_EYE, ...LEFT_EYE]))
  const combined = new Uint8Array(cheekL.length)
  for (let i = 0; i < combined.length; i++) combined[i] = cheekL[i] || cheekR[i]

  const overlay = document.createElement('canvas')
  overlay.width = w
  overlay.height = h
  const octx = overlay.getContext('2d')
  const appleL = lm(landmarks, 116)
  const appleR = lm(landmarks, 345)
  ;[
    { x: appleL.x * w, y: appleL.y * h },
    { x: appleR.x * w, y: appleR.y * h },
  ].forEach(({ x, y }) => {
    const g = octx.createRadialGradient(x, y, 2, x, y, w * 0.08)
    g.addColorStop(0, `rgba(255,220,200,${0.25 * s})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    octx.fillStyle = g
    octx.fillRect(x - w * 0.1, y - h * 0.08, w * 0.2, h * 0.16)
  })
  ctx.save()
  ctx.globalCompositeOperation = 'soft-light'
  ctx.drawImage(overlay, 0, 0)
  ctx.restore()

  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < combined.length; i++) {
    if (!combined[i]) continue
    const idx = i * 4
    img.data[idx] = Math.min(255, img.data[idx] + 10 * s)
    img.data[idx + 1] = Math.min(255, img.data[idx + 1] + 7 * s)
    img.data[idx + 2] = Math.min(255, img.data[idx + 2] + 4 * s)
  }
  ctx.putImageData(img, 0, 0)
}

function runProjection(ctx, w, h, landmarks, strengths, cvReport, activeFeatures) {
  const all = activeFeatures.includes('full')
  const run = (key, fn) => {
    if (all || activeFeatures.includes(key)) fn(strengths[key] ?? 0.12)
  }

  run('skin', (s) => projectSkin(ctx, w, h, landmarks, s))
  run('hair', (s) => projectHair(ctx, w, h, landmarks, s))
  run('eyebrows', (s) => projectEyebrows(ctx, w, h, landmarks, s))
  run('eyes', (s) => projectEyes(ctx, w, h, landmarks, s))
  run('nose', (s) => projectNose(ctx, w, h, landmarks, s, cvReport))
  run('lips', (s) => projectLips(ctx, w, h, landmarks, s))
  run('cheeks', (s) => projectCheeks(ctx, w, h, landmarks, s))
  if (all || activeFeatures.includes('jaw') || activeFeatures.includes('chin') || activeFeatures.includes('neck')) {
    const s = Math.max(strengths.jaw, strengths.chin, strengths.neck)
    projectJawChinNeck(ctx, w, h, landmarks, s)
  }
}

async function renderProjection(imageSrc, landmarks, cvReport, metrics, featureKey, options = {}) {
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  if (!lmArr?.length) return base

  const singleMode = featureKey && featureKey !== 'full' && featureKey !== 'overview' && featureKey !== 'skin'
  const activeFeatures = featureKey === 'overview' || featureKey === 'full' ? ['full'] : [featureKey]
  let strengths = projectionStrengths(metrics?.anthropometrics, cvReport)
  if (singleMode) strengths = boostStrength(strengths, featureKey, true)

  const img = await loadImage(base)
  const maxW = options.maxWidth || 1100
  const scale = img.width > maxW ? maxW / img.width : 1
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)

  runProjection(ctx, w, h, lmArr, strengths, cvReport, activeFeatures)
  return { canvas, w, h, lmArr }
}

export async function projectFullFaceAfter(imageSrc, landmarks, cvReport, metrics, options = {}) {
  const { canvas } = await renderProjection(imageSrc, landmarks, cvReport, metrics, 'full', options)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function projectFeatureAfter(imageSrc, landmarks, featureKey, cvReport, metrics) {
  const { canvas, lmArr } = await renderProjection(imageSrc, landmarks, cvReport, metrics, featureKey)
  if (featureKey === 'overview' || featureKey === 'skin') {
    return canvas.toDataURL('image/jpeg', 0.92)
  }
  return cropDataUrl(canvas, getFeatureBox(lmArr, featureKey))
}

export async function cropFeatureBefore(imageSrc, landmarks, featureKey, zoomIn = 1) {
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  if (!lmArr?.length || featureKey === 'overview') return base

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  let box = getFeatureBox(lmArr, featureKey)
  // zoomIn > 1 shrinks the box toward its center (tighter crop).
  if (Number.isFinite(zoomIn) && zoomIn > 1) {
    const nw = box.w / zoomIn
    const nh = box.h / zoomIn
    box = {
      x: Math.max(0, box.x + (box.w - nw) / 2),
      y: Math.max(0, box.y + (box.h - nh) / 2),
      w: nw,
      h: nh,
    }
  }
  return cropDataUrl(canvas, box)
}

/**
 * BEFORE/AFTER pair framing for skin: box centered between nose tip and upper lip,
 * slightly zoomed out vs a tight cheek crop (`zoomOut` > 1 → larger box → less zoom).
 */
export function getMidfacePairBox(landmarks, zoomOut = 1.22) {
  const lmArr = landmarksFromOverlay(landmarks)
  if (!lmArr?.length) return null
  const face = bboxFullFace(lmArr, 0.02)
  const nose = lm(lmArr, 1)
  const upperLip = lm(lmArr, 13)
  const cx = (nose.x + upperLip.x) / 2
  const cy = (nose.y + upperLip.y) / 2
  const z = Number.isFinite(zoomOut) && zoomOut > 0 ? zoomOut : 1.22
  let w = Math.min(1, face.w * 0.78 * z)
  let h = Math.min(1, face.h * 0.7 * z)
  let x = cx - w / 2
  let y = cy - h / 2
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x + w > 1) x = 1 - w
  if (y + h > 1) y = 1 - h
  return { x, y, w, h }
}

/** Crop AFTER for side-by-side pair: midface center, reduced zoom. */
export async function cropAfterMidfaceForPair(imageSrc, landmarks, { zoomOut = 1.22, minPx = 0 } = {}) {
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  const box = getMidfacePairBox(lmArr, zoomOut)
  if (!box) return base

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  return cropDataUrl(canvas, box, minPx)
}

/** Higher-resolution crop for PDF export (min ~450px short edge). */
export async function cropFeatureBeforeForPdf(imageSrc, landmarks, featureKey, minPx = 450) {
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  if (!lmArr?.length || featureKey === 'overview') return base

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  return cropDataUrl(canvas, getFeatureBox(lmArr, featureKey), minPx)
}

/**
 * Ordered eyelid rings (MediaPipe FACEMESH_*_EYE walk) for a clean closed clip path.
 * Same idea as MOUTH for lips — silhouette only, no rectangular zoom.
 */
const RIGHT_EYE_RING = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
const LEFT_EYE_RING = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

/**
 * One eye tile — mirrors lips lipContour: landmark bbox + polygon clip on panel bg.
 */
async function cropEyeContourTile(sourceCanvas, lmArr, eyeRing, minPx) {
  const box = bboxFromIndices(lmArr, eyeRing, 0.012)
  // Crop tight to landmarks only (no expandBoxToMinSize — that pulls cheek/brow in)
  let tile = await loadImage(cropDataUrl(sourceCanvas, box, 0))

  const short = Math.min(tile.width, tile.height)
  if (short < minPx) {
    const scale = minPx / Math.max(short, 1)
    const up = document.createElement('canvas')
    up.width = Math.max(1, Math.round(tile.width * scale))
    up.height = Math.max(1, Math.round(tile.height * scale))
    const uctx = up.getContext('2d')
    uctx.imageSmoothingEnabled = true
    uctx.imageSmoothingQuality = 'high'
    uctx.drawImage(tile, 0, 0, up.width, up.height)
    tile = await loadImage(up.toDataURL('image/jpeg', 0.92))
  }

  const margin = Math.round(Math.min(tile.width, tile.height) * 0.18)
  const out = document.createElement('canvas')
  out.width = tile.width + margin * 2
  out.height = tile.height + margin * 2
  const ctx = out.getContext('2d')
  ctx.fillStyle = `rgb(${PREVIEW_BG.r},${PREVIEW_BG.g},${PREVIEW_BG.b})`
  ctx.fillRect(0, 0, out.width, out.height)

  const ox = margin
  const oy = margin
  ctx.save()
  ctx.beginPath()
  eyeRing.forEach((idx, i) => {
    const p = lm(lmArr, idx)
    const lx = ((p.x - box.x) / Math.max(box.w, 1e-6)) * tile.width
    const ly = ((p.y - box.y) / Math.max(box.h, 1e-6)) * tile.height
    if (i === 0) ctx.moveTo(ox + lx, oy + ly)
    else ctx.lineTo(ox + lx, oy + ly)
  })
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(tile, ox, oy, tile.width, tile.height)
  ctx.restore()

  return out.toDataURL('image/jpeg', 0.92)
}

/** Side-by-side eye-contour crops for PDF (same landmark-clip approach as lips). */
export async function cropDualEyesForPdf(imageSrc, landmarks, minPx = 220) {
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  if (!lmArr?.length) return null

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)

  const [rightCrop, leftCrop] = await Promise.all([
    cropEyeContourTile(canvas, lmArr, RIGHT_EYE_RING, minPx),
    cropEyeContourTile(canvas, lmArr, LEFT_EYE_RING, minPx),
  ])

  const rImg = await loadImage(rightCrop)
  const lImg = await loadImage(leftCrop)

  const tileH = Math.max(rImg.height, lImg.height)
  const rW = Math.round(rImg.width * (tileH / rImg.height))
  const lW = Math.round(lImg.width * (tileH / lImg.height))
  const gap = Math.max(8, Math.round(tileH * 0.06))

  const out = document.createElement('canvas')
  out.width = rW + lW + gap
  out.height = tileH
  const ctx = out.getContext('2d')
  ctx.fillStyle = `rgb(${PREVIEW_BG.r},${PREVIEW_BG.g},${PREVIEW_BG.b})`
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(rImg, 0, 0, rW, tileH)
  ctx.drawImage(lImg, rW + gap, 0, lW, tileH)
  return out.toDataURL('image/jpeg', 0.92)
}

/** Masked feature preview on protocol-blue panel background.
 *  @param {'oval'|'lipContour'} [options.maskShape='oval'] — lipContour uses outer MOUTH polygon (PDF).
 */
export async function createMaskedFeaturePreview(
  imageSrc,
  landmarks,
  featureKey,
  minPx = 220,
  options = {}
) {
  const maskShape = options.maskShape === 'lipContour' ? 'lipContour' : 'oval'
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  if (!lmArr?.length) return null

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)

  const useLipContour = maskShape === 'lipContour' && featureKey === 'lips'
  const box = useLipContour
    ? bboxFromIndices(lmArr, MOUTH, 0.02)
    : getFeatureBox(lmArr, featureKey)
  const expanded =
    minPx > 0 ? expandBoxToMinSize(box, minPx, canvas.width, canvas.height) : box
  const featureCrop = await loadImage(cropDataUrl(canvas, box, minPx))

  const panelW = Math.max(featureCrop.width + 80, 320)
  const panelH = Math.max(featureCrop.height + 100, 220)
  const out = document.createElement('canvas')
  out.width = panelW
  out.height = panelH
  const ctx = out.getContext('2d')
  ctx.fillStyle = `rgb(${PREVIEW_BG.r},${PREVIEW_BG.g},${PREVIEW_BG.b})`
  ctx.fillRect(0, 0, panelW, panelH)

  const cx = panelW / 2
  const cy = panelH / 2
  const cropX = cx - featureCrop.width / 2
  const cropY = cy - featureCrop.height / 2

  ctx.save()
  ctx.beginPath()
  if (useLipContour) {
    MOUTH.forEach((idx, i) => {
      const p = lm(lmArr, idx)
      const lx = ((p.x - expanded.x) / Math.max(expanded.w, 1e-6)) * featureCrop.width
      const ly = ((p.y - expanded.y) / Math.max(expanded.h, 1e-6)) * featureCrop.height
      const px = cropX + lx
      const py = cropY + ly
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
  } else {
    const rx = featureCrop.width * 0.58
    const ry = featureCrop.height * 0.62
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  }
  ctx.clip()
  ctx.drawImage(
    featureCrop,
    cropX,
    cropY,
    featureCrop.width,
    featureCrop.height
  )
  ctx.restore()

  return out.toDataURL('image/jpeg', 0.92)
}

export function getCropBox(landmarks, featureKey) {
  const lmArr = landmarksFromOverlay(landmarks)
  if (!lmArr?.length) return null
  return getFeatureBox(lmArr, featureKey)
}

/** Normalized overlay guide points (0–1) within a feature crop box. */
export function featureOverlayPoints(landmarks, cropBox, indices) {
  const lmArr = landmarksFromOverlay(landmarks)
  if (!lmArr?.length || !cropBox) return []
  return indices
    .map((idx) => {
      const p = lm(lmArr, idx)
      return {
        x: (p.x - cropBox.x) / cropBox.w,
        y: (p.y - cropBox.y) / cropBox.h,
      }
    })
    .filter((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)
}

/** Profile-side crop for nose/jaw feature pages. */
export async function cropProfileBefore(imageSrc, landmarks, minPx = 450) {
  const lmArr = landmarksFromOverlay(landmarks)
  const base = await normalizeToJpegDataUrl(imageSrc)
  if (!lmArr?.length) return base

  const img = await loadImage(base)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  canvas.getContext('2d').drawImage(img, 0, 0)
  return cropDataUrl(canvas, getProfileBox(lmArr), minPx)
}

export async function normalizeToJpegDataUrl(src) {
  if (!src) return null
  let url = src
  if (typeof src !== 'string') {
    if (typeof src === 'object') {
      url = src.publicUrl || src.url || src.src || null
    } else {
      url = null
    }
  }
  if (typeof url !== 'string' || !url.trim()) {
    throw new Error('Invalid image source for PDF')
  }
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.92)
}

export async function createLandmarkPreview(photoSrc, landmarks = []) {
  const base = await normalizeToJpegDataUrl(photoSrc)
  const img = await loadImage(base)
  const maxW = 900
  const scale = img.width > maxW ? maxW / img.width : 1
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  if (landmarks?.length) {
    const pts = landmarks.length > 150 ? landmarks.filter((_, i) => i % 4 === 0) : landmarks
    ctx.fillStyle = 'rgba(15, 118, 110, 0.75)'
    pts.forEach((pt) => {
      ctx.beginPath()
      ctx.arc(pt.x * w, pt.y * h, Math.max(1.5, w * 0.003), 0, Math.PI * 2)
      ctx.fill()
    })
  }
  return canvas.toDataURL('image/jpeg', 0.9)
}

export async function createEnhancedPortrait(src, landmarks, cvReport, metrics) {
  if (landmarks && cvReport) return projectFullFaceAfter(src, landmarks, cvReport, metrics)
  return normalizeToJpegDataUrl(src)
}

export { getFeatureBox, getProfileBox, projectionStrengths, PREVIEW_BG }
