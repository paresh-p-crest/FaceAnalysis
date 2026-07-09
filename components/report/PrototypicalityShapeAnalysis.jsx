import { useMemo } from 'react'
import { buildPrototypicalityWireframe } from '../../utils/prototypicalityWireframe'

function WireframeFeatures({ features, stroke, fillOpacity = 0 }) {
  if (!features?.length) return null

  return (
    <g fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round">
      {features.map((feat) => {
        const sw = feat.strokeWidth ?? 1
        if (feat.type === 'polygon') {
          return (
            <polygon
              key={feat.id}
              points={feat.points}
              strokeWidth={sw}
              fill={fillOpacity > 0 ? stroke : 'none'}
              fillOpacity={feat.fill ? fillOpacity : 0}
            />
          )
        }
        return (
          <polyline
            key={feat.id}
            points={feat.points}
            strokeWidth={sw}
            fill="none"
          />
        )
      })}
    </g>
  )
}

export function PrototypicalityShapeAnalysis({ landmarks, averageness }) {
  const score = averageness?.score

  const wireframe = useMemo(() => {
    if (averageness?.wireframe?.userFeatures?.length) {
      return {
        viewBox: averageness.wireframe.viewBox || '0 0 100 100',
        user: averageness.wireframe.userFeatures,
        average: averageness.wireframe.averageFeatures || [],
      }
    }
    return buildPrototypicalityWireframe(landmarks, averageness)
  }, [landmarks, averageness])

  if (!wireframe) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-ink-muted font-sans">
        Landmark data required for shape analysis.
      </div>
    )
  }

  return (
    <div className="relative min-h-[400px] lg:min-h-[450px]">
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in srgb, var(--ink-faint) 35%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--ink-faint) 35%, transparent) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="absolute top-0 left-0 right-0 flex items-start justify-between px-1 pt-1 z-10">
        <p className="qoves-report-mono-label">Shape Analysis</p>
        <div className="flex items-center gap-5 text-[10px] font-bold text-ink-muted uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-brand shrink-0" />
            You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-ink-faint shrink-0" />
            Average
          </span>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center pt-8 pb-4 px-6">
        <svg
          viewBox={wireframe.viewBox}
          className="w-full h-full max-w-[380px] max-h-[380px] text-brand"
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Prototypicality shape analysis, score ${score}`}
        >
          <g className="text-ink-faint">
            <WireframeFeatures
              features={wireframe.average}
              stroke="currentColor"
              fillOpacity={0.1}
            />
          </g>
          <g className="text-brand">
            <WireframeFeatures
              features={wireframe.user}
              stroke="currentColor"
              fillOpacity={0.16}
            />
          </g>
        </svg>
      </div>
    </div>
  )
}
