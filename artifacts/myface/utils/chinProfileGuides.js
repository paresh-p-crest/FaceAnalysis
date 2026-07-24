import { analyzeWithMediaPipe } from './mediapipeAnalysis'

function asNorm(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  if (v > 1.5) return v / 100
  return v
}

function point(p) {
  if (!p || typeof p !== 'object') return null
  const x = asNorm(p.x)
  const y = asNorm(p.y)
  if (x == null || y == null) return null
  return { id: p.id || null, x, y }
}

function collectPts(overlay) {
  const pts = []
  for (const p of overlay?.convexityPoints || []) {
    const q = point(p)
    if (q) pts.push(q)
  }
  for (const p of overlay?.eLine || []) {
    const q = point(p)
    if (q) pts.push({ ...q, id: null })
  }
  return pts
}

/** Default right-profile shape (nose toward +x / right edge). */
export const DEFAULT_CHIN_OVERLAY_RIGHT = {
  convexityPoints: [
    { id: 'G', x: 0.62, y: 0.3 },
    { id: 'N', x: 0.66, y: 0.36 },
    { id: 'Sn', x: 0.78, y: 0.5 },
    { id: 'Pog', x: 0.68, y: 0.72 },
  ],
  eLine: [
    { x: 0.84, y: 0.46 },
    { x: 0.68, y: 0.72 },
  ],
}

/** Default left-profile shape (nose toward −x / left edge). */
export const DEFAULT_CHIN_OVERLAY_LEFT = {
  convexityPoints: [
    { id: 'G', x: 0.38, y: 0.3 },
    { id: 'N', x: 0.34, y: 0.36 },
    { id: 'Sn', x: 0.22, y: 0.5 },
    { id: 'Pog', x: 0.32, y: 0.72 },
  ],
  eLine: [
    { x: 0.16, y: 0.46 },
    { x: 0.32, y: 0.72 },
  ],
}

/**
 * @param {string|null|undefined} poseId e.g. rightProfile | leftProfile
 * @returns {'left'|'right'} which image side holds the nose / anterior profile
 */
export function anteriorSideFromPose(poseId) {
  if (poseId === 'leftProfile') return 'left'
  return 'right'
}

export function defaultOverlayForPose(poseId) {
  return anteriorSideFromPose(poseId) === 'left'
    ? DEFAULT_CHIN_OVERLAY_LEFT
    : DEFAULT_CHIN_OVERLAY_RIGHT
}

/**
 * Reject silhouette overlays that collapsed onto hair / a tiny contour.
 */
export function isPlausibleChinOverlay(overlay) {
  const pts = (overlay?.convexityPoints || []).map(point).filter(Boolean)
  if (pts.length < 2) return false
  const ys = pts.map((p) => p.y)
  const xs = pts.map((p) => p.x)
  const ySpan = Math.max(...ys) - Math.min(...ys)
  const xSpan = Math.max(...xs) - Math.min(...xs)
  if (ySpan < 0.16) return false
  if (Math.max(...ys) < 0.22 && ySpan < 0.22) return false
  if (xSpan < 0.02 && ySpan < 0.2) return false
  return true
}

export function overlayMatchesPose(overlay, poseId) {
  const pts = (overlay?.convexityPoints || []).map(point).filter(Boolean)
  const sn = pts.find((p) => p.id === 'Sn') || pts[1]
  if (!sn) return false
  return sn.x >= 0.02 && sn.x <= 0.98
}

/** Build overlay from MediaPipe profile landmarks (same indices as backend facemesh path). */
export function overlayFromProfileLandmarks(landmarks) {
  if (!landmarks?.length) return null
  const at = (i) => {
    const p = landmarks[i]
    if (!p) return null
    return { x: p.x, y: p.y }
  }
  const G = at(10)
  const N = at(168) || at(6)
  const Sn = at(2)
  const Pog = at(152)
  const Pn = at(4) // Pronasale is 4
  const upperLip = at(0) // Upper lip center is 0
  if (!G || !Sn || !Pog) return null
  // Classic Ricketts order: Pronasale → soft-tissue Pogonion
  const overlay = {
    convexityPoints: [
      { id: 'G', x: G.x, y: G.y },
      ...(N ? [{ id: 'N', x: N.x, y: N.y }] : []),
      { id: 'Sn', x: Sn.x, y: Sn.y },
      { id: 'Pog', x: Pog.x, y: Pog.y },
      ...(upperLip ? [{ id: 'upper_lip', x: upperLip.x, y: upperLip.y }] : []),
    ],
    eLine: Pn && Pog ? [{ x: Pn.x, y: Pn.y }, { x: Pog.x, y: Pog.y }] : [],
  }
  return isPlausibleChinOverlay(overlay) ? overlay : null
}

/** Visible image region (0–1) for object-fit:cover into boxW×boxH. */
export function coverVisibleNormRect(imgW, imgH, boxW, boxH, poseId = null) {
  if (!imgW || !imgH || boxW <= 0 || boxH <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 }
  }
  const scale = Math.max(boxW / imgW, boxH / imgH)
  const sw = boxW / scale
  const sh = boxH / scale
  let sx = (imgW - sw) / 2
  const sy = (imgH - sh) / 2

  if (poseId === 'rightProfile') {
    sx = (imgW - sw) * 0.85
  } else if (poseId === 'leftProfile') {
    sx = (imgW - sw) * 0.15
  }
  return { x: sx / imgW, y: sy / imgH, w: sw / imgW, h: sh / imgH }
}

function bboxOf(pts) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const x1 = Math.max(...xs)
  const y1 = Math.max(...ys)
  return { x: x0, y: y0, w: Math.max(1e-4, x1 - x0), h: Math.max(1e-4, y1 - y0) }
}

function mapPt(p, src, dst) {
  return {
    id: p.id || undefined,
    x: dst.x + ((p.x - src.x) / src.w) * dst.w,
    y: dst.y + ((p.y - src.y) / src.h) * dst.h,
  }
}

/**
 * Anterior soft-tissue band inside the cover-visible rect (nose / lips / chin side).
 * @param {'left'|'right'} anteriorSide
 */
export function profileGuideBandInCover(vis, anteriorSide = 'right') {
  const bandW = vis.w * 0.4
  const bandH = vis.h * 0.58
  const bandY = vis.y + vis.h * 0.2
  const inset = vis.w * 0.04
  const bandX =
    anteriorSide === 'left' ? vis.x + inset : vis.x + vis.w - inset - bandW
  return { x: bandX, y: bandY, w: bandW, h: bandH }
}

/**
 * Anterior band inside the *face content* ∩ cover window — not the frame’s
 * right padding (which made Pn / verticals float in empty gray beside the face).
 */
export function profileGuideBandInFaceContent(vis, faceBounds, anteriorSide = 'right') {
  if (!faceBounds) return profileGuideBandInCover(vis, anteriorSide)
  const x0 = Math.max(vis.x, faceBounds.x0)
  const y0 = Math.max(vis.y, faceBounds.y0)
  const x1 = Math.min(vis.x + vis.w, faceBounds.x1)
  const y1 = Math.min(vis.y + vis.h, faceBounds.y1)
  const fw = x1 - x0
  const fh = y1 - y0
  if (fw < 0.08 || fh < 0.12) return profileGuideBandInCover(vis, anteriorSide)

  const bandW = fw * 0.32
  const bandH = fh * 0.55
  const bandY = y0 + fh * 0.22
  const inset = fw * 0.03
  const bandX =
    anteriorSide === 'left' ? x0 + inset : x1 - inset - bandW
  return { x: bandX, y: bandY, w: bandW, h: bandH }
}

function fractionInside(pts, rect) {
  if (!pts.length) return 0
  let n = 0
  for (const p of pts) {
    if (
      p.x >= rect.x &&
      p.x <= rect.x + rect.w &&
      p.y >= rect.y &&
      p.y <= rect.y + rect.h
    ) {
      n += 1
    }
  }
  return n / pts.length
}

function fitOverlayIntoBand(overlay, band) {
  const pts = collectPts(overlay)
  const srcBox = bboxOf(pts)
  return {
    convexityPoints: (overlay.convexityPoints || [])
      .map(point)
      .filter(Boolean)
      .map((p) => {
        const m = mapPt(p, srcBox, band)
        return { id: p.id, x: m.x, y: m.y }
      }),
    eLine: (overlay.eLine || [])
      .map(point)
      .filter(Boolean)
      .map((p) => {
        const m = mapPt(p, srcBox, band)
        return { x: m.x, y: m.y }
      }),
  }
}

/**
 * Shared luminance + anterior silhouette sampler for a profile HTMLImage.
 * @returns {{ silhouetteXAt: (ny: number) => number|null, w: number, h: number } | null}
 */
/**
 * Build luminance sampler + anterior silhouette finder.
 * Optional contentBounds (norm 0–1) limits search to the real photo (excludes
 * rotation padding), which otherwise made guides float in empty margin.
 */
export function createProfileSilhouetteSampler(img, poseId = 'rightProfile', contentBounds = null) {
  if (!img?.width || !img?.height) return null
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  let data
  try {
    data = ctx.getImageData(0, 0, w, h).data
  } catch {
    return null
  }

  const lum = (x, y) => {
    const xi = Math.max(0, Math.min(w - 1, x | 0))
    const yi = Math.max(0, Math.min(h - 1, y | 0))
    const i = (yi * w + xi) * 4
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }

  // Corner luminance ≈ padding / backdrop. On a tight cover crop, corners may be
  // skin/hair — blend with a bright percentile so faceThresh does not collapse.
  const corners = [
    lum(2, 2),
    lum(w - 3, 2),
    lum(2, h - 3),
    lum(w - 3, h - 3),
  ]
  const cornerBg = corners.reduce((a, b) => a + b, 0) / corners.length
  let brightSum = 0
  let brightN = 0
  const probe = Math.max(4, Math.floor(Math.min(w, h) / 40))
  for (let y = 0; y < h; y += probe) {
    for (let x = 0; x < w; x += probe) {
      brightSum += lum(x, y)
      brightN += 1
    }
  }
  const meanLum = brightN ? brightSum / brightN : cornerBg
  // Prefer the brighter of corner vs scene mean as "backdrop" estimate
  const backdrop = Math.max(cornerBg, meanLum + 8)
  const faceThresh = backdrop - 28

  const bounds = contentBounds || (() => {
    let minX = w
    let maxX = 0
    let minY = h
    let maxY = 0
    const step = Math.max(2, Math.floor(Math.min(w, h) / 200))
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (lum(x, y) < faceThresh) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return { x0: 0, y0: 0, x1: 1, y1: 1 }
    const padX = (maxX - minX) * 0.03
    const padY = (maxY - minY) * 0.03
    return {
      x0: Math.max(0, (minX - padX) / w),
      y0: Math.max(0, (minY - padY) / h),
      x1: Math.min(1, (maxX + padX) / w),
      y1: Math.min(1, (maxY + padY) / h),
    }
  })()

  const noseRight = anteriorSideFromPose(poseId) === 'right'
  const xMinPx = Math.floor(bounds.x0 * w)
  const xMaxPx = Math.ceil(bounds.x1 * w)

  /**
   * Anterior soft-tissue edge per row.
   * Row-local threshold only — do not cap with a low global faceThresh (that
   * erased the silhouette on face-filled cover crops and hid all guides).
   */
  const silhouetteXAt = (ny) => {
    const y = Math.max(0, Math.min(h - 1, Math.round(ny * h)))
    if (ny < bounds.y0 - 0.01 || ny > bounds.y1 + 0.01) return null

    const vals = []
    const step = Math.max(1, Math.floor((xMaxPx - xMinPx) / 160))
    for (let x = xMinPx; x < xMaxPx; x += step) vals.push(lum(x, y))
    if (vals.length < 8) return null
    vals.sort((a, b) => a - b)
    const q20 = vals[Math.floor(vals.length * 0.2)]
    const q80 = vals[Math.floor(vals.length * 0.8)]
    // Flat rows (only padding) have no usable edge
    if (q80 - q20 < 10) return null
    const rowThresh = (q20 + q80) * 0.5

    const isFace = (x) => lum(x, y) < rowThresh
    const solidDark = (x, dir) => {
      let n = 0
      for (let k = 0; k < 4; k += 1) {
        const xx = x + dir * k
        if (xx < xMinPx || xx >= xMaxPx) break
        if (isFace(xx)) n += 1
      }
      return n >= 2
    }

    if (noseRight) {
      for (let x = xMaxPx - 1; x >= xMinPx; x -= 1) {
        if (isFace(x) && solidDark(x, -1)) {
          return Math.max(0, (x - 1) / w)
        }
      }
    } else {
      for (let x = xMinPx; x <= xMaxPx; x += 1) {
        if (isFace(x) && solidDark(x, 1)) {
          return Math.min(1, (x + 1) / w)
        }
      }
    }
    return null
  }

  return { silhouetteXAt, w, h, noseRight, bounds, faceThresh }
}

/**
 * Rasterize the same center-cover crop the PDF PROFILE plate shows.
 * Returned canvas is image-like (width/height); coords on it are plate 0–1 space.
 */
export function rasterizeProfileCoverCrop(img, boxW, boxH, pixelScale = 2.5) {
  if (!img?.width || !img?.height || boxW <= 0 || boxH <= 0) return null
  const outW = Math.max(80, Math.round(boxW * pixelScale))
  const outH = Math.max(80, Math.round(boxH * pixelScale))
  const scale = Math.max(outW / img.width, outH / img.height)
  const sw = outW / scale
  const sh = outH / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
  return canvas
}

/**
 * Detect Pn / lip / Pog on the soft-tissue outline inside the real photo content
 * (ignores rotation padding so guides don't float in empty margin).
 * Points are normalized to the image (or cover-crop canvas) passed in.
 *
 * Pn = local anterior peak at nose-tip height (not global max — pitched heads
 * make forehead more anterior than the tip). Pog = soft-tissue chin tip on the
 * contour, never floating past the face into padding.
 */
export function detectChinProjectionFromImage(img, poseId = 'rightProfile', storedOverlay = null) {
  let contentBounds = null
  if (storedOverlay?.convexityPoints?.length) {
    const xs = storedOverlay.convexityPoints.map(p => p.x).filter(x => typeof x === 'number')
    if (xs.length) {
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      contentBounds = {
        x0: Math.max(0.01, minX - 0.12),
        y0: 0.1,
        x1: Math.min(0.99, maxX + 0.12),
        y1: 0.95
      }
    }
  }
  const sampler = createProfileSilhouetteSampler(img, poseId, contentBounds)
  if (!sampler) return null
  const { silhouetteXAt, noseRight, bounds } = sampler

  const ySearch0 = bounds.y0 + (bounds.y1 - bounds.y0) * 0.04
  const ySearch1 = bounds.y0 + (bounds.y1 - bounds.y0) * 0.96
  const faceYs = []
  for (let y = ySearch0; y <= ySearch1; y += 0.008) {
    const x = silhouetteXAt(y)
    if (x == null) continue
    faceYs.push({ y, x })
  }
  if (faceYs.length < 10) return null

  const faceTop = faceYs[0].y
  const faceBot = faceYs[faceYs.length - 1].y
  const faceH = Math.max(0.05, faceBot - faceTop)

  const sampleBand = (ya, yb, step = 0.004) => {
    const rows = []
    for (let y = ya; y <= yb; y += step) {
      const x = silhouetteXAt(y)
      if (x != null) rows.push({ x, y })
    }
    return rows
  }

  const antScore = (x) => (noseRight ? x : -x)

  // Pronasale: anterior peak in mid/lower nose band only (skip eye/brow)
  const noseRows = sampleBand(faceTop + faceH * 0.38, faceTop + faceH * 0.58)
  if (noseRows.length < 5) return null
  let nose = null
  let nosePeak = -Infinity
  for (let i = 1; i < noseRows.length - 1; i += 1) {
    const r = noseRows[i]
    const score = antScore(r.x)
    const isPeak =
      score >= antScore(noseRows[i - 1].x) - 1e-6 &&
      score >= antScore(noseRows[i + 1].x) - 1e-6
    // Strongly prefer lower tip vs bridge
    const tipBias = (r.y - noseRows[0].y) / Math.max(1e-4, noseRows[noseRows.length - 1].y - noseRows[0].y)
    const ranked = score + tipBias * 0.04
    if (isPeak && ranked >= nosePeak) {
      nosePeak = ranked
      nose = r
    }
  }
  // Fallback: most anterior in lower half of nose band only
  if (!nose) {
    const lo = noseRows[Math.floor(noseRows.length * 0.45)]
    const tipRows = noseRows.filter((r) => r.y >= lo.y)
    nose = tipRows.reduce((best, r) => (!best || antScore(r.x) > antScore(best.x) ? r : best), null)
  }
  if (!nose) return null
  // After clockwise pitch, row-scan silhouette sits slightly posterior to the
  // visible tip — nudge anterior so verticals land on the nose tip / soft tissue.
  if (noseRight) nose = { x: Math.min(1, nose.x + 0.012), y: nose.y }
  else nose = { x: Math.max(0, nose.x - 0.012), y: nose.y }

  // Soft-tissue pogonion = most anterior point on the chin tip (not under-chin)
  const chinRows = sampleBand(faceTop + faceH * 0.74, faceTop + faceH * 0.92, 0.003)
  if (chinRows.length < 3) return null
  let chin = null
  let chinBest = -Infinity
  for (const r of chinRows) {
    const depth = (r.y - nose.y) / faceH
    if (depth < 0.15) continue
    const ranked = antScore(r.x) + depth * 0.02
    if (ranked > chinBest) {
      chinBest = ranked
      chin = r
    }
  }
  if (!chin) {
    chin = chinRows[chinRows.length - 1]
  }

  const chinOnEdge = silhouetteXAt(chin.y)
  if (chinOnEdge != null) {
    chin = {
      x: noseRight
        ? Math.min(1, chinOnEdge + 0.01)
        : Math.max(0, chinOnEdge - 0.01),
      y: chin.y,
    }
  }

  if (chin.y < nose.y + faceH * 0.15) return null

  const midX = (bounds.x0 + bounds.x1) / 2
  if (noseRight && nose.x < midX - 0.05) return null
  if (!noseRight && nose.x > midX + 0.05) return null

  // Chin should not float past the nose tip into empty air
  if (noseRight && chin.x > nose.x + 0.015) chin = { x: nose.x, y: chin.y }
  if (!noseRight && chin.x < nose.x - 0.015) chin = { x: nose.x, y: chin.y }

  // Subnasale: clearly below the nose tip (not on Pronasale)
  const pnChin = Math.max(0.08, chin.y - nose.y)
  const lipY = nose.y + pnChin * 0.16
  let lipX = silhouetteXAt(lipY)
  if (lipX == null) lipX = (nose.x + chin.x) / 2
  // Keep Sn on the facial plane behind the tip (underside of nose is still too anterior)
  if (noseRight) {
    lipX = Math.min(lipX, nose.x - 0.04)
    lipX = Math.max(lipX, chin.x)
  } else {
    lipX = Math.max(lipX, nose.x + 0.04)
    lipX = Math.min(lipX, chin.x)
  }

  const browY = faceTop + faceH * 0.16
  const browX = silhouetteXAt(browY) ?? lipX

  return {
    convexityPoints: [
      { id: 'G', x: browX, y: browY },
      { id: 'Sn', x: lipX, y: lipY },
      { id: 'Pog', x: chin.x, y: chin.y },
    ],
    // Classic Ricketts order: Pronasale → soft-tissue Pogonion
    eLine: [
      { x: nose.x, y: nose.y },
      { x: chin.x, y: chin.y },
    ],
  }
}

/**
 * Resolve Pn / Sn / Pog for the pitched PROFILE plate.
 * Primary: silhouette on the pitched bitmap (face-content aware).
 * Fallback: pose-correct template in the face-content band, then silhouette-snap.
 * Never uses collapsed overlay coords as absolute positions.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} img pitched profile bitmap
 * @param {string} poseId
 * @param {number} boxW PDF inner box width (for cover-band fallback)
 * @param {number} boxH PDF inner box height
 */
export function resolveChinProjectionOverlay(img, poseId = 'rightProfile', boxW = 0, boxH = 0, storedOverlay = null) {
  if (!img?.width || !img?.height) return null

  const detected = detectChinProjectionFromImage(img, poseId, storedOverlay)
  if (detected && isPlausibleChinOverlay(detected) && overlayMatchesPose(detected, poseId)) {
    return { ...detected, coordSpace: 'image' }
  }
  // Detected but pose/span soft-fail: still usable if eLine spans nose→chin
  if (detected) {
    const e = (detected.eLine || []).map(point).filter(Boolean)
    if (e.length >= 2) {
      const dy = Math.abs(e[0].y - e[1].y)
      if (dy >= 0.06) return { ...detected, coordSpace: 'image' }
    }
  }

  // Fallback: face-content band template + snap (not frame-right padding)
  const prepared = prepareChinOverlayForCoverFrame(
    null,
    img.width,
    img.height,
    boxW || img.width * 0.2,
    boxH || img.height * 0.15,
    poseId,
    img
  )
  const locked = lockChinOverlayToProfile(prepared, img, poseId)
  return { ...locked, coordSpace: 'image' }
}

/**
 * Lock projection landmarks to the visible PROFILE plate (cover crop space).
 * Returned overlay uses coordSpace: 'cover' — map as nx*boxW (no second cover pass).
 */
export function detectChinProjectionFromCoverCrop(img, boxW, boxH, poseId = 'rightProfile') {
  const crop = rasterizeProfileCoverCrop(img, boxW, boxH)
  if (!crop) return null
  const overlay = detectChinProjectionFromImage(crop, poseId)
  if (!overlay) return null
  return { ...overlay, coordSpace: 'cover' }
}

/**
 * Mild presentation pitch for chin-show plates (fixed ~7°).
 * Right profile: clockwise (+7) so the head tips forward like the reference
 * (counter-clockwise was the opposite slant).
 */
export function estimateProfilePresentationPitchDeg(img, poseId = 'rightProfile') {
  return 0
}

/**
 * Rotate an HTMLImage clockwise by deg; returns JPEG data URL (expanded canvas).
 */
export function rotateImageClockwiseDataUrl(img, degClockwise) {
  if (!img?.width || !degClockwise) {
    return null
  }
  const rad = (degClockwise * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = img.width
  const h = img.height
  const outW = Math.ceil(w * cos + h * sin)
  const outH = Math.ceil(w * sin + h * cos)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#d8dde3'
  ctx.fillRect(0, 0, outW, outH)
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -w / 2, -h / 2)
  return canvas.toDataURL('image/jpeg', 0.92)
}

/**
 * Orient profile photo for chin-show plates.
 * Returns null to preserve original unrotated photo without tilt.
 */
export function orientProfileForChinShow(img, poseId = 'rightProfile') {
  return null
}

/**
 * Snap overlay X coords onto the visible soft-tissue profile edge in the photo.
 */
export function snapChinOverlayToSilhouette(overlay, img, poseId = 'rightProfile') {
  const sampler = createProfileSilhouetteSampler(img, poseId)
  if (!sampler || !overlay) return overlay
  const { silhouetteXAt } = sampler

  const snapPt = (p) => {
    if (!p) return p
    const sx = silhouetteXAt(p.y)
    if (sx == null) return { ...p }
    return { ...p, x: sx }
  }

  return {
    convexityPoints: (overlay.convexityPoints || []).map((p) => {
      const q = point(p)
      if (!q) return p
      const s = snapPt(q)
      return { id: q.id, x: s.x, y: s.y }
    }),
    eLine: (overlay.eLine || []).map((p) => {
      const q = point(p)
      if (!q) return p
      const s = snapPt(q)
      return { x: s.x, y: s.y }
    }),
  }
}

/**
 * Ensure overlay points land on the anterior profile of a center-cover PROFILE plate.
 * When `img` is provided, the placement band is the face content (not frame padding).
 */
export function prepareChinOverlayForCoverFrame(
  overlay,
  imgW,
  imgH,
  boxW,
  boxH,
  poseId = 'rightProfile',
  img = null
) {
  const anterior = anteriorSideFromPose(poseId)
  const template = defaultOverlayForPose(poseId)
  const vis = coverVisibleNormRect(imgW, imgH, boxW, boxH, poseId)

  let band = profileGuideBandInCover(vis, anterior)
  if (img?.width) {
    const sampler = createProfileSilhouetteSampler(img, poseId)
    if (sampler?.bounds) {
      band = profileGuideBandInFaceContent(vis, sampler.bounds, anterior)
    }
  }

  const usable =
    isPlausibleChinOverlay(overlay) && overlayMatchesPose(overlay, poseId) ? overlay : null

  if (usable) {
    const rawPts = collectPts(usable)
    if (fractionInside(rawPts, vis) >= 0.6) return usable
    return fitOverlayIntoBand(usable, band)
  }

  return fitOverlayIntoBand(template, band)
}

/**
 * Lock prepared overlay X coords onto soft-tissue outline, and pull the lip /
 * facial plane slightly posterior to Pronasale (Ricketts diagram).
 */
export function lockChinOverlayToProfile(overlay, img, poseId = 'rightProfile') {
  if (!overlay || !img?.width) return overlay
  const snapped = snapChinOverlayToSilhouette(overlay, img, poseId)
  const pts = (snapped.convexityPoints || []).map(point).filter(Boolean)
  const byId = Object.fromEntries(pts.filter((p) => p.id).map((p) => [p.id, p]))
  const eRaw = (snapped.eLine || []).map(point).filter(Boolean)

  let pn = eRaw.length >= 2
    ? eRaw[0].y <= eRaw[1].y
      ? eRaw[0]
      : eRaw[1]
    : null
  const sn = byId.Sn || null
  if (!pn || !sn) return snapped

  const noseRight = anteriorSideFromPose(poseId) === 'right'
  // Facial plane sits behind the nose tip on soft tissue
  let lipX = sn.x
  if (noseRight) lipX = Math.min(sn.x, pn.x - 0.035)
  else lipX = Math.max(sn.x, pn.x + 0.035)

  return {
    ...snapped,
    convexityPoints: (snapped.convexityPoints || []).map((p) => {
      const q = point(p)
      if (!q) return p
      if (q.id === 'Sn') return { id: 'Sn', x: lipX, y: q.y }
      return { id: q.id, x: q.x, y: q.y }
    }),
  }
}

/**
 * Top-plate chin-show guides (Image 2 style):
 * - one vertical just anterior to / on the nose tip
 * - four short horizontals ONLY below the nose (Sn, stomion, labiomental, Pog)
 *   Ray Y is locked to Pn→Pog fractions — overlay Sn/G Y is ignored so eye/cheek rays never appear.
 */
function extractProfileLandmarks(overlay, poseId = 'rightProfile') {
  const pts = (overlay?.convexityPoints || []).map(point).filter(Boolean)
  const byId = Object.fromEntries(pts.filter((p) => p.id).map((p) => [p.id, p]))
  const eRaw = (overlay?.eLine || []).map(point).filter(Boolean)

  const isLeft = poseId === 'leftProfile' || (pts.length > 0 && pts[0].x < 0.3)

  // Default profile landmark coordinates (facing right vs left)
  // Right-facing 3/4 oblique profile anterior features sit around 75–85% (nose tip ~81%, subnasale ~73%, chin ~66%)
  const defPn = isLeft ? { x: 0.15, y: 0.48 } : { x: 0.81, y: 0.48 }
  const defSn = isLeft ? { x: 0.22, y: 0.51 } : { x: 0.73, y: 0.51 }
  const defPog = isLeft ? { x: 0.28, y: 0.68 } : { x: 0.66, y: 0.68 }
  const defLip = isLeft ? { x: 0.24, y: 0.55 } : { x: 0.71, y: 0.55 }
  const defN = isLeft ? { x: 0.25, y: 0.35 } : { x: 0.70, y: 0.35 }

  // 1. Nose tip (Pronasale / Pn)
  let pn = byId.Pn || byId.pronasale || byId.nose_tip || null
  if (!pn && eRaw.length >= 1) {
    pn = eRaw[0].y <= (eRaw[1]?.y ?? Infinity) ? eRaw[0] : eRaw[1]
  }
  if (!pn && pts.length) {
    pn = pts.reduce((best, p) => (!best || (isLeft ? p.x < best.x : p.x > best.x) ? p : best), null)
  }
  if (!pn || (isLeft ? pn.x > 0.5 : pn.x < 0.5)) {
    pn = defPn
  }

  // 2. Subnasale (Sn)
  let Sn = byId.Sn || byId.subnasale || null
  if (!Sn && pts.length >= 2) {
    Sn = pts.find((p) => p.id === 'Sn') || pts[1]
  }
  if (!Sn || (isLeft ? Sn.x > 0.5 : Sn.x < 0.5)) {
    Sn = defSn
  }

  // 3. Chin (Pogonion / Pog)
  let Pog = byId.Pog || byId.pogonion || byId.chin || null
  if (!Pog && eRaw.length >= 2) {
    Pog = eRaw[0].y > eRaw[1].y ? eRaw[0] : eRaw[1]
  }
  if (!Pog && pts.length) {
    Pog = pts.find((p) => p.id === 'Pog') || pts[pts.length - 1]
  }
  if (!Pog || (isLeft ? Pog.x > 0.5 : Pog.x < 0.5)) {
    Pog = defPog
  }

  // 4. Upper Lip
  let upperLip = byId.upper_lip || byId.upperLip || null
  if (!upperLip || (isLeft ? upperLip.x > 0.5 : upperLip.x < 0.5)) {
    upperLip = defLip
  }

  // 5. Nasion (N)
  let N = byId.N || byId.nasion || null
  if (!N || (isLeft ? N.x > 0.5 : N.x < 0.5)) {
    N = defN
  }

  return { pn, Sn, Pog, upperLip, N }
}

export function buildChinProfileGuides(overlay, poseId = 'rightProfile') {
  const { pn, Sn, Pog, upperLip } = extractProfileLandmarks(overlay, poseId)

  return {
    coordSpace: overlay?.coordSpace === 'cover' ? 'cover' : 'image',
    chinShow: {
      nose_tip: { x: pn.x, y: pn.y },
      subnasale: { x: Sn.x, y: Sn.y },
      upper_lip: { x: upperLip.x, y: upperLip.y },
      chin: { x: Pog.x, y: Pog.y },
    },
  }
}

/**
 * Map overlay points through the same clockwise rotation used by
 * `rotateImageClockwiseDataUrl` (expanded canvas, center pivot).
 */
export function transformOverlayThroughClockwiseRotation(overlay, srcW, srcH, degCW) {
  if (!overlay || !srcW || !srcH || !degCW) return overlay
  const rad = (degCW * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const outW = srcW * Math.abs(cos) + srcH * Math.abs(sin)
  const outH = srcW * Math.abs(sin) + srcH * Math.abs(cos)

  const mapOne = (p) => {
    const q = point(p)
    if (!q) return p
    const px = q.x * srcW - srcW / 2
    const py = q.y * srcH - srcH / 2
    // Canvas y-down clockwise rotate
    const rx = px * cos - py * sin
    const ry = px * sin + py * cos
    const out = {
      x: (rx + outW / 2) / outW,
      y: (ry + outH / 2) / outH,
    }
    if (p.id) out.id = p.id
    return out
  }

  return {
    convexityPoints: (overlay.convexityPoints || []).map(mapOne),
    eLine: (overlay.eLine || []).map(mapOne),
  }
}

export function buildChinProjectionGuides(overlay, poseId = 'rightProfile') {
  const { pn, Sn, Pog, N } = extractProfileLandmarks(overlay, poseId)

  return {
    coordSpace: overlay?.coordSpace === 'cover' ? 'cover' : 'image',
    projection: {
      nose_tip: { x: pn.x, y: pn.y },
      subnasale: { x: Sn.x, y: Sn.y },
      nasion: { x: N.x, y: N.y },
      chin: { x: Pog.x, y: Pog.y },
    },
  }
}

/**
 * Map normalized (0–1) image point into a cover-cropped PDF frame.
 */
export function mapNormThroughCover(nx, ny, imgW, imgH, boxX, boxY, boxW, boxH, poseId = null) {
  if (!imgW || !imgH || boxW <= 0 || boxH <= 0) {
    return { x: boxX + nx * boxW, y: boxY + ny * boxH }
  }
  const scale = Math.max(boxW / imgW, boxH / imgH)
  const sw = boxW / scale
  const sh = boxH / scale
  let sx = (imgW - sw) / 2
  const sy = (imgH - sh) / 2

  if (poseId === 'rightProfile') {
    sx = (imgW - sw) * 0.85
  } else if (poseId === 'leftProfile') {
    sx = (imgW - sw) * 0.15
  }

  const fx = (nx * imgW - sx) / sw
  const fy = (ny * imgH - sy) / sh
  return { x: boxX + fx * boxW, y: boxY + fy * boxH }
}

/**
 * Pre-render profile annotations onto image Canvas (replicates Python annotate_profile / OpenCV logic).
 * Returns a Data URL with lines rendered directly onto the face bitmap.
 */
export async function generateAnnotatedChinProfileImage(
  imageSrc,
  style = 'thirds',
  poseId = 'rightProfile',
  rawOverlay = null,
  frameW = 243,
  frameH = 310
) {
  if (!imageSrc || typeof window === 'undefined') return imageSrc
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const imgW = img.naturalWidth || img.width
        const imgH = img.naturalHeight || img.height
        if (!imgW || !imgH) return resolve(imageSrc)

        // Canvas output dimensions matching PDF frame aspect ratio (zoomed cover crop)
        const outW = 800
        const outH = Math.round(outW * (frameH / frameW)) // ~1020px

        const canvas = document.createElement('canvas')
        canvas.width = outW
        canvas.height = outH
        const ctx = canvas.getContext('2d')

        // Compute cover-crop source rectangle on original photo with mild zoom (zoom = 0.85)
        const zoom = 0.85
        const baseScale = Math.max(outW / imgW, outH / imgH)
        const scale = baseScale * zoom
        const sw = Math.min(imgW, outW / scale)
        const sh = Math.min(imgH, outH / scale)
        let sx = Math.max(0, Math.min(imgW - sw, (imgW - sw) / 2))
        const sy = Math.max(0, Math.min(imgH - sh, (imgH - sh) / 2))

        if (poseId === 'rightProfile' || poseId === 'right45') {
          sx = Math.max(0, Math.min(imgW - sw, (imgW - sw) * 0.65))
        } else if (poseId === 'leftProfile' || poseId === 'left45') {
          sx = Math.max(0, Math.min(imgW - sw, (imgW - sw) * 0.35))
        }

        // Draw zoomed cover crop onto canvas
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

        let overlay = rawOverlay
        if (!overlay) {
          try {
            const res = await analyzeWithMediaPipe(imageSrc)
            if (res?.landmarks) {
              overlay = overlayFromProfileLandmarks(res.landmarks)
            }
          } catch (e) {
            /* fall back to landmark extraction bounds */
          }
        }

        const landmarks = extractProfileLandmarks(overlay, poseId)

        // Map normalized image landmark (0-1) to zoomed canvas pixel coordinates
        const mapPt = (p) => ({
          x: ((p.x * imgW - sx) / sw) * outW,
          y: ((p.y * imgH - sy) / sh) * outH,
        })

        const nose_tip = mapPt(landmarks.pn)
        const subnasale = mapPt(landmarks.Sn)
        const upper_lip = mapPt(landmarks.upperLip)
        const chin = mapPt(landmarks.Pog)
        const nasion = mapPt(landmarks.N)

        const lineThickness = Math.max(2, Math.round(outW * 0.0025)) // ~2px clean white stroke

        const drawDashedLine = (x1, y1, x2, y2, color = '#FFFFFF', dash = 6, gap = 4) => {
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = lineThickness
          ctx.setLineDash([dash, gap])
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.restore()
        }

        const drawSolidLine = (x1, y1, x2, y2, color = '#FFFFFF') => {
          ctx.save()
          ctx.strokeStyle = color
          ctx.lineWidth = lineThickness
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          ctx.restore()
        }

        if (style === 'thirds') {
          // Style 1: Nose Projection Lines
          drawSolidLine(nose_tip.x, subnasale.y, nose_tip.x, chin.y)
          drawDashedLine(subnasale.x, subnasale.y, nose_tip.x, subnasale.y)
          drawDashedLine(upper_lip.x, upper_lip.y, nose_tip.x, upper_lip.y)
          drawDashedLine(chin.x, chin.y, nose_tip.x, chin.y)
        } else {
          // Style 2: E-Line & True Verticals
          const extraY = Math.max(6, Math.round((chin.y - subnasale.y) * 0.05))
          drawSolidLine(nose_tip.x, nose_tip.y, chin.x, chin.y)
          drawSolidLine(nasion.x, nasion.y, nasion.x, chin.y + extraY)
          // Second vertical line from subnasale is dotted/dashed
          drawDashedLine(subnasale.x, subnasale.y, subnasale.x, chin.y + extraY)
        }

        resolve(canvas.toDataURL('image/jpeg', 0.92))
      } catch (err) {
        console.warn('Canvas profile annotation failed:', err)
        resolve(imageSrc)
      }
    }
    img.onerror = () => resolve(imageSrc)
    img.src = imageSrc
  })
}
