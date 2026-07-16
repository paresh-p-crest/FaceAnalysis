import { useEffect, useMemo, useState } from 'react'
import { dedupeAssessments } from '../utils/assessmentDedupe'
import {
  isReportApproved,
  normalizeReportStatus,
  formatReportStatusLabel,
  clientAwaitingReviewMessage,
  userReportReady,
} from '../utils/reportWorkflow'
import {
  BarChart3,
  CreditCard,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import {
  fetchMyAssessments,
  fetchMyPayments,
  isBackendApiEnabled,
} from '../utils/apiClient'
import { formatHistoryDate } from '../utils/historyStorage'

const STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
  published: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
  processing: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30',
  failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30',
  created: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

function StatusBadge({ status, assessment }) {
  // Assessments show a neutral, user-facing readiness (live status is admin-only).
  if (assessment) {
    const ready = userReportReady(assessment)
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-medium tracking-wide ${
          ready ? STATUS_STYLE.approved : STATUS_STYLE.pending_review
        }`}
      >
        {ready ? 'Ready' : 'In preparation'}
      </span>
    )
  }
  const display = normalizeReportStatus(status)
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-medium tracking-wide ${STATUS_STYLE[display] || STATUS_STYLE.created}`}
    >
      {formatReportStatusLabel(display)}
    </span>
  )
}

function money(amountCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((amountCents || 0) / 100)
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm/40 dark:bg-surface-raised/20 px-5 py-8 text-center">
      <p className="font-display text-sm font-semibold text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto">{text}</p>
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, descriptor, emphasize = false }) {
  return (
    <div
      className={`rounded-2xl border bg-surface-card p-5 transition-colors duration-200 ${
        emphasize
          ? 'border-brand/30 shadow-soft ring-1 ring-brand/10'
          : 'border-surface-border shadow-soft'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${emphasize ? 'text-brand' : 'text-ink-muted'}`} aria-hidden />
        <span className="text-[11px] uppercase tracking-wider font-medium text-ink-muted">{label}</span>
      </div>
      <p
        className={`font-display font-bold tracking-tight truncate ${
          emphasize ? 'text-2xl sm:text-3xl text-brand' : 'text-xl sm:text-2xl text-ink'
        }`}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
      <p className="text-xs text-ink-muted mt-1.5 leading-snug">{descriptor}</p>
    </div>
  )
}

function MetricBar({ label, score, descriptor }) {
  const width = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-sm font-semibold text-brand tabular-nums shrink-0">
          {score != null ? `${score}/100` : '—'}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-raised overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
      {descriptor && <p className="text-[11px] text-ink-muted leading-snug">{descriptor}</p>}
    </div>
  )
}

export default function DashboardPage({
  user,
  onStartAssessment,
  onHistory,
  onBilling,
  onViewCloudItem,
  openingReportId = null,
}) {
  const [assessments, setAssessments] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canLoad = !!user && isBackendApiEnabled()

  const load = async () => {
    if (!canLoad) return
    setLoading(true)
    setError('')
    try {
      const [nextAssessments, nextPayments] = await Promise.all([
        fetchMyAssessments(8),
        fetchMyPayments(8),
      ])
      setAssessments(dedupeAssessments(nextAssessments))
      setPayments(nextPayments)
    } catch (err) {
      setError(err.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user?.id])

  const reportStats = useMemo(() => {
    const stats = { total: assessments.length, pending_review: 0, approved: 0 }
    assessments.forEach((item) => {
      const status = normalizeReportStatus(item.status)
      if (stats[status] !== undefined) {
        stats[status] += 1
      }
    })
    return stats
  }, [assessments])

  const latestAssessment = assessments[0]
  const approvedScoreSource = useMemo(
    () => assessments.find((item) => isReportApproved(item.status)) ?? null,
    [assessments],
  )
  const latestScore = approvedScoreSource
    ? (approvedScoreSource.analysis?.cvReport?.overall?.score ?? approvedScoreSource.analysis?.metrics?.harmonyScore)
    : null
  const paidCount = payments.filter((payment) =>
    ['paid', 'complete', 'completed'].includes(String(payment.status).toLowerCase()),
  ).length
  const latestPayment = payments[0] ?? null

  const extractedMetrics = useMemo(() => {
    if (!approvedScoreSource?.analysis) {
      return {
        overall: null,
        symmetry: null,
        proportions: null,
        skin: null,
        structure: null,
        locked: true,
      }
    }
    const cv = approvedScoreSource.analysis.cvReport || {}
    const m = approvedScoreSource.analysis.metrics || {}
    const overall =
      approvedScoreSource.analysis.cvReport?.overall?.score ??
      approvedScoreSource.analysis.metrics?.harmonyScore
    return {
      overall: overall ?? null,
      symmetry: m.symmetryScore || cv.symmetry?.score || null,
      proportions: m.proportionsScore || cv.proportions?.score || null,
      skin: m.skinScore || cv.skin?.score || null,
      structure: m.jawlineScore || cv.structure?.score || null,
      locked: false,
    }
  }, [approvedScoreSource])

  return (
    <div className="min-h-screen px-3 sm:px-4 md:px-6 pb-10 site-navbar-offset animate-fade-up font-sans bg-surface text-ink">
      <div className="max-w-[1440px] mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7 md:mb-8">
          <div className="min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-ink leading-tight">
              Your Dashboard
            </h1>
            <p className="mt-1.5 text-base text-ink-muted leading-snug max-w-xl">
              Review assessments, track scores, and open your latest facial analysis report.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={load}
              disabled={loading || !canLoad}
              className="btn-ghost text-sm px-4 py-2.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-muted" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </button>
            <button type="button" onClick={onStartAssessment} className="btn-primary text-sm px-5 py-2.5 shadow-brand">
              Start New Analysis
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState
            title="Backend API required"
            text="Set NEXT_PUBLIC_API_URL to load cloud reports and payments."
          />
        ) : (
          <div className="space-y-6 md:space-y-7">
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 md:gap-4" aria-label="Account summary">
              <KpiCard
                icon={FileText}
                label="Reports"
                value={reportStats.total}
                descriptor="Cloud assessments saved"
              />
              <KpiCard
                icon={BarChart3}
                label="Latest Score"
                value={latestScore ?? '—'}
                descriptor={latestScore != null ? 'Overall harmony / 100' : 'Available after approval'}
                emphasize
              />
              <KpiCard
                icon={CreditCard}
                label="Payments"
                value={paidCount}
                descriptor="Completed payments"
              />
            </section>

            <div className="grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-5 md:gap-6 items-start">
              <div className="space-y-5 md:space-y-6 min-w-0">
                <section className="rounded-3xl border border-surface-border bg-brand-100/50 dark:bg-brand-50 dark:border-brand/20 p-7 sm:p-9 shadow-soft">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-brand mb-3">
                    Scientific Analysis
                  </p>

                  {latestAssessment ? (
                    <>
                      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight leading-tight max-w-lg">
                        Attractiveness & Facial Harmony
                      </h2>
                      <p className="mt-3 text-sm sm:text-[15px] text-ink-secondary leading-relaxed max-w-xl">
                        Face scanned against 468+ landmarks. Scores reflect symmetry, golden-ratio
                        proportions, and structural balance. Open the report for the full assessment.
                      </p>
                      <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={() => onViewCloudItem?.(latestAssessment)}
                          disabled={openingReportId === latestAssessment.id || !userReportReady(latestAssessment)}
                          className="btn-primary text-sm px-5 py-2.5 disabled:opacity-60"
                        >
                          {!userReportReady(latestAssessment) ? (
                            'In preparation'
                          ) : openingReportId === latestAssessment.id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Opening…
                            </span>
                          ) : (
                            'Open Latest Report'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={onStartAssessment}
                          className="btn-ghost text-sm px-5 py-2.5"
                        >
                          Start New Analysis
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight leading-tight max-w-lg">
                        Begin Your Facial Assessment
                      </h2>
                      <p className="mt-3 text-sm sm:text-[15px] text-ink-secondary leading-relaxed max-w-xl">
                        Complete the questionnaire, upload calibrated photos, and receive a structured
                        report on symmetry, proportions, and facial structure.
                      </p>
                      <ol className="mt-5 grid sm:grid-cols-3 gap-3">
                        {[
                          ['01', 'Questionnaire', 'Clinical intake'],
                          ['02', 'Photo Scan', '468+ landmarks'],
                          ['03', 'Report', 'Harmony metrics'],
                        ].map(([step, title, desc]) => (
                          <li
                            key={step}
                            className="rounded-2xl border border-surface-border/80 bg-surface-card/70 dark:bg-surface-card/40 px-3.5 py-3"
                          >
                            <p className="text-[10px] font-medium uppercase tracking-wider text-brand mb-1">
                              {step}
                            </p>
                            <p className="text-sm font-semibold text-ink">{title}</p>
                            <p className="text-[11px] text-ink-muted mt-0.5">{desc}</p>
                          </li>
                        ))}
                      </ol>
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={onStartAssessment}
                          className="btn-primary text-sm px-5 py-2.5"
                        >
                          Start New Analysis
                        </button>
                      </div>
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-surface-border bg-surface-card shadow-soft overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-surface-border">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink">Recent Assessments</h2>
                      <p className="text-xs text-ink-muted mt-0.5">
                        Review status and open approved reports.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onHistory}
                      className="btn-ghost text-xs px-3.5 py-2 shrink-0"
                    >
                      <History className="w-3.5 h-3.5" />
                      View History
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-14 text-center">
                      <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
                      <p className="text-sm text-ink-muted">Loading assessments…</p>
                    </div>
                  ) : assessments.length === 0 ? (
                    <div className="p-5 sm:p-6">
                      <EmptyState
                        title="No assessments yet"
                        text="Run a backend-connected analysis to populate this table."
                      />
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-surface-border bg-surface-warm/60 dark:bg-surface-raised/30">
                              <th className="px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                                Assessment
                              </th>
                              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                                Date
                              </th>
                              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                                Score
                              </th>
                              <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
                                Status
                              </th>
                              <th className="px-6 py-3 text-[11px] font-medium uppercase tracking-wider text-ink-muted text-right">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-border">
                            {assessments.map((assessment) => {
                              const approved = isReportApproved(assessment.status)
                              const ready = userReportReady(assessment)
                              const score = approved
                                ? (assessment.analysis?.cvReport?.overall?.score ??
                                  assessment.analysis?.metrics?.harmonyScore ??
                                  '—')
                                : '—'
                              return (
                                <tr
                                  key={assessment.id}
                                  className="group h-16 hover:bg-surface-warm/50 dark:hover:bg-surface-raised/25 transition-colors duration-150"
                                >
                                  <td className="px-6 py-3">
                                    <p className="font-display text-sm font-semibold text-ink tabular-nums">
                                      {assessment.id.slice(-6).toUpperCase()}
                                    </p>
                                    <p className="text-[11px] text-ink-muted mt-0.5 capitalize">
                                      {assessment.provider || 'local'}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-ink-secondary whitespace-nowrap">
                                    {formatHistoryDate(assessment.createdAt)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="font-display text-sm font-semibold tabular-nums text-ink">
                                      {score}
                                      {approved && score !== '—' ? (
                                        <span className="text-ink-muted font-normal text-xs"> /100</span>
                                      ) : null}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <StatusBadge status={assessment.status} assessment={assessment} />
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => onViewCloudItem?.(assessment)}
                                      disabled={openingReportId === assessment.id || !ready}
                                      className="btn-ghost text-xs px-3.5 py-1.5 opacity-80 group-hover:opacity-100 disabled:opacity-60"
                                    >
                                      {!ready ? (
                                        'In preparation'
                                      ) : openingReportId === assessment.id ? (
                                        <span className="inline-flex items-center gap-1.5">
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Opening…
                                        </span>
                                      ) : (
                                        'Open Report'
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="md:hidden divide-y divide-surface-border">
                        {assessments.map((assessment) => {
                          const approved = isReportApproved(assessment.status)
                          const ready = userReportReady(assessment)
                          const score = approved
                            ? (assessment.analysis?.cvReport?.overall?.score ??
                              assessment.analysis?.metrics?.harmonyScore ??
                              '—')
                            : '—'
                          return (
                            <div key={assessment.id} className="px-5 py-4 space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-display text-sm font-semibold text-ink">
                                    Assessment {assessment.id.slice(-6).toUpperCase()}
                                  </p>
                                  <p className="text-[11px] text-ink-muted mt-0.5">
                                    {formatHistoryDate(assessment.createdAt)}
                                  </p>
                                </div>
                                <StatusBadge status={assessment.status} assessment={assessment} />
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm text-ink-secondary">
                                  Score{' '}
                                  <span className="font-display font-semibold text-ink tabular-nums">
                                    {score}
                                    {approved && score !== '—' ? '/100' : ''}
                                  </span>
                                </p>
                                <button
                                  type="button"
                                  onClick={() => onViewCloudItem?.(assessment)}
                                  disabled={openingReportId === assessment.id || !ready}
                                  className="btn-ghost text-xs px-3.5 py-1.5 disabled:opacity-60"
                                >
                                  {!ready ? 'In preparation' : openingReportId === assessment.id ? 'Opening…' : 'Open Report'}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </section>
              </div>

              <aside className="space-y-5 md:space-y-6 min-w-0">
                <section className="rounded-2xl border border-surface-border bg-surface-card shadow-soft p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <h2 className="font-display text-lg font-semibold text-ink">Harmony & Proportions</h2>
                    {extractedMetrics.locked && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        Awaiting Review
                      </span>
                    )}
                  </div>

                  {extractedMetrics.locked ? (
                    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/30 px-4 py-5 text-center">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                        Scores hidden until approval
                      </p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                        {clientAwaitingReviewMessage()}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 rounded-2xl border border-surface-border bg-surface-warm/60 dark:bg-surface-raised/25 px-4 py-3.5 mb-5">
                        <div className="w-14 h-14 rounded-full border-[3px] border-brand/25 flex items-center justify-center shrink-0">
                          <span className="font-display text-lg font-bold text-brand tabular-nums">
                            {extractedMetrics.overall}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">Overall Facial Harmony</p>
                          <p className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                            Composite of symmetry, ratios, and structure
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <MetricBar
                          label="Facial Symmetry"
                          score={extractedMetrics.symmetry}
                          descriptor="Horizontal and vertical balance"
                        />
                        <MetricBar
                          label="Golden Ratio Harmony"
                          score={extractedMetrics.proportions}
                          descriptor="Geometric facial proportions"
                        />
                        <MetricBar
                          label="Skin Health & Structure"
                          score={extractedMetrics.skin}
                          descriptor="Tone, texture, and surface quality"
                        />
                        <MetricBar
                          label="Jawline & Proportions"
                          score={extractedMetrics.structure}
                          descriptor="Mandible and chin contours"
                        />
                      </div>
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-surface-border bg-surface-card shadow-soft p-5">
                  <h2 className="font-display text-base font-semibold text-ink mb-3">Review Pipeline</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Pending Review', reportStats.pending_review],
                      ['Dermatologist Approved', reportStats.approved],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-surface-border bg-surface-warm/50 dark:bg-surface-raised/20 px-3.5 py-3"
                      >
                        <p className="text-[10px] text-ink-muted font-medium uppercase tracking-wider leading-snug">
                          {label}
                        </p>
                        <p className="font-display text-2xl font-bold text-ink mt-1.5 tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-surface-border bg-surface-card shadow-soft p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h2 className="font-display text-base font-semibold text-ink">Payments</h2>
                      <p className="text-xs text-ink-muted mt-0.5">Latest billing activity</p>
                    </div>
                    <button type="button" onClick={onBilling} className="btn-ghost text-xs px-3 py-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      Billing
                    </button>
                  </div>

                  {!latestPayment ? (
                    <EmptyState title="No payments yet" text="Payment captures will appear here." />
                  ) : (
                    <div className="rounded-xl border border-surface-border bg-surface-warm/40 dark:bg-surface-raised/20 px-3.5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink capitalize truncate">
                          {latestPayment.provider}
                        </p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {formatHistoryDate(latestPayment.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-display font-semibold text-ink tabular-nums">
                          {money(latestPayment.amountCents, latestPayment.currency)}
                        </p>
                        <StatusBadge status={latestPayment.status} />
                      </div>
                    </div>
                  )}
                </section>
              </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
