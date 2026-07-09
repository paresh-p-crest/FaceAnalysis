import { ReportSectionHeading, ReportExplanationCard } from './ReportSectionHeading'
import { PrototypicalityShapeAnalysis } from './PrototypicalityShapeAnalysis'
import { prototypicalityRangeLabel } from '../../utils/prototypicalityWireframe'

export function AveragenessSection({ averageness, landmarks }) {
  if (!averageness || averageness.score == null) {
    return (
      <p className="text-sm text-ink-muted font-sans py-8">
        Prototypicality data is not available for this assessment.
      </p>
    )
  }

  const score = averageness.score
  const label = averageness.label
  const explanation = averageness.explanation
  const rangeLabel = averageness.rangeLabel || prototypicalityRangeLabel(score)
  const scaleLeft = averageness.scaleLeft || 'Distinctive'
  const scaleRight = averageness.scaleRight || 'Highly Typical'

  return (
    <div className="space-y-6">
      <ReportSectionHeading
        title="An overview of your"
        accent="prototypicality"
        subtitle="Facial prototypicality describes how closely your features match the typical features of people in your demographic group."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 qoves-report-metric-card p-5 sm:p-6">
          <PrototypicalityShapeAnalysis landmarks={landmarks} averageness={averageness} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="qoves-report-metric-card text-center flex flex-col min-h-[180px]">
            <p className="qoves-report-mono-label mb-6">Prototypicality</p>
            <p className="text-[5.5rem] leading-none font-display font-bold text-ink tracking-tight flex-1 flex items-center justify-center">
              {score}
            </p>
            <div className="flex justify-between items-center border-t border-surface-border pt-4 mt-4">
              {label && <span className="text-sm font-medium text-ink">{label}</span>}
              <span className="text-sm text-ink-muted">/100</span>
            </div>
          </div>

          <div className="qoves-report-metric-card">
            <p className="qoves-report-mono-label mb-2">Prototypicality Range</p>
            <p className="text-lg font-display font-bold text-ink mb-5">{rangeLabel}</p>
            <div className="relative h-[3px] rounded-full bg-surface-border mb-3">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-sm bg-ink"
                style={{ left: `${Math.min(100, Math.max(0, score))}%`, transform: 'translate(-50%, -50%)' }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-medium text-ink-muted">
              <span>{scaleLeft}</span>
              <span>{scaleRight}</span>
            </div>
          </div>

          {explanation && <ReportExplanationCard>{explanation}</ReportExplanationCard>}
        </div>
      </div>
    </div>
  )
}
