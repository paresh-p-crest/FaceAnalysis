import { useEffect, useMemo, useState } from 'react'
import { dedupeAssessments } from '../utils/assessmentDedupe'
import { isReportApproved, normalizeReportStatus } from '../utils/reportWorkflow'
import {
  BarChart3,
  CreditCard,
  FileText,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react'
import {
  fetchMyAssessments,
  fetchMyPayments,
  isBackendApiEnabled,
} from '../utils/apiClient'
import { formatHistoryDate } from '../utils/historyStorage'

const STATUS_STYLE = {
  draft: 'bg-surface-warm text-ink-muted border-surface-border',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  published: 'bg-brand-50 text-brand border-brand/20',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  created: 'bg-surface-warm text-ink-muted border-surface-border',
}

function StatusBadge({ status }) {
  const normalized = String(status || 'draft').toLowerCase()
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATUS_STYLE[normalized] || STATUS_STYLE.created}`}>
      {normalized.replace('_', ' ')}
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
    <div className="rounded-2xl border border-dashed border-surface-border bg-surface-warm dark:bg-surface-raised p-6 text-center">
      <p className="font-display text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  )
}

export default function DashboardPage({
  user,
  onAuth,
  onStartAssessment,
  onHistory,
  onBilling,
  onViewCloudItem,
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
      stats[status] += 1
    })
    return stats
  }, [assessments])

  const latestScore = assessments[0]?.analysis?.cvReport?.overall?.score ?? assessments[0]?.analysis?.metrics?.harmonyScore
  const paidCount = payments.filter((payment) => ['paid', 'complete', 'completed'].includes(String(payment.status).toLowerCase())).length

  return (
    <div className="min-h-screen px-6 py-12 pt-20 animate-fade-up font-sans bg-surface">
      <div className="max-w-6xl mx-auto pt-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">Dashboard</h1>
              <p className="text-sm text-ink-muted font-sans">Your reports, review status, and billing</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onStartAssessment} className="btn-primary text-sm">
              <Sparkles className="w-4 h-4" />
              New analysis
            </button>
            <button
              onClick={load}
              disabled={loading || !canLoad}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-surface-border bg-white dark:bg-surface-card text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState title="Backend API required" text="Set NEXT_PUBLIC_API_URL to load cloud reports and payments." />
        ) : !user ? (
          <div className="bg-white dark:bg-surface-card rounded-2xl p-8 text-center shadow-card border border-surface-border">
            <ShieldCheck className="w-10 h-10 text-brand mx-auto mb-3" />
            <p className="font-display text-ink mb-1">Sign in to view your dashboard</p>
            <p className="text-sm text-ink-muted font-sans mb-4">Your reports and payments are linked to your account.</p>
            <button onClick={onAuth} className="btn-primary text-sm">Sign in</button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
                  <User className="w-4 h-4 text-brand" />
                  Account
                </div>
                <p className="text-sm font-semibold text-ink truncate" title={user.email}>{user.email}</p>
                <p className="text-xs text-ink-muted mt-1 capitalize">{user.role || 'user'}</p>
              </div>

              <div className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
                  <FileText className="w-4 h-4 text-brand" />
                  Reports
                </div>
                <p className="font-display text-3xl font-semibold text-ink">{reportStats.total}</p>
                <p className="text-xs text-ink-muted mt-1">Cloud reports saved</p>
              </div>

              <div className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
                  <BarChart3 className="w-4 h-4 text-brand" />
                  Latest score
                </div>
                <p className="font-display text-3xl font-semibold text-ink">{latestScore ?? '--'}</p>
                <p className="text-xs text-ink-muted mt-1">From newest report</p>
              </div>

              <div className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
                  <CreditCard className="w-4 h-4 text-brand" />
                  Payments
                </div>
                <p className="font-display text-3xl font-semibold text-ink">{paidCount}</p>
                <p className="text-xs text-ink-muted mt-1">Completed records</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.35fr_0.85fr] gap-6">
              <section className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">Recent reports</h2>
                    <p className="text-xs text-ink-muted">Open approved reports or track review progress.</p>
                  </div>
                  <button
                    onClick={onHistory}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-border text-xs font-semibold text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors"
                  >
                    <History className="w-3.5 h-3.5" />
                    History
                  </button>
                </div>

                {loading ? (
                  <div className="py-10 text-center">
                    <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
                    <p className="text-sm text-ink-muted">Loading reports...</p>
                  </div>
                ) : assessments.length === 0 ? (
                  <EmptyState title="No cloud reports yet" text="Run a backend-connected assessment to populate your dashboard." />
                ) : (
                  <div className="space-y-3">
                    {assessments.map((assessment) => {
                      const score = assessment.analysis?.cvReport?.overall?.score ?? assessment.analysis?.metrics?.harmonyScore ?? '--'
                      return (
                        <div key={assessment.id} className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-display text-sm font-semibold text-ink truncate">
                                  Assessment {assessment.id.slice(-6)}
                                </p>
                                <StatusBadge status={assessment.status} />
                              </div>
                              <p className="text-xs text-ink-muted">
                                {formatHistoryDate(assessment.createdAt)} - {assessment.provider || 'local'} - score {score}
                              </p>
                            </div>
                            <button
                              onClick={() => onViewCloudItem?.(assessment)}
                              className="px-3 py-2 rounded-xl bg-white dark:bg-surface-card border border-surface-border text-xs font-semibold text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors"
                            >
                              Open report
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <div className="space-y-6">
                <section className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                  <h2 className="font-display text-lg font-semibold text-ink mb-4">Review pipeline</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Pending', reportStats.pending_review],
                      ['Approved', reportStats.approved],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border p-3">
                        <p className="text-xs text-ink-muted">{label}</p>
                        <p className="font-display text-2xl font-semibold text-ink">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white dark:bg-surface-card rounded-2xl p-5 shadow-card border border-surface-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink">Payments</h2>
                      <p className="text-xs text-ink-muted">Recent checkout records</p>
                    </div>
                    <button
                      onClick={onBilling}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-border text-xs font-semibold text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Billing
                    </button>
                  </div>

                  {payments.length === 0 ? (
                    <EmptyState title="No payments yet" text="Payment attempts and captures will appear here." />
                  ) : (
                    <div className="space-y-3">
                      {payments.slice(0, 4).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border p-3">
                          <div>
                            <p className="text-sm font-semibold text-ink capitalize">{payment.provider}</p>
                            <p className="text-xs text-ink-muted">{formatHistoryDate(payment.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-display font-bold text-brand">
                              {money(payment.amountCents, payment.currency)}
                            </p>
                            <StatusBadge status={payment.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
