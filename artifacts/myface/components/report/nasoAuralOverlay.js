/**
 * Naso-aural overlay geometry (image % 0–100).
 *
 * Ear vertical caliper (helix top → soft-lobe bottom) plus optional white dashed
 * horizontal nose level guides at glabella and subnasale. No nose vertical line.
 */

/** Reject crown lock; match backend naso_aural_guide_overlay._MIN_GUIDE_Y. */
const MIN_GUIDE_Y01 = 0.12

export function toImagePct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n >= 0 && n <= 1.5) return n * 100
  return n
}

export function noseHeightToPct(raw) {
  const n = Number(raw)
  if (!(Number.isFinite(n) && n > 0)) return null
  const pct = n > 1.5 ? n : n * 100
  return pct > 0.5 ? pct : null
}

export function normPoint01(pt) {
  if (!pt || typeof pt !== 'object') return null
  const x = Number(pt.x)
  const y = Number(pt.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (x > 1.5 || y > 1.5) return { x: x / 100, y: y / 100 }
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) return { x, y }
  return null
}

/** Match backend `_guides_crown_plausible` — no max-span gate (tight head crops can exceed 0.25). */
export function guidesCrownPlausible(glabella, noseBottom) {
  const g = normPoint01(glabella)
  const nb = normPoint01(noseBottom)
  if (!g || !nb) return false
  if (g.y < MIN_GUIDE_Y01 || nb.y < MIN_GUIDE_Y01 || nb.y <= g.y + 0.005) return false
  return true
}

/** Trust BE-persisted dashed segments when Ys clear the crown band (same min as BE). */
export function storedGuidesUsable(guides) {
  if (!Array.isArray(guides) || guides.length < 2) return false
  const ys = guides.map((g) => Number(g?.y)).filter(Number.isFinite)
  if (ys.length < 2) return false
  return ys.every((y) => y >= MIN_GUIDE_Y01 * 100)
}

/**
 * Dashed horizontals from ear vertical x to glabella/subnasale x (image % 0–100).
 */
export function buildNoseLevelGuides({
  glabella,
  noseBottom,
  verticalXPct,
}) {
  const g = normPoint01(glabella)
  const nb = normPoint01(noseBottom)
  const vx = Number(verticalXPct)
  if (!g || !nb || !Number.isFinite(vx)) return []
  if (!guidesCrownPlausible(g, nb)) return []

  const seg = (yNorm, landmarkXNorm) => {
    const lx = landmarkXNorm * 100
    const yPct = yNorm * 100
    const x1 = Math.min(vx, lx)
    const x2 = Math.max(vx, lx)
    return { y: yPct, x1, x2, dashed: true }
  }

  return [seg(g.y, g.x), seg(nb.y, nb.x)]
}

/**
 * Resolve dashed nose-level guides for the profile plate.
 *
 * Prefer sidecar `guideGlabella` / `guideNoseBottom` only — never cephalometric
 * `glabella` / `noseBottom` (FaceMesh G / full-frame silhouette often locks near
 * the hairline and was overwriting correct stored guides). Fall back to trusted
 * persisted `overlay.guides`; otherwise no dashed lines (ear caliper only).
 */
export function resolveNoseLevelGuidesForDraw({
  guideGlabella,
  guideNoseBottom,
  storedGuides,
  verticalXPct,
}) {
  const vx = Number(verticalXPct)
  if (Number.isFinite(vx) && guidesCrownPlausible(guideGlabella, guideNoseBottom)) {
    const guides = buildNoseLevelGuides({
      glabella: guideGlabella,
      noseBottom: guideNoseBottom,
      verticalXPct: vx,
    })
    if (guides.length) return guides
  }
  if (storedGuidesUsable(storedGuides)) {
    return storedGuides.filter((g) => g?.dashed !== false)
  }
  return []
}

/**
 * Ear vertical caliper + optional nose level guides.
 */
export function buildNasoAuralDrawSpec({
  helixTop,
  softBottom,
  xMinNorm,
  xMaxNorm,
  verticalBracketXNorm,
  facingRight = true,
  gap = 2.0,
  glabella = null,
  noseBottom = null,
}) {
  const y0 = toImagePct(helixTop?.y)
  const y1 = toImagePct(softBottom?.y)
  if (y0 == null || y1 == null || Math.abs(y1 - y0) < 0.5) return null

  const earTopY = Math.min(y0, y1)
  const earBotY = Math.max(y0, y1)

  const xa = toImagePct(xMaxNorm)
  const xi = toImagePct(xMinNorm)
  let earX
  if (xa != null && xi != null) {
    earX = facingRight ? xa + gap : xi - gap
  } else {
    const vb = toImagePct(verticalBracketXNorm)
    if (vb != null) earX = vb
    else {
      const hx = toImagePct(helixTop?.x)
      if (hx == null) return null
      earX = hx + (facingRight ? gap : -gap)
    }
  }
  earX = Math.max(0.5, Math.min(99.5, earX))

  const tick = 3.5

  const guides = buildNoseLevelGuides({
    glabella,
    noseBottom,
    verticalXPct: earX,
  })

  const layout = guides.length ? 'earPlusNoseGuides-v6' : 'earOnly-v5'
  const out = {
    style: 'qoves',
    nasoLayout: layout,
    facingRight: !!facingRight,
    brackets: [
      {
        id: 'earVertical',
        x1: earX,
        y1: earTopY,
        x2: earX,
        y2: earBotY,
        tick,
      },
    ],
    horizontal: [
      { y: earTopY, x1: earX - tick, x2: earX + tick, dashed: false },
      { y: earBotY, x1: earX - tick, x2: earX + tick, dashed: false },
    ],
  }
  if (guides.length) out.guides = guides
  return out
}
