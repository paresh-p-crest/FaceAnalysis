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

/** Notebook facial-symmetry overlay: 9 bilateral pairs (18 rings). Midline is arrow-only (10/152). */
export const SYMMETRY_DOTS = [
  // Brow outer / inner
  70, 300, 107, 336,
  // Eye outer / inner
  33, 263, 133, 362,
  // Nose alae
  98, 327,
  // Mouth corners
  61, 291,
  // Cheeks / jaw / chin sides
  234, 454, 172, 397, 176, 400,
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

/** Facial third guides in full-image % space (matches front photo after URL binding). */
export function proportionLinesInImage(landmarks) {
  const browY = (lm(landmarks, 105).y + lm(landmarks, 334).y) / 2
  return {
    hair: lm(landmarks, 10).y * 100,
    brow: browY * 100,
    nose: lm(landmarks, 2).y * 100,
    chin: lm(landmarks, 152).y * 100,
  }
}

/** Index landmarks by MediaPipe id when overlay rows carry `{id,x,y}`. */
function landmarksByIndex(landmarks) {
  if (!landmarks?.length) return landmarks
  if (landmarks[0]?.id == null || landmarks[0]?.x == null) return landmarks
  if (landmarks[0].id === 0 && landmarks[33]?.id === 33) return landmarks
  const arr = []
  landmarks.forEach((pt) => {
    if (pt?.id == null) return
    arr[pt.id] = { x: pt.x, y: pt.y, z: pt.z || 0 }
  })
  return arr.length ? arr : landmarks
}

/**
 * Orbital bar X positions (0–100): anatomical canthi, with outer ends nudged
 * laterally so the span matches visible soft-tissue eye length (mesh corners sit inset).
 */
function orbitalBarXs(toX) {
  const rOut = toX(33)
  const rIn = toX(133)
  const lIn = toX(362)
  const lOut = toX(263)
  const rEyeW = Math.abs(rIn - rOut)
  const lEyeW = Math.abs(lOut - lIn)
  // ponytail: ~18% soft-tissue pad; raise if still short vs photo.
  const padR = rEyeW * 0.18
  const padL = lEyeW * 0.18
  return {
    rOut: rOut - padR,
    rIn,
    lIn,
    lOut: lOut + padL,
  }
}

/** Qoves-style guides per proportion tab (coords in 0–100 image or crop space).
 *  Pass `box` (normalized face crop) when the displayed image is that crop.
 *  orbito-nasal: en–en and al–al as horizontal bars with end ticks;
 *  naso-oral: al–al and ch–ch as horizontal bars with end ticks;
 *  orbital: one continuous ex–en–en–ex bar on the forehead (above brows) with ticks at each canthus x.
 */
export function proportionRatioOverlays(landmarks, box = null) {
  const lmArr = landmarksByIndex(landmarks)
  const toX = (idx) => (box ? pointInCrop(lmArr, idx, box).x : pointInImage(lmArr, idx).x)
  const toY = (idx) => (box ? pointInCrop(lmArr, idx, box).y : pointInImage(lmArr, idx).y)
  const pt = (idx) => ({ x: toX(idx), y: toY(idx) })

  const rIn = pt(133)
  const lIn = pt(362)
  const orbital = orbitalBarXs(toX)
  const rOut = { x: orbital.rOut, y: toY(33) }
  const lOut = { x: orbital.lOut, y: toY(263) }
  const [alRRaw, alLRaw] = noseAlae(lmArr)
  const [chRRaw, chLRaw] = mouthCheilions(lmArr)
  const toPct = (p) => (box
    ? { x: ((p.x - box.x) / box.w) * 100, y: ((p.y - box.y) / box.h) * 100 }
    : { x: p.x * 100, y: p.y * 100 })
  const alR = toPct(alRRaw)
  const alL = toPct(alLRaw)
  const chR = toPct(chRRaw)
  const chL = toPct(chLRaw)

  const eyeLineY = (toY(33) + rIn.y + lIn.y + toY(263)) / 4
  // Orbital bar sits on lower forehead (above brows), not through the canthi.
  const browY = (toY(105) + toY(334)) / 2
  const foreheadBarY = browY - Math.max(2, (eyeLineY - browY) * 0.45)
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
      // Two horizontal span bars (en–en, al–al) with downward end ticks — not dots/vertical guides.
      bars: [
        { x1: rIn.x, x2: lIn.x, y: (rIn.y + lIn.y) / 2 },
        { x1: alR.x, x2: alL.x, y: noseBaseY },
      ],
    },
    nasoOral: {
      // Two horizontal span bars (al–al, ch–ch) with downward end ticks — not dots/vertical guides.
      bars: [
        { x1: alR.x, x2: alL.x, y: noseBaseY },
        { x1: chR.x, x2: chL.x, y: mouthY },
      ],
    },
    orbital: {
      // Continuous span on forehead; ticks at soft-tissue-padded canthus x (ex–en–en–ex).
      bars: [
        {
          x1: orbital.rOut,
          x2: orbital.lOut,
          y: foreheadBarY,
          ticks: [orbital.rOut, orbital.rIn, orbital.lIn, orbital.lOut],
        },
      ],
    },
  }
}

/** Visible-side ear mesh for profile naso-aural (matches backend profile_cephalometrics). */
const RIGHT_PROFILE_EAR = [234, 127, 132, 93, 58, 172, 136, 150]
const LEFT_PROFILE_EAR = [356, 454, 323, 361, 288, 397, 365, 379]

/**
 * Qoves-style ear/nose height brackets on a profile photo (image 0–100).
 * rightProfile = person's right side visible → right-ear landmarks on the rear side.
 */
export function buildNasoAuralOverlay(landmarks, poseId = 'rightProfile') {
  const lmArr = landmarksByIndex(landmarks)
  if (!lmArr?.length) return null
  const earIdx = poseId === 'leftProfile' ? LEFT_PROFILE_EAR : RIGHT_PROFILE_EAR
  const noseTop = lm(lmArr, 6)
  const noseBot = lm(lmArr, 2)
  // Pronasale helps when nasion drifts on yawed profiles.
  const pronasale = lm(lmArr, 1)
  const noseX = ((noseTop.x + noseBot.x + pronasale.x) / 3) * 100
  const nt = Math.min(noseTop.y, pronasale.y) * 100
  const nb = noseBot.y * 100

  let earPts = earIdx.map((i) => lm(lmArr, i))
  // Keep rear-of-head candidates so cheek points don't collapse the span upward.
  if (poseId === 'leftProfile') {
    const rear = earPts.filter((p) => p.x > (noseTop.x + noseBot.x) / 2 + 0.02)
    if (rear.length >= 2) earPts = rear
  } else {
    const rear = earPts.filter((p) => p.x < (noseTop.x + noseBot.x) / 2 - 0.02)
    if (rear.length >= 2) earPts = rear
  }
  const earTop = earPts.reduce((a, b) => (a.y < b.y ? a : b))
  const earBot = earPts.reduce((a, b) => (a.y > b.y ? a : b))
  const earX = ((earTop.x + earBot.x) / 2) * 100
  const et = earTop.y * 100
  const eb = earBot.y * 100
  // Reject collapsed / hairline-only spans — caller may fall back to stored overlay.
  if (!(eb - et >= 0.04 * 100) && !(nb - nt >= 0.04 * 100)) return null
  const tick = 7
  return {
    horizontal: [
      { y: et, x1: earX - tick, x2: earX + tick },
      { y: eb, x1: earX - tick, x2: earX + tick },
      { y: nt, x1: noseX - tick, x2: noseX + tick },
      { y: nb, x1: noseX - tick, x2: noseX + tick },
    ],
    segments: [
      { x1: earX, y1: et, x2: earX, y2: eb },
      { x1: noseX, y1: nt, x2: noseX, y2: nb },
    ],
  }
}
