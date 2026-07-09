import { useEffect, useMemo, useState } from 'react'
import { dedupeAssessments } from '../utils/assessmentDedupe'
import { isReportApproved, normalizeReportStatus, formatReportStatusLabel, clientAwaitingReviewMessage } from '../utils/reportWorkflow'
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
  Scan,
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
  created: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
}

function StatusBadge({ status }) {
  const normalized = normalizeReportStatus(status)
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATUS_STYLE[normalized] || STATUS_STYLE.created}`}>
      {formatReportStatusLabel(status)}
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
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-6 text-center">
      <p className="font-display text-slate-800 dark:text-slate-200 font-semibold mb-1">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
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
  const paidCount = payments.filter((payment) => ['paid', 'complete', 'completed'].includes(String(payment.status).toLowerCase())).length

  // Extract clean scientific proportions (matching myface.club layout)
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
    const overall = approvedScoreSource.analysis.cvReport?.overall?.score ?? approvedScoreSource.analysis.metrics?.harmonyScore
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
    <div className="min-h-screen px-4 sm:px-6 py-12 pt-20 animate-fade-up font-sans bg-surface text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto pt-8">
        
        {/* ── Top Header Bar ── */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-8">
          
          {/* Serif branding */}
          <div className="flex items-center">
            <span className="font-serif font-bold text-slate-900 dark:text-white text-2xl tracking-tight">MyFace</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading || !canLoad}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-[50px] text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 text-slate-700 dark:text-slate-200"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <RefreshCw className="w-3.5 h-3.5 text-slate-450" />}
              Refresh
            </button>
            <button
              onClick={onStartAssessment}
              className="inline-flex items-center gap-2 px-5 py-1.5 rounded-[50px] bg-[#5e9f8b] hover:bg-[#548f7d] text-white text-xs font-bold transition-all shadow-sm"
            >
              Start New Analysis
            </button>
          </div>
        </div>

        {/* Dashboard Title & Subtitle */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold tracking-tight">Your Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and review your aesthetic facial assessments</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-955/20 dark:border-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState title="Backend API required" text="Set NEXT_PUBLIC_API_URL to load cloud reports and payments." />
        ) : !user ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 text-center shadow-sm border border-slate-100 dark:border-slate-800 max-w-lg mx-auto">
            <ShieldCheck className="w-12 h-12 text-[#5e9f8b] mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Sign in to view your dashboard</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Your facial reports and payment history are securely synced to your email.</p>
            <button onClick={onAuth} className="px-6 py-3 rounded-[50px] bg-[#5e9f8b] hover:bg-[#548f7d] text-white font-semibold text-sm tracking-[-0.03px] transition-all shadow-sm">
              Sign In
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* ── Top-level Overview Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider font-semibold">
                  <User className="w-4 h-4 text-[#5e9f8b]" />
                  Account
                </div>
                <p className="text-sm font-bold truncate" title={user.email}>{user.email}</p>
                <p className="text-xs text-slate-400 mt-1 capitalize font-medium">{user.role || 'user'}</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider font-semibold">
                  <FileText className="w-4 h-4 text-[#5e9f8b]" />
                  Reports
                </div>
                <p className="font-display text-3xl font-bold text-slate-800 dark:text-white">{reportStats.total}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">Cloud assessments saved</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider font-semibold">
                  <BarChart3 className="w-4 h-4 text-[#5e9f8b]" />
                  Latest Score
                </div>
                <p className="font-display text-3xl font-bold text-slate-800 dark:text-white">{latestScore ?? '--'}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {latestScore != null ? 'Out of 100 overall' : 'Available after approval'}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider font-semibold">
                  <CreditCard className="w-4 h-4 text-[#5e9f8b]" />
                  Payments
                </div>
                <p className="font-display text-3xl font-bold text-slate-800 dark:text-white">{paidCount}</p>
                <p className="text-xs text-slate-400 mt-1 font-medium">Completed records</p>
              </div>
            </div>

            {/* ── Welcome Banner & Attributes Summary (Inspired by myface.club Layout) ── */}
            <div className="grid lg:grid-cols-[1.35fr_0.85fr] gap-6">
              
              {/* Left Side: Dynamic Preview (Aesthetics and Onboarding Steps) */}
              <div className="space-y-6">
                
                {/* Minty Gradient Hero/Status Area */}
                <div className="bg-gradient-to-br from-[#f0fdf4] to-[#f0fdfa] dark:from-[#132c2a] dark:to-[#0d2321] border border-teal-100/50 dark:border-teal-900/30 p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-sm">
                  <div className="relative z-10 space-y-4">
                    <span className="inline-block px-3 py-1 rounded-full bg-[#5e9f8b]/10 text-[#5e9f8b] text-[10px] font-bold uppercase tracking-wider">
                      Scientific Analysis
                    </span>
                    
                    {latestAssessment ? (
                      <div className="space-y-4">
                        <h2 className="font-display text-2xl font-bold text-[#5e9f8b] leading-tight">
                          Attractiveness & Facial Harmony
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed">
                          Your face was scanned against 468+ landmarks. Your overall attractiveness score is calculated based on horizontal/vertical symmetry, golden ratios, and structure.
                        </p>
                        
                        <div className="pt-2">
                          <button
                            onClick={() => onViewCloudItem?.(latestAssessment)}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-[50px] bg-[#5e9f8b] hover:bg-[#548f7d] text-white text-xs font-bold tracking-[-0.03px] transition-all shadow-sm"
                          >
                            Open Latest Report →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h2 className="font-display text-2xl font-bold text-[#5e9f8b] leading-tight">
                          Get Your Attractiveness Report in 3 Steps
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg leading-relaxed">
                          Analyze your facial structure, golden proportions, and skin health using our neural CV scan. Discover scientific recommendations to improve your appearance.
                        </p>
                        
                        {/* 3 Simple Steps list */}
                        <div className="grid grid-cols-3 gap-4 pt-2">
                          {[
                            ['1. Questionnaire', '23 QOVES queries'],
                            ['2. Photo Scan', '468+ coordinates'],
                            ['3. PDF Report', 'Symmetry metrics'],
                          ].map(([step, desc]) => (
                            <div key={step} className="p-3 bg-white/50 dark:bg-slate-900/30 rounded-xl border border-teal-500/10">
                              <p className="text-xs font-bold text-[#5e9f8b]">{step}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2">
                          <button
                            onClick={onStartAssessment}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-[50px] bg-[#5e9f8b] hover:bg-[#548f7d] text-white text-xs font-bold tracking-[-0.03px] transition-all shadow-sm"
                          >
                            Analyze Attractiveness Now →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Subtle Background Blob */}
                  <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-radial-gradient from-teal-500/10 to-transparent pointer-events-none" />
                </div>

                {/* Recent Assessments list */}
                <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="font-display text-lg font-bold">Recent Assessments</h2>
                      <p className="text-xs text-slate-400">Open approved reports or track review status.</p>
                    </div>
                    <button
                      onClick={onHistory}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[50px] border border-slate-200 dark:border-slate-800 text-xs font-bold hover:text-[#5e9f8b] hover:border-[#5e9f8b] transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                      View History
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center">
                      <Loader2 className="w-7 h-7 text-[#5e9f8b] animate-spin mx-auto mb-3" />
                      <p className="text-sm text-slate-400">Loading reports...</p>
                    </div>
                  ) : assessments.length === 0 ? (
                    <EmptyState title="No cloud reports yet" text="Run a backend-connected assessment to populate your dashboard." />
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {assessments.map((assessment) => {
                        const approved = isReportApproved(assessment.status)
                        const score = approved
                          ? (assessment.analysis?.cvReport?.overall?.score ?? assessment.analysis?.metrics?.harmonyScore ?? '--')
                          : '--'
                        return (
                          <div key={assessment.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-display text-sm font-bold truncate text-slate-800 dark:text-slate-100">
                                  Assessment {assessment.id.slice(-6).toUpperCase()}
                                </p>
                                <StatusBadge status={assessment.status} />
                              </div>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                {formatHistoryDate(assessment.createdAt)} - {assessment.provider || 'local'}
                                {approved ? ` - score ${score}/100` : ' - awaiting review'}
                              </p>
                            </div>
                            <button
                              onClick={() => onViewCloudItem?.(assessment)}
                              className="px-4 py-2 rounded-[50px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              Open Report
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

              </div>

              {/* Right Side: Proportions Gauges & Reviews/Payments (myface.club dashboard attributes style) */}
              <div className="space-y-6">
                
                {/* Proportions Metrics Cards */}
                <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-base font-bold">Harmony & Proportions</h2>
                    {extractedMetrics.locked && (
                      <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wide bg-amber-500/10 px-2 py-0.5 rounded">
                        Awaiting Review
                      </span>
                    )}
                  </div>

                  {extractedMetrics.locked ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/30 p-5 text-center">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Scores hidden until approval</p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                        {clientAwaitingReviewMessage()}
                      </p>
                    </div>
                  ) : (
                    <>
                  {/* Gauge score */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-900/30 mb-5">
                    <div className="w-14 h-14 rounded-full border-[3.5px] border-[#5e9f8b]/20 flex items-center justify-center text-center">
                      <div className="font-display text-lg font-extrabold text-[#5e9f8b]">
                        {extractedMetrics.overall}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Overall Facial Harmony</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">Based on vertical and golden ratio parameters</p>
                    </div>
                  </div>

                  {/* Attribute Bars list */}
                  <div className="space-y-4">
                    {[
                      ['Facial Symmetry', extractedMetrics.symmetry, 'Horizontal & vertical layouts'],
                      ['Golden Ratio Harmony', extractedMetrics.proportions, 'Geometric facial features'],
                      ['Skin Health & Structure', extractedMetrics.skin, 'Tone, blemishes, and texture'],
                      ['Jawline & Proportions', extractedMetrics.structure, 'Mandible and chin contours'],
                    ].map(([label, score, desc]) => (
                      <div key={label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{label}</span>
                          <span className="font-bold text-[#5e9f8b]">{score}/100</span>
                        </div>
                        {/* Custom progress line */}
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#5e9f8b] to-[#548f7d] transition-all duration-500 rounded-full"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500">{desc}</p>
                      </div>
                    ))}
                  </div>
                    </>
                  )}
                </section>

                {/* Review Pipeline details */}
                <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <h2 className="font-display text-base font-bold mb-3">Review Pipeline</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Pending Review', reportStats.pending_review],
                      ['Dermatologist Approved', reportStats.approved],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-900/30 p-3.5">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                        <p className="font-display text-2xl font-bold mt-1">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Payments Section */}
                <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-display text-base font-bold">Payments</h2>
                      <p className="text-xs text-slate-400">Captures and receipts</p>
                    </div>
                    <button
                      onClick={onBilling}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-[50px] border border-slate-200 dark:border-slate-800 text-xs font-bold hover:text-[#5e9f8b] hover:border-[#5e9f8b] transition-colors"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Billing
                    </button>
                  </div>

                  {payments.length === 0 ? (
                    <EmptyState title="No payments yet" text="Payment captures will appear here." />
                  ) : (
                    <div className="space-y-2">
                      {payments.slice(0, 3).map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-900/30 p-3">
                          <div>
                            <p className="text-xs font-bold capitalize">{payment.provider}</p>
                            <p className="text-[10px] text-slate-400">{formatHistoryDate(payment.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-display font-extrabold text-[#5e9f8b]">
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
