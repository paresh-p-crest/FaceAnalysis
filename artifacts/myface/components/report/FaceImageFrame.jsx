'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getObjectFitContentRect } from '../../utils/objectFitContentRect'

const MIDLINE_IDS = new Set([10, 152])

/** Notebook bilateral overlay rings only (9 pairs). Midline is arrow-only via landmarks 10/152. */
const SYMMETRY_OVERLAY_IDS = new Set([
  70, 300, 107, 336,
  33, 263, 133, 362,
  98, 327,
  61, 291,
  234, 454, 172, 397, 176, 400,
])

function useContentBox(imgRef, fit, src) {
  const [box, setBox] = useState(null)

  const measure = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    setBox(getObjectFitContentRect(img, fit))
  }, [imgRef, fit])

  useLayoutEffect(() => {
    measure()
  }, [measure, src])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return undefined

    const onLoad = () => measure()
    img.addEventListener('load', onLoad)
    if (img.complete) measure()

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null
    ro?.observe(img)
    if (img.parentElement) ro?.observe(img.parentElement)

    return () => {
      img.removeEventListener('load', onLoad)
      ro?.disconnect()
    }
  }, [measure, imgRef, src])

  return box
}

function OverlayViewport({ box, children }) {
  if (!box) return null
  return (
    <div
      className="absolute pointer-events-none z-[1]"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      }}
    >
      {children}
    </div>
  )
}

/** Portrait frame for face/feature images with MediaPipe-aligned overlays */
export function FaceImageFrame({
  src,
  alt = '',
  overlay,
  aspect = '4/5',
  maxW = '280px',
  fit = 'cover',
  alignOverlay = false,
  className = '',
}) {
  const imgRef = useRef(null)
  const resolvedFit = alignOverlay || fit === 'contain' ? 'contain' : fit === 'cover' ? 'cover' : fit
  const isAuto = aspect === 'auto'
  const contentBox = useContentBox(imgRef, isAuto ? 'fill' : resolvedFit, src)

  if (isAuto) {
    return (
      <div
        className={`relative mx-auto w-full rounded-2xl overflow-hidden ring-1 ring-surface-border mb-5 ${className}`}
        style={{ maxWidth: maxW }}
      >
        <img ref={imgRef} src={src} alt={alt} className="w-full h-auto block" />
        {overlay ? (
          <OverlayViewport box={contentBox}>
            <div className="relative w-full h-full">{overlay}</div>
          </OverlayViewport>
        ) : null}
      </div>
    )
  }

  const aspectClass =
    aspect === '3/1'
      ? 'aspect-[3/1]'
      : aspect === '5/2'
        ? 'aspect-[5/2]'
        : aspect === '2/1'
          ? 'aspect-[2/1]'
          : 'aspect-[4/5]'
  const fitClass = resolvedFit === 'contain' ? 'object-contain' : 'object-cover'

  return (
    <div
      className={`relative mx-auto w-full ${aspectClass} rounded-2xl overflow-hidden ring-1 ring-surface-border bg-surface-warm mb-5 ${className}`}
      style={{ maxWidth: maxW }}
    >
      <img ref={imgRef} src={src} alt={alt} className={`absolute inset-0 w-full h-full ${fitClass}`} />
      {overlay ? (
        <OverlayViewport box={contentBox}>
          <div className="relative w-full h-full">{overlay}</div>
        </OverlayViewport>
      ) : null}
    </div>
  )
}

/**
 * Photo + landmark overlay for report grids.
 * Maps 0–100 image-% coordinates onto the object-fit content box.
 */
export function PhotoLandmarkFrame({
  src,
  alt = 'Analysis',
  overlay,
  fit = 'contain',
  aspectClass = 'aspect-[4/5]',
  className = '',
}) {
  const imgRef = useRef(null)
  const contentBox = useContentBox(imgRef, fit, src)
  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain'

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-surface-border ${aspectClass} bg-surface-warm ${className}`}
    >
      {src ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full ${fitClass}`}
        />
      ) : null}
      {overlay ? (
        <OverlayViewport box={contentBox}>
          <div className="relative w-full h-full">{overlay}</div>
        </OverlayViewport>
      ) : null}
    </div>
  )
}

function midlineFromProps(midline, dots) {
  if (midline?.top && midline?.bot) {
    return {
      top: { x: midline.top.x, y: midline.top.y },
      bot: { x: midline.bot.x, y: midline.bot.y },
    }
  }
  const midDots = (dots || []).filter((d) => MIDLINE_IDS.has(d.id))
  const mx = midDots.length
    ? midDots.reduce((sum, d) => sum + d.x, 0) / midDots.length
    : ((dots || []).reduce((sum, d) => sum + d.x, 0) / Math.max((dots || []).length, 1)) || 50
  return { top: { x: mx, y: 8 }, bot: { x: mx, y: 92 } }
}

/** SVG fills the content box; viewBox 0–100 matches MediaPipe image-% from the backend.
 * Circles use aspect-compensated ellipses so they stay round under preserveAspectRatio=none. */
export function SymmetryOverlay({ dots, midline = null }) {
  const svgRef = useRef(null)
  const [boxPx, setBoxPx] = useState({ w: 1, h: 1 })

  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return undefined
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setBoxPx({ w: width, h: height })
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const visible = (dots || []).filter((d) => SYMMETRY_OVERLAY_IDS.has(d.id))
  const { top, bot } = midlineFromProps(midline, dots)
  const mx = (top.x + bot.x) / 2

  // Desired visual radius ≈ 0.72% of the shorter side → equal pixel rx/ry after stretch
  const rNorm = 0.72
  const minSide = Math.min(boxPx.w, boxPx.h)
  const rPx = (rNorm / 100) * minSide
  const rx = (rPx / boxPx.w) * 100
  const ry = (rPx / boxPx.h) * 100

  // Arrowheads: ~equal pixel size on both axes
  const ahPx = Math.max(6, minSide * 0.016)
  const awPx = Math.max(5, minSide * 0.0135)
  const ah = (ahPx / boxPx.h) * 100
  const aw = (awPx / boxPx.w) * 100

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line
        x1={top.x}
        y1={top.y}
        x2={bot.x}
        y2={bot.y}
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="0.45"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points={`${mx},${top.y} ${mx - aw},${top.y + ah} ${mx + aw},${top.y + ah}`}
        fill="rgba(255,255,255,0.95)"
      />
      <polygon
        points={`${mx},${bot.y} ${mx - aw},${bot.y - ah} ${mx + aw},${bot.y - ah}`}
        fill="rgba(255,255,255,0.95)"
      />
      {visible.map((d) => (
        <ellipse
          key={d.id}
          cx={d.x}
          cy={d.y}
          rx={rx}
          ry={ry}
          fill="none"
          stroke="#ffffff"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/** Notebook-style white octagon + ellipse + dashed V/H crosshairs (image % 0–100). */
export function FaceShapeOverlay({ overlay }) {
  if (!overlay?.polygon?.length) return null
  const poly = overlay.polygon.map((p) => `${p.x},${p.y}`).join(' ')
  const el = overlay.ellipse
  const v = overlay.crossV || []
  const h = overlay.crossH || []
  const solid = {
    fill: 'none',
    stroke: '#ffffff',
    strokeWidth: 0.55,
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  }
  const dashed = {
    stroke: '#ffffff',
    strokeWidth: 0.4,
    strokeDasharray: '2.2 1.6',
    strokeLinecap: 'butt',
    vectorEffect: 'non-scaling-stroke',
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <polygon points={poly} {...solid} />
      {el && <ellipse cx={el.cx} cy={el.cy} rx={el.rx} ry={el.ry} {...solid} />}
      {v.length >= 2 && (
        <line x1={v[0].x} y1={v[0].y} x2={v[1].x} y2={v[1].y} {...dashed} />
      )}
      {h.length >= 2 && (
        <line x1={h[0].x} y1={h[0].y} x2={h[1].x} y2={h[1].y} {...dashed} />
      )}
    </svg>
  )
}

export function ProportionsOverlay({ lines }) {
  if (!lines) return null
  const hair = lines.hair
  const brow = lines.brow
  const nose = lines.nose
  const chin = lines.chin
  const lineProps = {
    stroke: 'rgba(255,255,255,0.92)',
    strokeWidth: '1.15',
    strokeDasharray: '1.5 2.2',
    strokeLinecap: 'round',
    vectorEffect: 'non-scaling-stroke',
  }
  const solidProps = {
    stroke: 'rgba(255,255,255,0.88)',
    strokeWidth: '1.35',
    strokeLinecap: 'round',
    vectorEffect: 'non-scaling-stroke',
  }
  // Midface height tick (brow → subnasale), Qoves-style, on the viewer's right.
  const midX = 88
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {[hair, brow, nose, chin].map((y, i) =>
        y != null ? <line key={i} x1="8" y1={y} x2="92" y2={y} {...lineProps} /> : null
      )}
      {brow != null && nose != null ? (
        <line x1={midX} y1={brow} x2={midX} y2={nose} {...solidProps} />
      ) : null}
    </svg>
  )
}

/**
 * Notebook-style filled region highlight (chin crescent / cheek malar).
 * Paths are SVG `d` strings in image-% space (0–100), matching FaceShapeOverlay.
 */
export function FeatureRegionOverlay({ paths, fill = 'rgba(150, 170, 180, 0.4)', stroke = 'rgba(120, 140, 150, 0.75)' }) {
  const list = (paths || []).filter(Boolean)
  if (!list.length) return null
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {list.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={fill}
          stroke={stroke}
          strokeWidth="0.35"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

/** Qoves-style per-feature proportion guides — dots use % CSS so size stays small on any aspect. */
export function ProportionFeatureOverlay({ overlay }) {
  if (!overlay) return null
  // Same white + weight as facial-thirds overview (`ProportionsOverlay`).
  const dash = {
    stroke: 'rgba(255,255,255,0.92)',
    strokeWidth: '1.15',
    strokeDasharray: '1.5 2.2',
    strokeLinecap: 'round',
    vectorEffect: 'non-scaling-stroke',
  }
  const solid = {
    stroke: 'rgba(255,255,255,0.92)',
    strokeWidth: '1.15',
    strokeLinecap: 'round',
    vectorEffect: 'non-scaling-stroke',
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {overlay.horizontal?.map((line, i) => (
          <line
            key={`h-${i}`}
            x1={line.x1 ?? 4}
            y1={line.y}
            x2={line.x2 ?? 96}
            y2={line.y}
            {...dash}
          />
        ))}
        {overlay.vertical?.map((line, i) => (
          <line key={`v-${i}`} x1={line.x} y1="4" x2={line.x} y2="96" {...dash} />
        ))}
        {overlay.segments?.map((seg, i) => (
          <line key={`s-${i}`} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} {...solid} />
        ))}
        {overlay.bars?.map((bar, i) => {
          const x1 = Number(bar.x1)
          const x2 = Number(bar.x2)
          const y = Number(bar.y ?? bar.y1)
          if (![x1, x2, y].every(Number.isFinite)) return null
          const left = Math.min(x1, x2)
          const right = Math.max(x1, x2)
          const span = right - left
          // Downward end ticks (~8% of span, clamped) — matches Qoves measurement brackets.
          const tickLen = Math.max(1.6, Math.min(3.2, span * 0.08 || 2.2))
          const tickXs = Array.isArray(bar.ticks) && bar.ticks.length
            ? bar.ticks.map(Number).filter(Number.isFinite)
            : [left, right]
          return (
            <g key={`bar-${i}`}>
              <line x1={left} y1={y} x2={right} y2={y} {...solid} />
              {tickXs.map((tx, j) => (
                <line key={j} x1={tx} y1={y} x2={tx} y2={y + tickLen} {...solid} />
              ))}
            </g>
          )
        })}
      </svg>
      {overlay.dots?.map((d, i) => (
        <span
          key={`d-${i}`}
          className="absolute w-1 h-1 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
        />
      ))}
    </div>
  )
}
