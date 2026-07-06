import { FaceImageFrame } from './FaceImageFrame'

function MetricCard({ label, value, tooltip }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-3 relative group">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 rounded-lg bg-slate-800 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

/**
 * Generic Qoves-style feature report panel.
 * @param {object} props
 * @param {string} props.title - Section heading
 * @param {object} props.data - The feature data object (must have score, scoreLabel, explanation)
 * @param {Array<{title: string, metrics: Array<{label: string, value: string, tooltip?: string}>}>} props.sections - Sections to render
 * @param {string} [props.imageSrc] - Optional cropped image
 * @param {string} [props.imageAlt] - Alt text for image
 * @param {Array<{label: string, value: string}>} [props.extraMetrics] - Metrics shown in the overall score card
 */
export function FeatureReportPanel({ title, data, sections, imageSrc, imageAlt, extraMetrics }) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">{title}</h3>
        <p className="text-[10px] text-ink-muted font-sans mb-4">MediaPipe landmarks + pixel analysis · $0 API cost</p>
        {imageSrc && (
          <FaceImageFrame src={imageSrc} alt={imageAlt || title} aspect="auto" maxW="380px" />
        )}
      </div>

      {/* Overall Score */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">Overall Score</p>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-4xl font-display font-bold text-brand">{data.score}</span>
          <span className="text-sm text-ink-muted mb-1">/ 100</span>
          <span className="ml-auto text-sm font-medium text-brand bg-brand-50 px-3 py-1 rounded-full border border-brand/20">{data.scoreLabel}</span>
        </div>
        <div className="relative h-2 rounded-full bg-surface-border mb-2">
          <div className="absolute top-0 bottom-0 rounded-full bg-brand/20" style={{ left: '50%', width: '45%' }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-brand shadow-glow"
            style={{ left: `calc(${data.score}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ink-faint font-sans mb-3">
          <span>Needs attention</span>
          <span>Optimal</span>
        </div>
        {extraMetrics && extraMetrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {extraMetrics.map((m, i) => (
              <MetricCard key={i} label={m.label} value={m.value} tooltip={m.tooltip} />
            ))}
          </div>
        )}
      </div>

      {/* Sub-sections */}
      {sections?.map((section, idx) => (
        <div key={idx} className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">{section.title}</p>
          <div className={`grid gap-2 ${section.cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {section.metrics.map((m, i) => (
              <MetricCard key={i} label={m.label} value={m.value} tooltip={m.tooltip} />
            ))}
          </div>
          {section.description && (
            <p className="text-xs text-ink-secondary leading-relaxed mt-3">{section.description}</p>
          )}
        </div>
      ))}

      {/* Full Explanation */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">Full Analysis Summary</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{data.explanation}</p>
      </div>
    </div>
  )
}
