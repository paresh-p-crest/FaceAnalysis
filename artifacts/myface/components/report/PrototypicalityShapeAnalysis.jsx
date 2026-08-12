'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildFaceDiagram } from '../../utils/faceDiagramRenderer'
import { useMediaUrl } from '../../utils/useMediaUrl'

const PORTRAIT_FALLBACK = { width: 4, height: 5 }

/** Subtle blueprint grid — very faded (#9AB tint). */
const GRID_STYLE = {
  backgroundImage:
    'linear-gradient(to right, rgba(153, 170, 187, 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(153, 170, 187, 0.22) 1px, transparent 1px)',
  backgroundSize: '22px 22px',
  opacity: 0.18,
}

function useImageDimensions(src, fallback = PORTRAIT_FALLBACK) {
  const [dims, setDims] = useState(fallback)

  useEffect(() => {
    if (!src) {
      setDims(fallback)
      return undefined
    }
    let cancelled = false
    const img = new window.Image()
    img.onload = () => {
      if (cancelled) return
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setDims({ width: img.naturalWidth, height: img.naturalHeight })
      }
    }
    img.onerror = () => {
      if (!cancelled) setDims(fallback)
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src, fallback.width, fallback.height])

  return dims
}

export function PrototypicalityShapeAnalysis({ landmarks, averageness, photo }) {
  const score = averageness?.score
  const photoSrc = useMediaUrl(photo)
  const { width: imageWidth, height: imageHeight } = useImageDimensions(photoSrc)

  const diagram = useMemo(
    () => buildFaceDiagram({ landmarks, imageWidth, imageHeight }),
    [landmarks, imageWidth, imageHeight],
  )

  if (!diagram?.paths?.length) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-sm text-ink-muted font-sans">
        Landmark data required for shape analysis.
      </div>
    )
  }

  return (
    <div className="relative w-full bg-white rounded-lg overflow-hidden">
      <div
        className="absolute inset-0 rounded-lg pointer-events-none"
        style={GRID_STYLE}
        aria-hidden="true"
      />

      <p className="report-view-mono-label relative z-10 px-1 pt-1 pb-0.5">
        Shape Analysis
      </p>

      <div className="relative z-[1] px-3 pt-0.5 pb-1">
        <svg
          viewBox={diagram.viewBox}
          className="block w-full h-auto mx-auto"
          style={{ maxWidth: 'min(100%, 400px)', aspectRatio: diagram.aspectRatio }}
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Prototypicality shape analysis, score ${score}`}
        >
          {diagram.paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.fill}
              fillOpacity={p.fillOpacity}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              strokeOpacity={p.strokeOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
