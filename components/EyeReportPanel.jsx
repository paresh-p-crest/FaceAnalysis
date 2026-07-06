import { FaceImageFrame } from './report/FaceImageFrame'

export function EyeReportPanel({ eyeAnalysis }) {
  const m = eyeAnalysis?.metrics
  if (!m) return null

  const k = parseFloat(m.lowerLidCurvature)
  const rangeMin = m.curvatureMin
  const rangeMax = m.curvatureMax
  const sliderPct = Math.min(100, Math.max(0, ((k - rangeMin) / (rangeMax - rangeMin)) * 100))

  const summaryCards = [
    { label: 'Eye tilt', value: m.eyeTilt },
    { label: 'Eyelid exposure', value: m.eyelidExposure },
    { label: 'Sclera color', value: m.scleraColor },
    { label: 'Under-eye health', value: m.underEyeHealth },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">An overview of your eyes</h3>
        <p className="text-[10px] text-ink-muted font-sans mb-4">MediaPipe + OpenCV · no LLM · $0 API cost</p>
        {eyeAnalysis.eyesCrop && (
          <FaceImageFrame
            src={eyeAnalysis.eyesCrop}
            alt="Your eyes"
            aspect="auto"
            maxW="380px"
          />
        )}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Summary of your eyes</p>
        <div className="grid grid-cols-2 gap-2">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-3">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{card.label}</p>
              <p className="text-sm font-medium text-ink">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium text-ink-muted mb-1">Lower eyelid curvature</p>
        <p className="text-sm text-ink-secondary mb-3">{m.curvatureDescription}</p>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-2xl font-display font-bold text-brand">{m.lowerLidCurvature}</span>
          <span className="text-xs text-ink-muted">Total bending (k)</span>
        </div>
        <div className="relative h-2 rounded-full bg-surface-border mb-2">
          <div
            className="absolute top-0 bottom-0 rounded-full bg-brand/20"
            style={{ left: `${((rangeMin - 0.6) / 0.4) * 100}%`, width: `${((rangeMax - rangeMin) / 0.4) * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand shadow-glow"
            style={{ left: `calc(${sliderPct}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ink-faint font-sans">
          <span>{rangeMin}</span>
          <span>common range</span>
          <span>{rangeMax}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">Explanation</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{m.explanation}</p>
      </div>
    </div>
  )
}
