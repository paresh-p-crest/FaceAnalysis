'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getObjectFitContentRect } from '../../utils/objectFitContentRect'

const MIDLINE_IDS = new Set([1, 2, 4, 5, 6, 10, 152, 168])

/** Keep overlay sparse even for older reports that stored full eye/brow contours. */
const SYMMETRY_OVERLAY_IDS = new Set([
  33, 133, 159, 145,
  362, 263, 386, 374,
  70, 105, 107,
  300, 334, 336,
  1, 2, 4, 5, 6, 98, 327,
  61, 291, 152, 234, 454,
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

function midlineXFromDots(dots) {
  const mid = (dots || []).filter((d) => MIDLINE_IDS.has(d.id))
  if (!mid.length) return 50
  return mid.reduce((sum, d) => sum + d.x, 0) / mid.length
}

/** SVG fills the content box; viewBox 0–100 matches MediaPipe image-% from the backend. */
export function SymmetryOverlay({ dots }) {
  const visible = (dots || []).filter((d) => SYMMETRY_OVERLAY_IDS.has(d.id))
  const mx = midlineXFromDots(visible.length ? visible : dots)
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line
        x1={mx}
        y1="3"
        x2={mx}
        y2="97"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="0.35"
        strokeDasharray="1.4 1"
        vectorEffect="non-scaling-stroke"
      />
      <polygon points={`${mx},2 ${mx - 1.4},5.5 ${mx + 1.4},5.5`} fill="rgba(255,255,255,0.92)" />
      <polygon points={`${mx},98 ${mx - 1.4},94.5 ${mx + 1.4},94.5`} fill="rgba(255,255,255,0.92)" />
      {visible.map((d) => (
        <circle key={d.id} cx={d.x} cy={d.y} r="0.22" fill="rgba(255,255,255,0.95)" />
      ))}
    </svg>
  )
}

export function ProportionsOverlay({ lines }) {
  if (!lines) return null
  const lineProps = {
    stroke: 'rgba(255,255,255,0.88)',
    strokeWidth: '0.3',
    strokeDasharray: '2 1.5',
    vectorEffect: 'non-scaling-stroke',
  }
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {[lines.hair, lines.brow, lines.nose, lines.chin].map((y, i) => (
        <line key={i} x1="6" y1={y} x2="94" y2={y} {...lineProps} />
      ))}
    </svg>
  )
}

/** Qoves-style per-feature proportion guides — dots use % CSS so size stays small on any aspect. */
export function ProportionFeatureOverlay({ overlay }) {
  if (!overlay) return null
  const dash = {
    stroke: 'rgba(255,255,255,0.92)',
    strokeWidth: '0.28',
    strokeDasharray: '1.6 1.2',
    vectorEffect: 'non-scaling-stroke',
  }
  const solid = {
    stroke: 'rgba(255,255,255,0.95)',
    strokeWidth: '0.32',
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
