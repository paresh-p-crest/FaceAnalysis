// MediaPipe Face Mesh landmark groups (478-point model)

export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
  152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
]

/** Person's right eye (viewer's left) */
export const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]

/** Person's left eye (viewer's right) */
export const LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]

export const RIGHT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46, 124, 156, 221, 222, 223]
export const LEFT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276, 353, 383, 441, 442, 443]

export const SYMMETRY_DOTS = [
  ...RIGHT_EYE, ...LEFT_EYE, ...RIGHT_BROW, ...LEFT_BROW,
  1, 2, 4, 5, 61, 291, 152, 234, 454,
]

export function lm(landmarks, idx) {
  return landmarks[idx] || { x: 0.5, y: 0.5, z: 0 }
}

export function bboxFromIndices(landmarks, indices, pad = 0.02) {
  const pts = indices.map((i) => lm(landmarks, i))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  if (!xs.length) return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }
  const minX = Math.max(0, Math.min(...xs) - pad)
  const minY = Math.max(0, Math.min(...ys) - pad)
  const maxX = Math.min(1, Math.max(...xs) + pad)
  const maxY = Math.min(1, Math.max(...ys) + pad)
  return { x: minX, y: minY, w: Math.max(0.05, maxX - minX), h: Math.max(0.05, maxY - minY) }
}

export function mergeBboxes(a, b, pad = 0.015) {
  const minX = Math.max(0, Math.min(a.x, b.x) - pad)
  const minY = Math.max(0, Math.min(a.y, b.y) - pad)
  const maxX = Math.min(1, Math.max(a.x + a.w, b.x + b.w) + pad)
  const maxY = Math.min(1, Math.max(a.y + a.h, b.y + b.h) + pad)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function bboxFullFace(landmarks, pad = 0.1) {
  return bboxFromIndices(landmarks, FACE_OVAL, pad)
}

export function bboxEyesRegion(landmarks) {
  const right = bboxFromIndices(landmarks, RIGHT_EYE, 0.028)
  const left = bboxFromIndices(landmarks, LEFT_EYE, 0.028)
  const merged = mergeBboxes(right, left, 0.018)

  const padOuter = 0.022
  const x = Math.max(0, merged.x - padOuter)
  const w = Math.min(1 - x, merged.w + padOuter * 2)

  const upperY = Math.min(lm(landmarks, 159).y, lm(landmarks, 386).y)
  const lowerY = Math.max(lm(landmarks, 145).y, lm(landmarks, 374).y)
  const y = Math.max(0, upperY - 0.01)
  const h = Math.min(1 - y, lowerY - upperY + 0.028)

  return { x, y, w, h }
}

export function bboxBrowsRegion(landmarks) {
  const right = bboxFromIndices(landmarks, RIGHT_BROW, 0.018)
  const left = bboxFromIndices(landmarks, LEFT_BROW, 0.018)
  const merged = mergeBboxes(right, left, 0.01)

  const eyeTopY = Math.min(lm(landmarks, 159).y, lm(landmarks, 386).y)
  const y = Math.max(0, merged.y - 0.012)
  const maxBottom = eyeTopY - 0.006
  const h = Math.max(0.035, Math.min(merged.h + 0.012, maxBottom - y))

  return { x: merged.x, y, w: merged.w, h }
}

export function pointInCrop(landmarks, idx, box) {
  const p = lm(landmarks, idx)
  return {
    x: ((p.x - box.x) / box.w) * 100,
    y: ((p.y - box.y) / box.h) * 100,
  }
}

export function dotsInCrop(landmarks, indices, box) {
  return indices.map((i) => ({ id: i, ...pointInCrop(landmarks, i, box) }))
}

export function proportionLinesInCrop(landmarks, box) {
  const browY = (lm(landmarks, 105).y + lm(landmarks, 334).y) / 2
  const toPct = (y) => ((y - box.y) / box.h) * 100
  return {
    hair: toPct(lm(landmarks, 10).y),
    brow: toPct(browY),
    nose: toPct(lm(landmarks, 2).y),
    chin: toPct(lm(landmarks, 152).y),
  }
}

/** Qoves-style dashed guides per proportion tab (coords in 0–100 crop space) */
export function proportionRatioOverlays(landmarks, box) {
  const toX = (idx) => pointInCrop(landmarks, idx, box).x
  const toY = (idx) => pointInCrop(landmarks, idx, box).y
  const noseBaseY = (lm(landmarks, 48).y + lm(landmarks, 278).y) / 2
  const mouthY = (lm(landmarks, 61).y + lm(landmarks, 291).y) / 2

  return {
    nasoAural: {
      horizontal: [
        { y: toY(234) },
        { y: toY(127) },
        { y: toY(6) },
        { y: toY(2) },
      ],
      segments: [
        { x1: toX(234), y1: toY(234), x2: toX(234), y2: toY(127) },
        { x1: toX(2), y1: toY(6), x2: toX(2), y2: toY(2) },
      ],
    },
    orbitoNasal: {
      horizontal: [{ y: toY(6) }],
      vertical: [
        { x: toX(33) },
        { x: toX(263) },
        { x: toX(48) },
        { x: toX(278) },
      ],
      dots: [
        { x: toX(33), y: toY(33) },
        { x: toX(263), y: toY(263) },
        { x: toX(48), y: toY(48) },
        { x: toX(278), y: toY(278) },
      ],
    },
    nasoOral: {
      horizontal: [
        { y: ((noseBaseY - box.y) / box.h) * 100 },
        { y: ((mouthY - box.y) / box.h) * 100 },
      ],
      vertical: [
        { x: toX(48) },
        { x: toX(278) },
        { x: toX(61) },
        { x: toX(291) },
      ],
      dots: [
        { x: toX(48), y: ((noseBaseY - box.y) / box.h) * 100 },
        { x: toX(278), y: ((noseBaseY - box.y) / box.h) * 100 },
        { x: toX(61), y: ((mouthY - box.y) / box.h) * 100 },
        { x: toX(291), y: ((mouthY - box.y) / box.h) * 100 },
      ],
    },
    orbital: {
      horizontal: [{ y: toY(159) }, { y: toY(386) }],
      vertical: [
        { x: toX(133) },
        { x: toX(33) },
        { x: toX(263) },
        { x: toX(362) },
        { x: toX(48) },
        { x: toX(278) },
      ],
      dots: [
        { x: toX(133), y: toY(133) },
        { x: toX(33), y: toY(33) },
        { x: toX(263), y: toY(263) },
        { x: toX(362), y: toY(362) },
        { x: toX(48), y: toY(48) },
        { x: toX(278), y: toY(278) },
      ],
    },
  }
}
