'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { dedupeAssessments } from '../utils/assessmentDedupe'
import {
  isReportApproved,
  normalizeReportStatus,
  userReportReady,
} from '../utils/reportWorkflow'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  Clock3,
  CreditCard,
  FileText,
  History,
  Loader2,
  ScanFace,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import {
  fetchMyAssessments,
  fetchMyPayments,
  isBackendApiEnabled,
} from '../utils/apiClient'
import { formatHistoryDate } from '../utils/historyStorage'
import { formatAssessmentRef, resolveOverallHarmonyScore } from '../utils/qovesProtocolModel'

function money(amountCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((amountCents || 0) / 100)
}

function assessmentOverallScore(item) {
  if (!item || !isReportApproved(item.status)) return null
  return resolveOverallHarmonyScore(item.analysis)
}

function sessionLabel(user) {
  if (!user) return 'guest'
  if (user.name && String(user.name).trim()) return String(user.name).trim()
  const email = String(user.email || '')
  return email.split('@')[0] || email || 'guest'
}

function ScoreRing({ score, size = 140, stroke = 8, showValue = true }) {
  const r = (size / 2) - stroke
  const c = 2 * Math.PI * r
  const safe = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0
  const offset = c - (safe / 100) * c
  const fontSize = size >= 120 ? 36 : 20

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-ring shrink-0">
      <defs>
        <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#73bfa9" />
          <stop offset="100%" stopColor="#5e9f8b" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="ring-track"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-value"
      />
      {showValue && (
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-ink"
          style={{
            font: `600 ${fontSize}px Inter, Helvetica`,
            letterSpacing: '-0.02em',
          }}
        >
          {typeof score === 'number' ? score : '—'}
        </text>
      )}
    </svg>
  )
}

function MetricBar({ label, score, descriptor, queuedLabel }) {
  const width = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0
  const queued = score == null
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {queued ? (
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
            {queuedLabel}
          </span>
        ) : (
          <p className="text-[13px] font-semibold tabular-nums text-ink">
            {score}
            <span className="text-ink-muted font-normal">/100</span>
          </p>
        )}
      </div>
      <div className="dashboard-metric-track">
        {!queued && <div className="dashboard-metric-fill" style={{ width: `${width}%` }} />}
      </div>
      {descriptor && <p className="text-[11px] text-ink-muted">{descriptor}</p>}
    </div>
  )
}

function StatusChip({ ready, readyLabel, pendingLabel }) {
  return (
    <span className="dashboard-status-chip" data-state={ready ? 'ready' : 'pending'}>
      {ready && <Check className="h-3 w-3" aria-hidden />}
      {ready ? readyLabel : pendingLabel}
    </span>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm px-5 py-8 text-center">
      <p className="text-sm font-semibold text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto">{text}</p>
    </div>
  )
}

export default function DashboardPage({
  user,
  hasAnalysisAccess = true,
  accessReady = true,
  onStartAssessment,
  onHistory,
  onBilling,
  onViewCloudItem,
  openingReportId = null,
}) {
  const t = useTranslations('Dashboard')
  const [assessments, setAssessments] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const canLoad = !!user && isBackendApiEnabled()
  const billingLocked = accessReady && !hasAnalysisAccess
  const lockedClass = billingLocked ? 'opacity-60 pointer-events-none' : ''

  const load = async () => {
    if (!canLoad) return
    setLoading(true)
    setError('')
    try {
      const [nextAssessments, nextPayments] = await Promise.all([
        fetchMyAssessments(50),
        fetchMyPayments(8),
      ])
      setAssessments(dedupeAssessments(nextAssessments))
      setPayments(nextPayments)
    } catch (err) {
      setError(err.message || t('loadFailed'))
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
      if (stats[status] !== undefined) stats[status] += 1
    })
    return stats
  }, [assessments])

  const latestAssessment = assessments[0]
  const approvedScoreSource = useMemo(
    () => assessments.find((item) => isReportApproved(item.status)) ?? null,
    [assessments],
  )
  const bestScoreAssessment = useMemo(() => {
    let best = null
    let bestScore = -Infinity
    for (const item of assessments) {
      const score = assessmentOverallScore(item)
      if (score == null) continue
      if (score > bestScore) {
        bestScore = score
        best = item
      }
    }
    return best
  }, [assessments])
  const bestScore = bestScoreAssessment ? assessmentOverallScore(bestScoreAssessment) : null
  const latestScore = approvedScoreSource ? assessmentOverallScore(approvedScoreSource) : null
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
    const overall = assessmentOverallScore(approvedScoreSource)
    return {
      overall: overall ?? null,
      symmetry: m.symmetryScore || cv.symmetry?.score || null,
      proportions: m.proportionsScore || cv.proportions?.score || null,
      skin: m.skinScore || cv.skin?.score || null,
      structure:
        m.jawlineScore ||
        cv.jaw?.score ||
        cv.jawChin?.score ||
        cv.structure?.score ||
        null,
      locked: false,
    }
  }, [approvedScoreSource])

  const openLatest = () => {
    if (!latestAssessment) return
    onViewCloudItem?.(latestAssessment)
  }

  const openBestScore = () => {
    if (!bestScoreAssessment) {
      onHistory?.()
      return
    }
    if (userReportReady(bestScoreAssessment)) {
      onViewCloudItem?.(bestScoreAssessment)
      return
    }
    onHistory?.()
  }

  const kpis = [
    {
      key: 'reports',
      icon: FileText,
      label: t('kpiReports'),
      value: reportStats.total,
      descriptor: t('kpiReportsDesc'),
      emphasize: false,
      onClick: onHistory,
      disabled: billingLocked,
    },
    {
      key: 'score',
      icon: BarChart3,
      label: t('kpiBestScore'),
      value: bestScore != null ? bestScore : '—',
      descriptor: bestScore != null ? t('kpiBestScoreDesc') : t('kpiBestScoreEmpty'),
      emphasize: true,
      onClick: openBestScore,
      disabled:
        billingLocked ||
        (bestScoreAssessment &&
          userReportReady(bestScoreAssessment) &&
          openingReportId === bestScoreAssessment.id),
    },
    {
      key: 'payments',
      icon: Wallet,
      label: t('kpiPayments'),
      value: paidCount,
      descriptor: t('kpiPaymentsDesc'),
      emphasize: false,
      onClick: onBilling,
      disabled: false,
    },
  ]

  return (
    <div className="relative min-h-screen bg-surface site-navbar-offset font-sans text-ink">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] -z-0"
        style={{
          background:
            'radial-gradient(1100px 420px at 12% 0%, rgba(94, 159, 139, 0.16), transparent 58%), radial-gradient(900px 360px at 88% 8%, rgba(255, 255, 255, 0.55), transparent 55%)',
        }}
      />

      {/* Full-bleed hero flush under navbar */}
      <section className="relative z-10 dashboard-hero-band dashboard-hero-band--bleed surface-grain">
        <div className="relative z-10 flex w-full flex-col gap-8 px-4 py-8 sm:px-6 sm:py-9 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-10">
          <div className="max-w-xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                {t('welcomeBack', { name: sessionLabel(user) })}
              </span>
            </div>
            <h1 className="font-serif text-[44px] leading-[1.05] tracking-tight text-ink sm:text-[52px]">
              {t.rich('heroTitle', {
                harmony: (chunks) => <span className="italic text-brand">{chunks}</span>,
              })}
            </h1>
            <p className="max-w-md text-[15px] leading-relaxed text-ink-secondary">
              {t('heroSubtitle')}
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onStartAssessment}
                disabled={billingLocked}
                className="btn-primary disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {t('startNewAnalysis')}
              </button>
              <div className="ml-1 flex items-center gap-2 text-[12px] text-ink-muted">
                <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
                {t('hipaaNotice')}
              </div>
            </div>
          </div>

          <div className="grid w-full max-w-md grid-cols-3 gap-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <button
                  key={kpi.key}
                  type="button"
                  onClick={kpi.onClick}
                  disabled={kpi.disabled}
                  className="dashboard-card-glass p-4 flex flex-col gap-3 text-left transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-60 disabled:pointer-events-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="dashboard-icon-well-stat">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-ink-faint" aria-hidden />
                  </div>
                  <div>
                    <p className="micro-label">{kpi.label}</p>
                    <p
                      className={`mt-1 text-[26px] font-semibold tracking-tight tabular-nums ${
                        kpi.emphasize ? 'text-brand' : 'text-ink'
                      }`}
                    >
                      {kpi.value}
                    </p>
                    <p className="mt-1 text-[11px] leading-tight text-ink-muted">{kpi.descriptor}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pb-24 pt-6 space-y-8">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 backdrop-blur-sm">
            {error}
          </div>
        )}

        {billingLocked && (
          <section
            className="rounded-3xl border border-brand/30 bg-brand-50/70 p-6 sm:p-8 backdrop-blur-md"
            aria-labelledby="billing-required-heading"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">
              {t('billingRequiredEyebrow')}
            </p>
            <h2 id="billing-required-heading" className="font-serif text-2xl sm:text-3xl text-ink tracking-tight">
              {t('billingRequiredTitle')}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-ink-secondary leading-relaxed max-w-2xl">
              {t('billingRequiredDesc')}
            </p>
            <button type="button" onClick={onBilling} className="btn-primary mt-5">
              <Wallet className="w-4 h-4" />
              {t('billingRequiredCta')}
            </button>
          </section>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState title={t('backendRequiredTitle')} text={t('backendRequiredText')} />
        ) : (
          <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className={`space-y-6 ${lockedClass}`}>
              <div className="dashboard-panel overflow-hidden">
                <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
                  <div className="p-7 space-y-5">
                    <div className="flex items-center gap-2">
                      <span className="dashboard-icon-well h-9 w-9">
                        <ScanFace className="h-4 w-4" aria-hidden />
                      </span>
                      <p className="micro-label !text-brand">{t('scientificAnalysis')}</p>
                    </div>
                    <div className="space-y-3">
                      <h2 className="font-serif text-[30px] leading-tight tracking-tight text-ink">
                        {latestAssessment ? t('attractivenessTitle') : t('beginAssessmentTitle')}
                      </h2>
                      <p className="max-w-lg text-[14px] leading-relaxed text-ink-secondary">
                        {latestAssessment ? t('attractivenessDesc') : t('beginAssessmentDesc')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {latestAssessment && (
                        <button
                          type="button"
                          onClick={openLatest}
                          disabled={
                            openingReportId === latestAssessment.id ||
                            !userReportReady(latestAssessment)
                          }
                          className="btn-primary disabled:opacity-60"
                        >
                          {openingReportId === latestAssessment.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {t('opening')}
                            </>
                          ) : !userReportReady(latestAssessment) ? (
                            t('inPreparation')
                          ) : (
                            <>
                              {t('openLatestReport')}
                              <ArrowRight className="h-4 w-4" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative flex items-center justify-center border-t border-surface-border bg-brand-50/50 p-8 lg:border-l lg:border-t-0 lg:w-[260px]">
                    <div className="relative flex flex-col items-center gap-3">
                      <ScoreRing score={extractedMetrics.overall ?? latestScore} size={140} stroke={8} />
                      <p className="micro-label">{t('overallHarmony')}</p>
                      <StatusChip
                        ready={!extractedMetrics.locked && latestScore != null}
                        readyLabel={t('approved')}
                        pendingLabel={t('awaitingReview')}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="dashboard-panel">
                <div className="flex items-center justify-between border-b border-surface-border px-6 py-5">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">{t('recentAssessments')}</h3>
                    <p className="text-[12px] text-ink-muted">{t('recentAssessmentsDesc')}</p>
                  </div>
                  <button type="button" onClick={onHistory} className="btn-ghost !py-1.5 !px-3 !text-[12px]">
                    <History className="h-3.5 w-3.5" />
                    {t('viewHistory')}
                  </button>
                </div>

                {loading ? (
                  <div className="py-14 text-center">
                    <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
                    <p className="text-sm text-ink-muted">{t('loadingAssessments')}</p>
                  </div>
                ) : assessments.length === 0 ? (
                  <div className="p-6">
                    <EmptyState title={t('noAssessmentsTitle')} text={t('noAssessmentsText')} />
                  </div>
                ) : (
                  <div className="divide-y divide-surface-border">
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-2.5">
                      <span className="micro-label">{t('tableAssessment')}</span>
                      <span className="micro-label text-right">{t('tableScore')}</span>
                      <span className="micro-label text-right w-24">{t('tableStatus')}</span>
                    </div>
                    {assessments.map((assessment) => {
                      const approved = isReportApproved(assessment.status)
                      const ready = userReportReady(assessment)
                      const opening = openingReportId === assessment.id
                      const score = approved ? resolveOverallHarmonyScore(assessment.analysis) : null
                      const refLabel = formatAssessmentRef(assessment)
                      return (
                        <button
                          key={assessment.id}
                          type="button"
                          onClick={() => ready && onViewCloudItem?.(assessment)}
                          disabled={!ready || opening}
                          className="group grid w-full grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3.5 text-left transition-colors hover:bg-brand-50/40 disabled:cursor-default"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="dashboard-icon-well h-9 w-9 shrink-0">
                              <ScanFace className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <p className="text-[13.5px] font-medium text-ink truncate font-mono tracking-tight">
                                  #{refLabel}
                                </p>
                                {ready && (
                                  <ArrowRight
                                    className={`h-3.5 w-3.5 shrink-0 text-brand transition-opacity ${
                                      opening ? 'opacity-40' : 'opacity-70 group-hover:opacity-100'
                                    }`}
                                    aria-hidden
                                  />
                                )}
                                {opening && (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" aria-hidden />
                                )}
                              </div>
                              <p className="text-[11.5px] text-ink-muted flex items-center gap-1">
                                <Clock3 className="h-3 w-3" aria-hidden />
                                {formatHistoryDate(assessment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[15px] font-semibold tabular-nums text-ink">
                              {score != null ? (
                                <>
                                  {score}
                                  <span className="text-[11px] font-normal text-ink-muted">/100</span>
                                </>
                              ) : (
                                <span className="text-[11px] font-normal text-ink-muted">{t('queued')}</span>
                              )}
                            </p>
                          </div>
                          <div className="w-24 flex justify-end">
                            <StatusChip
                              ready={ready}
                              readyLabel={t('ready')}
                              pendingLabel={t('inPreparation')}
                            />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={`space-y-6 ${billingLocked ? 'opacity-90' : ''}`}>
              <div className={`dashboard-panel p-6 space-y-5 ${lockedClass}`}>
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">{t('harmonyTitle')}</h3>
                  <p className="text-[12px] text-ink-muted">{t('overallHarmonyDesc')}</p>
                </div>

                {extractedMetrics.locked ? (
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-amber-800 mb-1">{t('scoresHiddenTitle')}</p>
                    <p className="text-xs text-amber-700/80 leading-relaxed">{t('awaitingReviewMessage')}</p>
                  </div>
                ) : (
                  <div className="space-y-5 pt-1">
                    <MetricBar
                      label={t('metricSymmetry')}
                      score={extractedMetrics.symmetry}
                      descriptor={t('metricSymmetryDesc')}
                      queuedLabel={t('queued')}
                    />
                    <MetricBar
                      label={t('metricGoldenRatio')}
                      score={extractedMetrics.proportions}
                      descriptor={t('metricGoldenRatioDesc')}
                      queuedLabel={t('queued')}
                    />
                    <MetricBar
                      label={t('metricSkin')}
                      score={extractedMetrics.skin}
                      descriptor={t('metricSkinDesc')}
                      queuedLabel={t('queued')}
                    />
                    <MetricBar
                      label={t('metricJawline')}
                      score={extractedMetrics.structure}
                      descriptor={t('metricJawlineDesc')}
                      queuedLabel={t('queued')}
                    />
                  </div>
                )}
              </div>

              <div className={`dashboard-panel p-6 space-y-4 ${lockedClass}`}>
                <h3 className="text-[15px] font-semibold text-ink">{t('reviewPipeline')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-surface-border bg-surface-warm p-4">
                    <p className="micro-label">{t('pendingReview')}</p>
                    <p className="mt-2 text-[28px] font-semibold tracking-tight tabular-nums text-ink">
                      {reportStats.pending_review}
                    </p>
                    <p className="text-[11px] text-ink-muted">
                      {reportStats.pending_review === 0 ? t('pipelineCaughtUp') : t('pipelineWaiting')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand/25 bg-brand-50 p-4">
                    <p className="micro-label !text-brand">{t('dermatologistApproved')}</p>
                    <p className="mt-2 text-[28px] font-semibold tracking-tight tabular-nums text-brand">
                      {reportStats.approved}
                    </p>
                    <p className="text-[11px] text-ink-secondary">{t('pipelineSignedOff')}</p>
                  </div>
                </div>
              </div>

              <div
                className={`dashboard-panel p-6 space-y-4 ${
                  billingLocked ? 'ring-2 ring-brand/15 border-brand/35' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">{t('payments')}</h3>
                    <p className="text-[12px] text-ink-muted">
                      {billingLocked ? t('billingRequiredPaymentsDesc') : t('paymentsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onBilling}
                    className={`!py-1.5 !px-3 !text-[12px] ${
                      billingLocked ? 'btn-primary' : 'btn-ghost'
                    }`}
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    {billingLocked ? t('billingRequiredCta') : t('billing')}
                  </button>
                </div>

                {!latestPayment ? (
                  <EmptyState title={t('noPaymentsTitle')} text={t('noPaymentsText')} />
                ) : (
                  <div className="rounded-2xl border border-surface-border bg-surface-warm p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-medium text-ink">{t('assessmentCredit')}</p>
                        <p className="text-[11.5px] text-ink-muted flex items-center gap-1">
                          <Clock3 className="h-3 w-3" aria-hidden />
                          {formatHistoryDate(latestPayment.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-semibold tabular-nums text-ink">
                          {money(latestPayment.amountCents, latestPayment.currency)}
                        </p>
                        <span
                          className="dashboard-status-chip mt-1"
                          data-state={
                            ['paid', 'complete', 'completed'].includes(
                              String(latestPayment.status).toLowerCase(),
                            )
                              ? 'ready'
                              : 'pending'
                          }
                        >
                          {['paid', 'complete', 'completed'].includes(
                            String(latestPayment.status).toLowerCase(),
                          )
                            ? t('ready')
                            : t('paymentPendingReview')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
