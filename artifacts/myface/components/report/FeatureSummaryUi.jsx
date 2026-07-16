'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Shared Qoves-style UI used by Lips/Nose/Eyes — keep panels visually identical. */

export function markerPct(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return 50
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

export function SummaryLabelCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-4 sm:p-5 shadow-sm min-w-0">
      <p className="qoves-report-mono-label mb-2">{label}</p>
      <p className="text-base sm:text-lg font-display font-bold text-ink">{value ?? '—'}</p>
    </div>
  )
}

export function RangeMeter({
  metricLabel,
  sourceLabel,
  valueText,
  valueNum,
  rangeMin,
  rangeMax,
  rangeMinLabel,
  rangeMaxLabel,
}) {
  const hasRange =
    Number.isFinite(valueNum) && Number.isFinite(rangeMin) && Number.isFinite(rangeMax)
  const pct = hasRange ? markerPct(valueNum, rangeMin, rangeMax) : null

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="qoves-report-mono-label">{metricLabel}</p>
        {sourceLabel && <p className="qoves-report-mono-label">{sourceLabel}</p>}
      </div>
      {valueText && (
        <p className="text-2xl sm:text-3xl font-display font-bold text-ink tabular-nums">{valueText}</p>
      )}
      {hasRange && (
        <>
          <div className="relative h-2 rounded-full bg-surface-border mt-2">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-ink border-2 border-white shadow-sm"
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-ink-muted font-sans tabular-nums">
            <span>{rangeMinLabel}</span>
            <span>{rangeMaxLabel}</span>
          </div>
        </>
      )}
    </div>
  )
}

export function DetailCarousel({ slides }) {
  const [idx, setIdx] = useState(0)
  if (!slides.length) return null

  const active = slides[Math.min(idx, slides.length - 1)]
  const multi = slides.length > 1

  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-4 sm:p-5 shadow-sm h-full min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-display text-base font-bold text-ink tracking-tight">
          {active.titleLead}{' '}
          <span className="text-ink-muted font-semibold">{active.titleAccent}</span>
        </h4>
        {multi && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Previous detail"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="p-1 rounded-lg border border-surface-border disabled:opacity-30 text-ink-muted hover:text-ink"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-1">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to ${s.titleLead} ${s.titleAccent}`}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all ${
                    i === idx
                      ? 'w-2 h-2 bg-ink'
                      : 'w-1.5 h-1.5 bg-surface-border hover:bg-ink-muted'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next detail"
              onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
              disabled={idx >= slides.length - 1}
              className="p-1 rounded-lg border border-surface-border disabled:opacity-30 text-ink-muted hover:text-ink"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-ink-muted font-sans leading-relaxed">{active.body}</p>
      {active.meter && <RangeMeter {...active.meter} />}
    </div>
  )
}

export function MetricsColumn({ rows }) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-brand font-medium">{row.label}</dt>
          <dd className="text-sm font-display font-bold text-ink tabular-nums text-right shrink-0">
            {row.value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function FeatureHeroFrame({ children }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6 sm:p-8 flex items-center justify-center shadow-sm">
      {children}
    </div>
  )
}

export function FeatureSummaryGrid({ cards, slides }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <SummaryLabelCard key={c.label} label={c.label} value={c.value} />
        ))}
      </div>
      <DetailCarousel slides={slides} />
    </div>
  )
}

export function AllMetricsTable({ left, right }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-5 sm:p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
        <MetricsColumn rows={left} />
        <MetricsColumn rows={right} />
      </div>
    </div>
  )
}
