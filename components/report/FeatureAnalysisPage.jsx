import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReportSectionHeading } from './ReportSectionHeading'
import { ReportMetricCard, ReportExplanationCard, ReportMonoLabel } from './ReportSectionHeading'

export function FeatureAnalysisPage({
  featureName,
  subtitle,
  heroImage,
  summaryCards = [],
  details = [],
  children,
}) {
  const [detailIdx, setDetailIdx] = useState(0)
  const activeDetail = details[detailIdx]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={`Summary of your`}
        accent={featureName}
        subtitle={subtitle}
      />

      {heroImage && (
        <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-6 flex items-center justify-center">
          <img
            src={heroImage}
            alt={featureName}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </div>
      )}

      {summaryCards.length > 0 && (
        <div>
          <p className="font-display text-base font-bold text-ink mb-3">
            Summary of your {featureName.toLowerCase()}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {summaryCards.map((card) => (
              <ReportMetricCard key={card.label} label={card.label} value={card.value} />
            ))}
          </div>
        </div>
      )}

      {activeDetail && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-display text-base font-bold text-ink">
              {activeDetail.title}
            </h4>
            {details.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDetailIdx((i) => Math.max(0, i - 1))}
                  disabled={detailIdx === 0}
                  className="p-1 rounded-lg border border-surface-border disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailIdx((i) => Math.min(details.length - 1, i + 1))}
                  disabled={detailIdx === details.length - 1}
                  className="p-1 rounded-lg border border-surface-border disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">{activeDetail.body}</p>
          {activeDetail.metricLabel && (
            <div className="space-y-2">
              <ReportMonoLabel>{activeDetail.metricLabel}</ReportMonoLabel>
              {activeDetail.metricValue && (
                <p className="text-2xl font-display font-bold text-ink">{activeDetail.metricValue}</p>
              )}
              {activeDetail.rangeMin != null && activeDetail.rangeMax != null && (
                <div className="relative h-2 rounded-full bg-surface-border mt-3">
                  <div
                    className="absolute top-0 bottom-0 rounded-full bg-brand/20"
                    style={{
                      left: `${activeDetail.rangeMin}%`,
                      width: `${activeDetail.rangeMax - activeDetail.rangeMin}%`,
                    }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm bg-ink"
                    style={{ left: `calc(${activeDetail.markerPct ?? 50}% - 6px)` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {children}
    </div>
  )
}

export function AssessmentGridLayout({ photo, photoOverlay, rightCards, explanation, metrics = [] }) {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="relative rounded-2xl overflow-hidden border border-surface-border aspect-[4/5] bg-surface-warm">
          {photo && <img src={photo} alt="Analysis" className="w-full h-full object-cover" />}
          {photoOverlay}
        </div>
        <div className="space-y-4">
          {rightCards}
        </div>
      </div>
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <ReportMetricCard key={m.label} label={m.label} value={m.value} />
          ))}
        </div>
      )}
      {explanation && <ReportExplanationCard>{explanation}</ReportExplanationCard>}
    </div>
  )
}
