'use client'

import { useMemo } from 'react'
import { buildFrontMeshProjection } from '../../utils/prototypicalityMeshProjection'

/** Qoves-like sage mesh stroke — higher contrast than brand-on-grid. */
const MESH_STROKE = '#6B9080'

export function PrototypicalityShapeAnalysis({ landmarks, averageness }) {
  const score = averageness?.score

  const mesh = useMemo(() => buildFrontMeshProjection(landmarks), [landmarks])

  if (!mesh?.segments?.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-ink-muted font-sans">
        Landmark data required for shape analysis.
      </div>
    )
  }

  return (
    <div className="relative min-h-[400px] lg:min-h-[450px] bg-white rounded-lg">
      <div
        className="absolute inset-0 rounded-lg opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15, 23, 42, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.06) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-1 pt-1 z-10">
        <p className="qoves-report-mono-label">Shape Analysis</p>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pt-8 pb-4 px-6">
        <svg
          viewBox={mesh.viewBox}
          className="w-full h-full max-w-[380px] max-h-[380px]"
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Prototypicality shape analysis, score ${score}`}
        >
          <g
            fill="none"
            stroke={MESH_STROKE}
            strokeWidth={0.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mesh.segments.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
