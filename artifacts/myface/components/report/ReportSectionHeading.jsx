'use client'

/** Shared report-style section heading with optional accent spans. */

import { useCvLabel } from '../../utils/cvReportLocale'

export function ReportSectionHeading({ title, accent, subtitle, className = '' }) {
  return (
    <div className={`mb-6 ${className}`}>
      <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-tight leading-tight">
        {title}
        {accent && (
          <>
            {' '}
            <span className="text-ink-muted font-semibold">{accent}</span>
          </>
        )}
      </h2>
      {subtitle && (
        <p className="text-sm text-ink-muted font-sans mt-2 leading-relaxed max-w-2xl">{subtitle}</p>
      )}
    </div>
  )
}

export function ReportMonoLabel({ children, className = '' }) {
  return (
    <p className={`report-view-mono-label ${className}`}>{children}</p>
  )
}

export function ReportMetricCard({ label, value, className = '', translateValue = true }) {
  const cvLabel = useCvLabel()
  const display = value != null && value !== ''
    ? (translateValue ? cvLabel(value) : value)
    : value
  return (
    <div className={`report-view-metric-card ${className}`}>
      <p className="report-view-mono-label mb-1">{label}</p>
      <p className="text-lg font-display font-bold text-ink">{display}</p>
    </div>
  )
}

export function ReportExplanationCard({ children, label = 'Explanation' }) {
  return (
    <div className="report-view-metric-card">
      <p className="report-view-mono-label mb-2">{label}</p>
      <p className="text-sm text-ink-secondary leading-relaxed font-sans">{children}</p>
    </div>
  )
}
