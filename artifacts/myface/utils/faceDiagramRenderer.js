/**
 * Client-side minimal anatomical face diagram from MediaPipe landmarks.
 * Port of face_diagram_renderer.py sections 3–9 (SVG path only, no photo overlay).
 */

// ── Semantic landmark map (MediaPipe Face Landmarker 478) ──────────────────

const FACE_OUTLINE = [
  162, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
  377, 400, 378, 379, 365, 397, 288, 361, 323, 389,
]

const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
const LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
const RIGHT_EYE_UPPER = [33, 246, 161, 160, 159, 158, 157, 173, 133]
const RIGHT_EYE_LOWER = [33, 7, 163, 144, 145, 153, 154, 155, 133]
const LEFT_EYE_UPPER = [362, 398, 384, 385, 386, 387, 388, 466, 263]
const LEFT_EYE_LOWER = [362, 382, 381, 380, 374, 373, 390, 249, 263]

const RIGHT_BROW_UPPER = [70, 63, 105, 66, 107]
const RIGHT_BROW_LOWER = [55, 65, 52, 53, 46]
const LEFT_BROW_UPPER = [300, 293, 334, 296, 336]
const LEFT_BROW_LOWER = [285, 295, 282, 283, 276]

const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4]
const NOSE_TIP = 4
const NOSE_LEFT_ALAR = 327
const NOSE_RIGHT_ALAR = 98

const UPPER_LIP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
const LOWER_LIP = [291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61]
const LIP_INNER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308]

const FACE_GROUPS = {
  face_outline: FACE_OUTLINE,
  left_brow_upper: LEFT_BROW_UPPER,
  left_brow_lower: LEFT_BROW_LOWER,
  right_brow_upper: RIGHT_BROW_UPPER,
  right_brow_lower: RIGHT_BROW_LOWER,
  left_eye: LEFT_EYE,
  right_eye: RIGHT_EYE,
  left_eye_upper: LEFT_EYE_UPPER,
  left_eye_lower: LEFT_EYE_LOWER,
  right_eye_upper: RIGHT_EYE_UPPER,
  right_eye_lower: RIGHT_EYE_LOWER,
  nose_bridge: NOSE_BRIDGE,
  nose_tip: NOSE_TIP,
  nose_left_alar: NOSE_LEFT_ALAR,
  nose_right_alar: NOSE_RIGHT_ALAR,
  upper_lip: UPPER_LIP,
  lower_lip: LOWER_LIP,
  lip_inner: LIP_INNER,
}

export const STYLE = {
  stroke: '#7E9DA8',
  bg: '#FFFFFF',
  widths: {
    face: 1.35,
    brow: 1.15,
    eye: 1.2,
    crease: 1.0,
    nose: 1.15,
    lips: 1.2,
    secondary: 0.9,
  },
  opacity: {
    face: 0.68,
    brow: 0.65,
    eye: 0.65,
    crease: 0.30,
    nose: 0.58,
    lips: 0.65,
    lip_line: 0.38,
    secondary: 0.18,
  },
}

const DEFAULT_WIDTH = 760
const DEFAULT_HEIGHT = 900
/** Uniform fit margin — lower = larger diagram (same aspect, no stretch). */
const DEFAULT_FIT_MARGIN = 0.15

// ── Point helpers ──────────────────────────────────────────────────────────

function pt(landmarks, idx) {
  const p = landmarks[idx]
  return [Number(p.x), Number(p.y)]
}

function mid(a, b) {
  return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]]
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]]
}

function scalePt(a, s) {
  return [a[0] * s, a[1] * s]
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function rotate(p, angle, origin = [0, 0]) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const x = p[0] - origin[0]
  const y = p[1] - origin[1]
  return [origin[0] + c * x - s * y, origin[1] + s * x + c * y]
}

function dedupe(points, eps = 1e-6) {
  const out = []
  for (const p of points) {
    if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p)
  }
  return out
}

function subsample(points, n) {
  if (points.length <= n || n < 2) return [...points]
  return Array.from({ length: n }, (_, i) =>
    points[Math.round((i * (points.length - 1)) / (n - 1))],
  )
}

function bboxSpan(pts) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

function centroid(pts) {
  const n = Math.max(pts.length, 1)
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]
}

function fmt(p) {
  return `${p[0].toFixed(4)},${p[1].toFixed(4)}`
}

function mapPts(pts, mapper) {
  return pts.map(mapper)
}

// ── Template landmarks (for tests / dev) ───────────────────────────────────

export function templateLandmarks() {
  const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
  const put = (i, x, y, z = 0) => {
    lm[i] = { x, y, z }
  }

  const outline = [
    [162, 0.30, 0.36], [93, 0.26, 0.55], [132, 0.28, 0.65], [58, 0.31, 0.73],
    [172, 0.34, 0.80], [136, 0.38, 0.85], [150, 0.42, 0.89], [149, 0.46, 0.91],
    [176, 0.48, 0.92], [148, 0.49, 0.925], [152, 0.50, 0.93],
    [377, 0.51, 0.925], [400, 0.52, 0.92], [378, 0.54, 0.91], [379, 0.58, 0.89],
    [365, 0.62, 0.85], [397, 0.66, 0.80], [288, 0.69, 0.73], [361, 0.72, 0.65],
    [323, 0.74, 0.55], [389, 0.70, 0.36],
  ]
  for (const [i, x, y] of outline) put(i, x, y)
  put(10, 0.50, 0.20)

  put(33, 0.355, 0.405)
  put(133, 0.455, 0.408)
  put(159, 0.405, 0.392)
  put(145, 0.405, 0.422)
  put(7, 0.365, 0.412)
  put(163, 0.378, 0.418)
  put(144, 0.392, 0.421)
  put(153, 0.420, 0.420)
  put(154, 0.435, 0.416)
  put(155, 0.445, 0.412)
  put(246, 0.365, 0.398)
  put(161, 0.378, 0.393)
  put(160, 0.392, 0.390)
  put(158, 0.420, 0.391)
  put(157, 0.435, 0.395)
  put(173, 0.448, 0.400)

  put(362, 0.545, 0.408)
  put(263, 0.645, 0.405)
  put(386, 0.595, 0.392)
  put(374, 0.595, 0.422)
  put(382, 0.555, 0.412)
  put(381, 0.568, 0.418)
  put(380, 0.582, 0.421)
  put(373, 0.610, 0.420)
  put(390, 0.625, 0.416)
  put(249, 0.638, 0.412)
  put(398, 0.552, 0.400)
  put(384, 0.565, 0.395)
  put(385, 0.580, 0.391)
  put(387, 0.610, 0.390)
  put(388, 0.625, 0.393)
  put(466, 0.638, 0.398)

  put(70, 0.340, 0.340)
  put(63, 0.365, 0.328)
  put(105, 0.395, 0.322)
  put(66, 0.425, 0.326)
  put(107, 0.450, 0.335)
  put(55, 0.448, 0.348)
  put(65, 0.420, 0.345)
  put(52, 0.390, 0.346)
  put(53, 0.365, 0.350)
  put(46, 0.345, 0.352)

  put(300, 0.660, 0.340)
  put(293, 0.635, 0.328)
  put(334, 0.605, 0.322)
  put(296, 0.575, 0.326)
  put(336, 0.550, 0.335)
  put(285, 0.552, 0.348)
  put(295, 0.580, 0.345)
  put(282, 0.610, 0.346)
  put(283, 0.635, 0.350)
  put(276, 0.655, 0.352)

  put(168, 0.50, 0.38)
  put(6, 0.50, 0.43)
  put(197, 0.50, 0.48)
  put(195, 0.50, 0.52)
  put(5, 0.50, 0.55)
  put(4, 0.50, 0.575)
  put(1, 0.50, 0.585)
  put(2, 0.50, 0.60)
  put(98, 0.455, 0.585)
  put(327, 0.545, 0.585)
  put(97, 0.475, 0.595)
  put(326, 0.525, 0.595)

  put(61, 0.400, 0.690)
  put(291, 0.600, 0.690)
  put(0, 0.500, 0.675)
  put(17, 0.500, 0.725)
  put(13, 0.500, 0.695)
  put(37, 0.470, 0.678)
  put(267, 0.530, 0.678)
  put(39, 0.445, 0.682)
  put(269, 0.555, 0.682)
  put(40, 0.425, 0.686)
  put(270, 0.575, 0.686)
  put(185, 0.412, 0.688)
  put(409, 0.588, 0.688)
  put(146, 0.415, 0.705)
  put(91, 0.435, 0.715)
  put(181, 0.460, 0.722)
  put(84, 0.480, 0.725)
  put(314, 0.520, 0.725)
  put(405, 0.540, 0.722)
  put(321, 0.565, 0.715)
  put(375, 0.585, 0.705)
  put(78, 0.420, 0.698)
  put(308, 0.580, 0.698)
  put(191, 0.440, 0.696)
  put(80, 0.460, 0.694)
  put(81, 0.480, 0.693)
  put(82, 0.490, 0.693)
  put(312, 0.510, 0.693)
  put(311, 0.520, 0.693)
  put(310, 0.540, 0.694)
  put(415, 0.560, 0.696)

  return lm
}

// ── Aspect / validation / canonicalize ───────────────────────────────────

export function applyImageAspect(landmarks, imageWidth, imageHeight) {
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('imageWidth and imageHeight must be > 0')
  }
  const sy = imageHeight / imageWidth
  return landmarks.map((p) => ({
    x: Number(p.x),
    y: Number(p.y) * sy,
    z: Number(p.z ?? 0),
  }))
}

export function validateLandmarks(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { valid: false, warnings: ['too few landmarks'] }
  }
  try {
    const outline = FACE_OUTLINE.map((i) => pt(landmarks, i))
    const le = LEFT_EYE.map((i) => pt(landmarks, i))
    const re = RIGHT_EYE.map((i) => pt(landmarks, i))
    if (dedupe(outline).length < 8) {
      return { valid: false, warnings: ['face_outline sparse'] }
    }
    if (dist(le[0], le[le.length - 1]) < 1e-4 && bboxSpan(le) < 1e-3) {
      return { valid: false, warnings: ['left_eye invalid'] }
    }
    if (bboxSpan(re) < 1e-3) {
      return { valid: false, warnings: ['right_eye invalid'] }
    }
    return { valid: true, warnings: [] }
  } catch (err) {
    return { valid: false, warnings: [String(err?.message || err)] }
  }
}

function eyeCenters(landmarks) {
  const rc = centroid(RIGHT_EYE.map((i) => pt(landmarks, i)))
  const lc = centroid(LEFT_EYE.map((i) => pt(landmarks, i)))
  return [rc, lc]
}

export function canonicalize(landmarks) {
  const [rc, lc] = eyeCenters(landmarks)
  const eyeMid = mid(rc, lc)
  const angle = Math.atan2(lc[1] - rc[1], lc[0] - rc[0])
  const ied = dist(rc, lc) || 1e-6
  const targetIed = 0.28
  const s = targetIed / ied
  const targetCenter = [0.5, 0.48]

  return landmarks.map((p) => {
    let xy = [Number(p.x), Number(p.y)]
    xy = rotate(xy, -angle, eyeMid)
    xy = add(scalePt(sub(xy, eyeMid), s), targetCenter)
    return { x: xy[0], y: xy[1], z: Number(p.z ?? 0) }
  })
}

// ── Feature extraction + simplification ────────────────────────────────────

export function extractGroups(landmarks) {
  const g = {}
  for (const [name, spec] of Object.entries(FACE_GROUPS)) {
    if (typeof spec === 'number') {
      g[name] = pt(landmarks, spec)
    } else {
      g[name] = spec.map((i) => pt(landmarks, i))
    }
  }
  return g
}

function simplifyFaceOutline(pts) {
  return subsample(dedupe(pts), Math.min(18, pts.length))
}

function simplifyEye(upper, lower) {
  const u = dedupe(upper)
  const lo = dedupe(lower)
  const allPts = [...u, ...lo]
  const leftPt = allPts.reduce((a, b) => (b[0] < a[0] ? b : a))
  const rightPt = allPts.reduce((a, b) => (b[0] > a[0] ? b : a))
  const upperPts = subsample(u, 5)
  const lowerPts = subsample(lo.length > 2 ? lo.slice(1, -1) : lo, 3)
  const contour = dedupe([leftPt, ...upperPts, rightPt, ...lowerPts.slice().reverse(), leftPt])
  const span = bboxSpan(allPts) || 1e-3
  const creaseOff = span * 0.18
  const crease = subsample(u, 5).map((p) => [p[0], p[1] - creaseOff])
  return { contour, crease, corners: [leftPt, rightPt] }
}

function simplifyBrow(upper, lower) {
  const u = subsample(dedupe(upper), 5)
  const lo = subsample(dedupe(lower), 4)
  return dedupe([...u, ...lo, u[0]])
}

function simplifyNose(bridge, tip, leftAlar, rightAlar) {
  const b = subsample(dedupe([...bridge, tip]), 5)
  const midAlar = mid(leftAlar, rightAlar)
  const half = dist(leftAlar, rightAlar) * 0.5
  const baseY = tip[1] + Math.max(half * 0.87, Math.abs(midAlar[1] - tip[1]))
  const rightBase = [tip[0] - half, baseY]
  const leftBase = [tip[0] + half, baseY]
  return { bridge: b, triangle: [tip, rightBase, leftBase, tip] }
}

function simplifyLips(upper, lower, inner) {
  const u = subsample(dedupe(upper), 9)
  const lo = subsample(dedupe(lower), 9)
  let outer = dedupe([...u, ...lo.slice(1)])
  if (outer.length && (outer[0][0] !== outer[outer.length - 1][0] || outer[0][1] !== outer[outer.length - 1][1])) {
    outer = [...outer, outer[0]]
  }
  let line = []
  if (u.length >= 2 && lo.length >= 2) {
    const left = [...u, ...lo].reduce((a, b) => (b[0] > a[0] ? b : a))
    const right = [...u, ...lo].reduce((a, b) => (b[0] < a[0] ? b : a))
    const midY = (centroid(u)[1] + centroid(lo)[1]) * 0.5
    line = [[right[0], midY], [left[0], midY]]
  } else if (inner?.length) {
    line = subsample(dedupe(inner), 4)
  }
  return { outer, line }
}

export function buildFeatureGeometry(groups) {
  return {
    face: simplifyFaceOutline(groups.face_outline),
    right_brow: simplifyBrow(groups.right_brow_upper, groups.right_brow_lower),
    left_brow: simplifyBrow(groups.left_brow_upper, groups.left_brow_lower),
    right_eye: simplifyEye(groups.right_eye_upper, groups.right_eye_lower),
    left_eye: simplifyEye(groups.left_eye_upper, groups.left_eye_lower),
    nose: simplifyNose(
      groups.nose_bridge,
      groups.nose_tip,
      groups.nose_left_alar,
      groups.nose_right_alar,
    ),
    lips: simplifyLips(groups.upper_lip, groups.lower_lip, groups.lip_inner),
  }
}

// ── Bézier paths + layout ──────────────────────────────────────────────────

export function catmullRomToPathD(points, { closed = false, tension = 6.0 } = {}) {
  const pts = dedupe(points)
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${fmt(pts[0])} L ${fmt(pts[1])}`

  let work = pts
  if (closed && (work[0][0] !== work[work.length - 1][0] || work[0][1] !== work[work.length - 1][1])) {
    work = [...work, work[0]]
  }
  const ext = closed
    ? [work[work.length - 2], ...work, work[1]]
    : [work[0], ...work, work[work.length - 1]]

  const d = [`M ${fmt(work[0])}`]
  for (let i = 0; i < work.length - 1; i += 1) {
    const p0 = ext[i]
    const p1 = ext[i + 1]
    const p2 = ext[i + 2]
    const p3 = ext[i + 3]
    const c1 = [p1[0] + (p2[0] - p0[0]) / tension, p1[1] + (p2[1] - p0[1]) / tension]
    const c2 = [p2[0] - (p3[0] - p1[0]) / tension, p2[1] - (p3[1] - p1[1]) / tension]
    d.push(`C ${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`)
  }
  if (closed) d.push('Z')
  return d.join(' ')
}

function geomPoints(geom) {
  return [
    ...geom.face,
    ...geom.right_brow,
    ...geom.left_brow,
    ...geom.right_eye.contour,
    ...geom.left_eye.contour,
    ...geom.nose.bridge,
    ...geom.nose.triangle,
    ...geom.lips.outer,
  ]
}

export function fitTransform(geom, width, height, margin = 0.14) {
  const pts = geomPoints(geom)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  let minX = Math.min(...xs)
  let maxX = Math.max(...xs)
  let minY = Math.min(...ys)
  let maxY = Math.max(...ys)
  const padX = (maxX - minX) * 0.08 + 1e-6
  const padY = (maxY - minY) * 0.10 + 1e-6
  minX -= padX
  maxX += padX
  minY -= padY
  maxY += padY
  const bw = maxX - minX
  const bh = maxY - minY
  const usableW = width * (1 - 2 * margin)
  const usableH = height * (1 - 2 * margin)
  const s = Math.min(usableW / bw, usableH / bh)
  const ox = (width - bw * s) * 0.5 - minX * s
  const oy = (height - bh * s) * 0.5 - minY * s
  return (p) => [p[0] * s + ox, p[1] * s + oy]
}

function pathSpec(d, key, { fill = 'none', fillOpacity } = {}) {
  return {
    d,
    stroke: STYLE.stroke,
    strokeWidth: STYLE.widths[key] ?? STYLE.widths.secondary,
    strokeOpacity: STYLE.opacity[key] ?? STYLE.opacity.secondary,
    fill,
    ...(fillOpacity != null ? { fillOpacity } : {}),
  }
}

function mappedGeomPoints(geom, mapper) {
  return geomPoints(geom).map(mapper)
}

function tightViewBoxFromPoints(pts, pad = 28) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs) - pad
  const minY = Math.min(...ys) - pad
  const maxX = Math.max(...xs) + pad
  const maxY = Math.max(...ys) + pad
  const w = maxX - minX
  const h = maxY - minY
  return {
    viewBox: `${minX} ${minY} ${w} ${h}`,
    aspectRatio: w / h,
  }
}

/**
 * Build structured diagram data for React SVG rendering.
 * Returns null when landmarks are invalid (report shows empty state).
 */
export function buildFaceDiagram({
  landmarks,
  imageWidth,
  imageHeight,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  margin = DEFAULT_FIT_MARGIN,
} = {}) {
  if (!landmarks?.length) return null

  let raw = landmarks.map((p) => ({
    x: Number(p.x ?? p[0]),
    y: Number(p.y ?? p[1]),
    z: Number(p.z ?? p[2] ?? 0),
  }))

  if (imageWidth > 0 && imageHeight > 0) {
    raw = applyImageAspect(raw, imageWidth, imageHeight)
  }

  const validation = validateLandmarks(raw)
  if (!validation.valid) return null

  const canon = canonicalize(raw)
  const groups = extractGroups(canon)
  const geom = buildFeatureGeometry(groups)
  const mapper = fitTransform(geom, width, height, margin)

  const paths = []

  const faceC = mapPts(geom.face, mapper)
  paths.push(pathSpec(catmullRomToPathD(faceC, { closed: false, tension: 7.0 }), 'face'))

  for (const key of ['right_brow', 'left_brow']) {
    const brow = mapPts(geom[key], mapper)
    paths.push(pathSpec(catmullRomToPathD(brow, { closed: true, tension: 8.0 }), 'brow'))
  }

  for (const key of ['right_eye', 'left_eye']) {
    const eye = geom[key]
    const contour = mapPts(eye.contour, mapper)
    paths.push(pathSpec(catmullRomToPathD(contour, { closed: true }), 'eye'))
    const crease = mapPts(eye.crease, mapper)
    if (crease.length >= 2) {
      paths.push(pathSpec(catmullRomToPathD(crease, { closed: false }), 'crease'))
    }
  }

  const bridge = mapPts(geom.nose.bridge, mapper)
  paths.push(pathSpec(catmullRomToPathD(bridge, { closed: false }), 'nose'))

  const tri = mapPts(geom.nose.triangle, mapper)
  if (tri.length >= 3) {
    paths.push(
      pathSpec(`M ${fmt(tri[0])} L ${fmt(tri[1])} L ${fmt(tri[2])} Z`, 'nose'),
    )
  }

  const outer = mapPts(geom.lips.outer, mapper)
  paths.push(pathSpec(catmullRomToPathD(outer, { closed: true }), 'lips'))

  const line = mapPts(geom.lips.line, mapper)
  if (line.length >= 2) {
    paths.push(pathSpec(`M ${fmt(line[0])} L ${fmt(line[line.length - 1])}`, 'lip_line'))
  }

  const bounds = tightViewBoxFromPoints(mappedGeomPoints(geom, mapper))

  return {
    viewBox: bounds.viewBox,
    aspectRatio: bounds.aspectRatio,
    bg: STYLE.bg,
    paths,
  }
}
