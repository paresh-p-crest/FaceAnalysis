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

/** Outer lip contour — used for true cheilion (mouth-corner) extremes */
export const MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]

/** Curated symmetry overlay landmarks (paired + midline). Scoring uses full mesh elsewhere. */
export const SYMMETRY_DOTS = [
  // Right eye: outer, inner, top, bottom
  33, 133, 159, 145,
  // Left eye
  362, 263, 386, 374,
  // Right brow: outer, peak, inner
  70, 105, 107,
  // Left brow
  300, 334, 336,
  // Nose midline + alae
  1, 2, 4, 5, 6, 98, 327,
  // Mouth corners, chin, jaw
  61, 291, 152, 234, 454,
]

export function lm(landmarks, idx) {
  return landmarks[idx] || { x: 0.5, y: 0.5, z: 0 }
}

export function mouthCheilions(landmarks) {
  const pts = MOUTH.map((i) => lm(landmarks, i))
  const right = pts.reduce((a, b) => (a.x < b.x ? a : b))
  const left = pts.reduce((a, b) => (a.x > b.x ? a : b))
  return [right, left]
}

export function noseAlae(landmarks) {
  const pts = [48, 278, 64, 294, 98, 327].map((i) => lm(landmarks, i))
  const right = pts.reduce((a, b) => (a.x < b.x ? a : b))
  const left = pts.reduce((a, b) => (a.x > b.x ? a : b))
  return [right, left]
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

export function pointInImage(landmarks, idx) {
  const p = lm(landmarks, idx)
  return { x: p.x * 100, y: p.y * 100 }
}

export function dotsInImage(landmarks, indices) {
  return indices.map((i) => ({ id: i, ...pointInImage(landmarks, i) }))
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

/** Qoves-style dashed guides per proportion tab (coords in 0–100 image space).
 *  orbito-nasal: en–en vs al–al; orbital: en–en vs ex–en; naso-oral: ch–ch vs al–al.
 */
export function proportionRatioOverlays(landmarks, box = null) {
  const toX = (idx) => (box ? pointInCrop(landmarks, idx, box).x : pointInImage(landmarks, idx).x)
  const toY = (idx) => (box ? pointInCrop(landmarks, idx, box).y : pointInImage(landmarks, idx).y)
  const pt = (idx) => ({ x: toX(idx), y: toY(idx) })

  const rOut = pt(33)
  const rIn = pt(133)
  const lIn = pt(362)
  const lOut = pt(263)
  const [alRRaw, alLRaw] = noseAlae(landmarks)
  const [chRRaw, chLRaw] = mouthCheilions(landmarks)
  const toPct = (p) => (box
    ? { x: ((p.x - box.x) / box.w) * 100, y: ((p.y - box.y) / box.h) * 100 }
    : { x: p.x * 100, y: p.y * 100 })
  const alR = toPct(alRRaw)
  const alL = toPct(alLRaw)
  const chR = toPct(chRRaw)
  const chL = toPct(chLRaw)

  const eyeLineY = (rOut.y + rIn.y + lIn.y + lOut.y) / 4
  const noseBaseY = (alR.y + alL.y) / 2
  const mouthY = (chR.y + chL.y) / 2

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
      horizontal: [{ y: eyeLineY }],
      vertical: [
        { x: rIn.x },
        { x: lIn.x },
        { x: alR.x },
        { x: alL.x },
      ],
      dots: [rIn, lIn, alR, alL],
    },
    nasoOral: {
      horizontal: [
        { y: noseBaseY },
        { y: mouthY },
      ],
      vertical: [
        { x: alR.x },
        { x: alL.x },
        { x: chR.x },
        { x: chL.x },
      ],
      dots: [alR, alL, chR, chL],
    },
    orbital: {
      horizontal: [{ y: eyeLineY }],
      vertical: [
        { x: rOut.x },
        { x: rIn.x },
        { x: lIn.x },
        { x: lOut.x },
      ],
      dots: [rOut, rIn, lIn, lOut],
    },
  }
}
