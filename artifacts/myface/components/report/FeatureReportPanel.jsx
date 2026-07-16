'use client'

import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import { FeatureProseBlock } from './FeatureProseBlock'
import { mergeMetricSections, resolveFeatureHero } from '../../utils/featureParsing'

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

export function FeatureReportPanel({
  title,
  featureName,
  data,
  sections,
  imageSrc,
  imageAlt,
  photoOverlay = null,
  heroSlot = null,
  extraMetrics,
  narrative = null,
  featureId = null,
  featureParsing = null,
}) {
  const t = useTranslations('Report')

  if (!data) return null

  const resolvedImage = resolveFeatureHero(featureId, data, featureParsing) || imageSrc
  const resolvedSections = featureId
    ? mergeMetricSections(sections, featureId, featureParsing)
    : sections

  const accent = featureName || title.replace(/ Analysis$/i, '').toLowerCase()
  const summaryCards = (resolvedSections?.[0]?.metrics || []).slice(0, 4).map((m) => ({
    label: m.label,
    value: m.value,
  }))

  return (
    <div className="space-y-6">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={accent}
        subtitle={t('featureReport.subtitle')}
      />
      {(heroSlot || resolvedImage) ? (
        <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-6 flex items-center justify-center">
          {heroSlot || (
            <div className="relative inline-block max-h-48">
              <img
                src={resolvedImage}
                alt={imageAlt || title}
                className="max-h-48 w-auto object-contain rounded-xl block"
              />
              {photoOverlay ? (
                <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                  {photoOverlay}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="qoves-report-metric-card">
              <p className="qoves-report-mono-label mb-1">{card.label}</p>
              <p className="text-lg font-display font-bold text-ink">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">{t('common.overallScore')}</p>
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
          <span>{t('common.needsAttention')}</span>
          <span>{t('common.optimal')}</span>
        </div>
        {extraMetrics && extraMetrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {extraMetrics.map((m, i) => (
              <MetricCard key={i} label={m.label} value={m.value} tooltip={m.tooltip} />
            ))}
          </div>
        )}
      </div>

      {resolvedSections?.map((section, idx) => (
        <div key={idx} className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">{section.title}</p>
          <div className={`grid gap-2 ${section.cols === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {section.metrics.map((m, i) => (
              <MetricCard key={i} label={m.label} value={m.value} tooltip={m.tooltip} />
            ))}
          </div>
        </div>
      ))}

      <FeatureProseBlock narrative={narrative} fallbackExplanation={data.explanation} />
    </div>
  )
}
