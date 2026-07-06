/**
 * Canvas compositing helpers — warps, path painting, localized healing.
 * No global brightness/contrast filters.
 */

export function sampleBilinear(data, w, h, x, y) {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)))
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)))
  const x1 = Math.min(w - 1, x0 + 1)
  const y1 = Math.min(h - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const i = (px, py) => (py * w + px) * 4
  const out = [0, 0, 0]
  for (let c = 0; c < 3; c++) {
    out[c] =
      data[i(x0, y0) + c] * (1 - fx) * (1 - fy) +
      data[i(x1, y0) + c] * fx * (1 - fy) +
      data[i(x0, y1) + c] * (1 - fx) * fy +
      data[i(x1, y1) + c] * fx * fy
  }
  return out
}

export function warpHorizontal(ctx, w, h, regionFn, displacementFn) {
  const src = ctx.getImageData(0, 0, w, h)
  const dst = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const disp = regionFn(x, y) ? displacementFn(x, y) : 0
      const sx = Math.max(0, Math.min(w - 1, x - disp))
      const [r, g, b] = sampleBilinear(src.data, w, h, sx, y)
      const di = (y * w + x) * 4
      dst.data[di] = r
      dst.data[di + 1] = g
      dst.data[di + 2] = b
      dst.data[di + 3] = 255
    }
  }
  ctx.putImageData(dst, 0, 0)
}

export function pathFromIndices(landmarks, indices, w, h, lm) {
  return indices.map((i) => {
    const p = lm(landmarks, i)
    return { x: p.x * w, y: p.y * h }
  })
}

export function strokePath(ctx, points, { color, width, blur = 0, alpha = 1 }) {
  if (points.length < 2) return
  ctx.save()
  ctx.globalAlpha = alpha
  if (blur > 0) ctx.filter = `blur(${blur}px)`
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
  ctx.restore()
}

export function healRegion(ctx, w, h, targetMask, sourceMask, strength) {
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  let srcR = 0
  let srcG = 0
  let srcB = 0
  let srcN = 0
  for (let i = 0; i < targetMask.length; i++) {
    if (sourceMask[i]) {
      const idx = i * 4
      srcR += data[idx]
      srcG += data[idx + 1]
      srcB += data[idx + 2]
      srcN++
    }
  }
  if (srcN === 0) return
  srcR /= srcN
  srcG /= srcN
  srcB /= srcN
  for (let i = 0; i < targetMask.length; i++) {
    if (!targetMask[i]) continue
    const idx = i * 4
    const t = strength
    data[idx] = data[idx] * (1 - t) + srcR * t
    data[idx + 1] = data[idx + 1] * (1 - t) + srcG * t
    data[idx + 2] = data[idx + 2] * (1 - t) + srcB * t
  }
  ctx.putImageData(img, 0, 0)
}

export function addNoiseOverlay(ctx, w, h, mask, intensity) {
  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const n = (Math.random() - 0.5) * intensity
    const idx = i * 4
    data[idx] = Math.max(0, Math.min(255, data[idx] + n))
    data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + n))
    data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + n))
  }
  ctx.putImageData(img, 0, 0)
}
