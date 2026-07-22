'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '../i18n/navigation'
import {
  BarChart3,
  CreditCard,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import {
  deleteAssessment,
  deleteAdminUser,
  fetchAssessment,
  isBackendApiEnabled,
  updateAssessmentStatus,
} from '../utils/apiClient'
import { ADMIN_TABS, adminTabToPath, persistAdminTab } from '../utils/adminPanel'
import { isAdminResourceLoading, resourcesForAdminTab } from '../utils/adminWorkspace'
import { formatHistoryDate } from '../utils/historyStorage'
import { formatAssessmentRef, resolveOverallHarmonyScore } from '../utils/qovesProtocolModel'
import { isAssessmentProcessing, normalizeReportStatus, REPORT_WORKFLOW_STATUSES } from '../utils/reportWorkflow'
import { translateApiError } from '../utils/translateApiError'
import ConfirmDialog from './ConfirmDialog'
import { useApp } from './providers/AppProvider'

const STATUS_STYLE = {
  draft: 'bg-surface-warm text-ink-muted border-surface-border',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  created: 'bg-surface-warm text-ink-muted border-surface-border',
}

function StatusBadge({ status, t }) {
  const display = normalizeReportStatus(status)
  const label = display === 'pending_review' ? t('status.pendingReview') : t(`status.${display}`)
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATUS_STYLE[display] || STATUS_STYLE.created}`}>
      {label}
    </span>
  )
}

/** Admin-only live pipeline indicator (hidden from clients). */
function PipelineBadge({ pipeline, t }) {
  if (!pipeline) return null
  const status = pipeline.status || 'queued'
  const style =
    status === 'failed'
      ? 'bg-red-50 text-red-700 border-red-200'
      : status === 'ready'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-sky-50 text-sky-700 border-sky-200'
  const label =
    status === 'running' && pipeline.stage
      ? t('pipelineRunning', { stage: pipeline.stage })
      : t(`pipelineStatus.${status}`, { default: status })
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize ${style}`}>
      {label}
    </span>
  )
}

function money(amountCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((amountCents || 0) / 100)
}

function displayName(item, t) {
  const full = [item?.firstName, item?.lastName].filter(Boolean).join(' ').trim()
  return full || item?.email || t('unknownUser')
}

function EmptyState({ title, text }) {
  return (
    <div className="dashboard-empty-state p-8">
      <p className="font-semibold text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  )
}

export default function AdminPanelPage({ user, onViewCloudItem, activeTab }) {
  const t = useTranslations('Admin.panel')
  const tErrors = useTranslations('Errors')
  const tCommon = useTranslations('Admin.common')
  const router = useRouter()
  const { adminWorkspace, loadAdminTab, refreshAdminTab, patchAdminWorkspace } = useApp()
  const { assessments, payments, users, loading: resourceLoading, error: workspaceError } = adminWorkspace
  const [deletingId, setDeletingId] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [openingId, setOpeningId] = useState('')
  const [error, setError] = useState('')
  const [reportFilter, setReportFilter] = useState('all')
  const [confirmState, setConfirmState] = useState(null)

  const canLoad = !!user && user.role === 'admin' && isBackendApiEnabled()
  const tabResources = resourcesForAdminTab(activeTab)
  const loading = isAdminResourceLoading(resourceLoading, tabResources)

  const changeTab = (tab) => {
    if (!ADMIN_TABS.includes(tab)) return
    persistAdminTab(tab)
    router.push(adminTabToPath(tab))
  }

  useEffect(() => {
    if (activeTab && ADMIN_TABS.includes(activeTab)) {
      persistAdminTab(activeTab)
    }
  }, [activeTab])

  useEffect(() => {
    if (!canLoad || !activeTab) return
    loadAdminTab(activeTab)
  }, [activeTab, canLoad, loadAdminTab])

  useEffect(() => {
    if (workspaceError) setError(translateApiError({ message: workspaceError, code: workspaceError }, tErrors))
  }, [workspaceError, tErrors])

  const handleRefresh = () => {
    if (!canLoad || !activeTab) return
    refreshAdminTab(activeTab)
  }

  useEffect(() => {
    if (activeTab === 'settings') {
      router.replace(adminTabToPath('overview'))
    }
  }, [activeTab])

  const userById = useMemo(() => Object.fromEntries(users.map((item) => [item.id, item])), [users])

  const visibleAssessments = assessments

  const reportCountByUser = useMemo(() => {
    const counts = {}
    visibleAssessments.forEach((item) => {
      const uid = item.userId
      if (!uid) return
      counts[uid] = (counts[uid] || 0) + 1
    })
    return counts
  }, [visibleAssessments])

  const reportStats = useMemo(() => {
    const stats = { total: visibleAssessments.length, pending_review: 0, approved: 0 }
    visibleAssessments.forEach((item) => {
      const status = normalizeReportStatus(item.status)
      stats[status] += 1
    })
    return stats
  }, [visibleAssessments])

  const processingCount = useMemo(
    () => visibleAssessments.filter((item) => isAssessmentProcessing(item)).length,
    [visibleAssessments],
  )

  const readyForReviewCount = useMemo(
    () => visibleAssessments.filter(
      (item) => normalizeReportStatus(item.status) === 'pending_review' && !isAssessmentProcessing(item),
    ).length,
    [visibleAssessments],
  )

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return visibleAssessments
    return visibleAssessments.filter((item) => normalizeReportStatus(item.status) === reportFilter)
  }, [visibleAssessments, reportFilter])

  const paidCount = payments.filter((payment) =>
    ['paid', 'complete', 'completed'].includes(String(payment.status).toLowerCase())
  ).length

  const clientUsers = users.filter((item) => item.role !== 'admin')

  const handleStatusChange = async (assessmentId, status) => {
    setUpdatingId(assessmentId)
    setError('')
    try {
      const updated = await updateAssessmentStatus(assessmentId, status)
      patchAdminWorkspace({
        assessments: assessments.map((item) => (item.id === assessmentId ? { ...item, ...updated, id: assessmentId } : item)),
      })
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setUpdatingId('')
    }
  }

  const handleDeleteAssessment = (assessmentId) => {
    setConfirmState({
      title: t('confirm.deleteReportTitle'),
      message: t('confirm.deleteReportMessage'),
      confirmLabel: t('confirm.deleteReportLabel'),
      danger: true,
      onConfirm: async () => {
        setDeletingId(assessmentId)
        setError('')
        try {
          await deleteAssessment(assessmentId)
          patchAdminWorkspace({
            assessments: assessments.filter((item) => item.id !== assessmentId),
          })
        } catch (err) {
          setError(translateApiError(err, tErrors))
        } finally {
          setDeletingId('')
          setConfirmState(null)
        }
      },
    })
  }

  const handleDeleteUser = (targetUser) => {
    if (targetUser.id === user?.id) {
      setError(t('errors.cannotDeleteSelf'))
      return
    }
    setConfirmState({
      title: t('confirm.deleteUserTitle'),
      message: t('confirm.deleteUserMessage', { name: displayName(targetUser, t), email: targetUser.email }),
      confirmLabel: t('confirm.deleteUserLabel'),
      danger: true,
      onConfirm: async () => {
        setDeletingId(targetUser.id)
        setError('')
        try {
          await deleteAdminUser(targetUser.id)
          patchAdminWorkspace({
            users: users.filter((item) => item.id !== targetUser.id),
            assessments: assessments.filter((item) => item.userId !== targetUser.id),
            payments: payments.filter((item) => item.userId !== targetUser.id),
          })
        } catch (err) {
          setError(translateApiError(err, tErrors))
        } finally {
          setDeletingId('')
          setConfirmState(null)
        }
      },
    })
  }

  const handleApprove = (assessment) => {
    setConfirmState({
      title: t('confirm.approveTitle'),
      message: t('confirm.approveMessage'),
      confirmLabel: t('confirm.approveLabel'),
      onConfirm: async () => {
        setConfirmState(null)
        await handleStatusChange(assessment.id, 'approved')
      },
    })
  }

  const renderClientCell = (assessment) => {
    const owner = assessment.userId ? userById[assessment.userId] : null
    if (owner) {
      return (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{displayName(owner, t)}</p>
          <p className="text-xs text-ink-muted truncate">{owner.email}</p>
        </div>
      )
    }
    return <span className="text-xs text-amber-700">{t('unlinkedReport')}</span>
  }

  const handleOpenAssessment = async (assessment) => {
    setOpeningId(assessment.id)
    setError('')
    try {
      const full = await fetchAssessment(assessment.id)
      onViewCloudItem?.(full)
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setOpeningId('')
    }
  }

  const renderReportRow = (assessment, { showStatus = false } = {}) => {
    const score = resolveOverallHarmonyScore(assessment.analysis) ?? '—'
    const normalizedStatus = normalizeReportStatus(assessment.status)
    const refLabel = formatAssessmentRef(assessment)
    const processing = isAssessmentProcessing(assessment)
    return (
      <div key={assessment.id} className="rounded-xl border border-landing-divider bg-white p-4 transition-colors hover:border-brand/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            {renderClientCell(assessment)}
            <div className="flex flex-wrap items-center gap-2">
              {showStatus && <StatusBadge status={assessment.status} t={t} />}
              <PipelineBadge pipeline={assessment.pipeline} t={t} />
            </div>
            <p className="micro-label !normal-case !tracking-normal !text-[11px] text-ink-muted">
              #{refLabel} · {formatHistoryDate(assessment.createdAt)} · {t('scoreLabel', { score })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 lg:justify-end">
            {processing ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" aria-hidden />
                {t('actions.pipelineRunning')}
              </span>
            ) : (
              <>
                {normalizedStatus === 'pending_review' && (
                  <button
                    onClick={() => handleApprove(assessment)}
                    disabled={updatingId === assessment.id}
                    className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    {t('actions.approve')}
                  </button>
                )}
                <button
                  onClick={() => handleOpenAssessment(assessment)}
                  disabled={openingId === assessment.id}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-surface-card border border-surface-border text-xs font-semibold text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50"
                >
                  {openingId === assessment.id ? t('actions.opening') : t('actions.open')}
                </button>
                <button
                  onClick={() => handleDeleteAssessment(assessment.id)}
                  disabled={deletingId === assessment.id}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {deletingId === assessment.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {t('actions.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-surface font-sans text-ink">
      {/* Explicit clear + mint gap under fixed navbar (padding alone was covered by bleed hero/gradients) */}
      <div className="shrink-0 h-[var(--site-navbar-height)]" aria-hidden />
      <div className="shrink-0 h-[var(--site-navbar-gap)] bg-surface" aria-hidden />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-[420px] -z-0"
        style={{
          top: 'var(--site-navbar-offset)',
          background:
            'radial-gradient(900px 360px at 12% 0%, rgba(94, 159, 139, 0.14), transparent 58%), radial-gradient(700px 280px at 88% 0%, rgba(255, 255, 255, 0.5), transparent 55%)',
        }}
      />

      <section className="relative z-10 dashboard-hero-band dashboard-hero-band--bleed surface-grain">
        <div className="relative z-10 flex w-full flex-col gap-6 px-4 py-7 sm:px-6 sm:py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <span className="dashboard-icon-well h-11 w-11">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="micro-label !text-brand mb-1">{t('eyebrow')}</p>
              <h1 className="font-serif text-[32px] sm:text-[36px] leading-tight tracking-tight text-ink">
                {t('title')}
              </h1>
              <p className="text-sm text-ink-secondary mt-1">{t('subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !canLoad}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/70 bg-white/60 px-4 py-2.5 text-xs font-semibold text-ink-secondary backdrop-blur-md transition-colors hover:bg-white/90 hover:text-brand disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('refresh')}
          </button>
        </div>
      </section>

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pb-24 pt-6 space-y-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState title={t('empty.backendRequiredTitle')} text={t('empty.backendRequiredText')} />
        ) : !user || user.role !== 'admin' ? (
          <EmptyState title={t('empty.adminRequiredTitle')} text={t('empty.adminRequiredText')} />
        ) : loading && assessments.length === 0 ? (
          <div className="py-16 text-center">
            <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
            <p className="text-sm text-ink-muted">{t('loadingWorkspace')}</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    ['users', clientUsers.length, Users],
                    ['reports', reportStats.total, FileText],
                    ['pendingReview', reportStats.pending_review, ShieldCheck],
                    ['approved', reportStats.approved, BarChart3],
                    ['payments', paidCount, CreditCard],
                  ].map(([key, value, Icon]) => (
                    <div key={key} className="dashboard-card flex flex-col gap-3">
                      <span className="dashboard-icon-well-stat self-start">
                        <Icon className="w-4 h-4 text-brand" aria-hidden />
                      </span>
                      <div>
                        <p className="micro-label">{t(`stats.${key}`)}</p>
                        <p className="mt-1 text-[28px] font-semibold tracking-tight tabular-nums text-ink">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {(processingCount > 0 || readyForReviewCount > 0) && (
                  <div className="space-y-3">
                    {processingCount > 0 && (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-sky-800 font-medium">{t('processingBanner', { count: processingCount })}</p>
                      </div>
                    )}
                    {readyForReviewCount > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <p className="text-sm text-amber-800 font-medium">{t('pendingBanner', { count: readyForReviewCount })}</p>
                        <button type="button" onClick={() => changeTab('review')} className="btn-primary text-sm">{t('reviewReports')}</button>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid lg:grid-cols-2 gap-6">
                  <section className="dashboard-panel p-5 sm:p-6">
                    <h2 className="micro-label !text-brand mb-4">{t('recentClients')}</h2>
                    <div className="space-y-2">
                      {clientUsers.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-landing-divider bg-white px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink truncate">{displayName(item, t)}</p>
                            <p className="text-xs text-ink-muted truncate">{item.email}</p>
                          </div>
                          <span className="text-xs font-medium text-ink-muted shrink-0">{t('reportCount', { count: reportCountByUser[item.id] || 0 })}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="dashboard-panel p-5 sm:p-6">
                    <h2 className="micro-label !text-brand mb-4">{t('latestReports')}</h2>
                    <div className="space-y-3">
                      {visibleAssessments.slice(0, 5).map((assessment) => renderReportRow(assessment, { showStatus: true }))}
                    </div>
                  </section>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <section className="dashboard-panel overflow-hidden">
                <div className="px-5 py-4 sm:px-6 border-b border-landing-divider flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-ink tracking-tight">{t('users.title')}</h2>
                    <p className="text-xs text-ink-muted mt-0.5">{t('users.subtitle', { count: users.length })}</p>
                  </div>
                </div>
                {users.length === 0 ? (
                  <div className="p-8"><EmptyState title={t('users.emptyTitle')} text={t('users.emptyText')} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-warm dark:bg-surface-raised text-left text-xs text-ink-muted">
                        <tr>
                          <th className="px-5 py-3 font-semibold">{t('users.columns.name')}</th>
                          <th className="px-5 py-3 font-semibold">{t('users.columns.email')}</th>
                          <th className="px-5 py-3 font-semibold">{t('users.columns.role')}</th>
                          <th className="px-5 py-3 font-semibold">{t('users.columns.reports')}</th>
                          <th className="px-5 py-3 font-semibold">{t('users.columns.joined')}</th>
                          <th className="px-5 py-3 font-semibold text-right">{t('users.columns.actions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((item) => (
                          <tr key={item.id} className="border-t border-surface-border">
                            <td className="px-5 py-3 font-medium text-ink">{displayName(item, t)}</td>
                            <td className="px-5 py-3 text-ink-secondary">{item.email}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase ${
                                item.role === 'admin'
                                  ? 'bg-brand-50 text-brand border-brand/20'
                                  : 'bg-surface-warm text-ink-muted border-surface-border'
                              }`}>
                                {item.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
                              </span>
                            </td>
                            <td className="px-5 py-3">{reportCountByUser[item.id] || 0}</td>
                            <td className="px-5 py-3 text-ink-muted">{formatHistoryDate(item.createdAt)}</td>
                            <td className="px-5 py-3 text-right">
                              {item.role !== 'admin' && (
                                <button
                                  onClick={() => handleDeleteUser(item)}
                                  disabled={deletingId === item.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                  {t('actions.delete')}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'review' && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink tracking-tight">{t('review.title')}</h2>
                  <p className="text-xs text-ink-muted mt-0.5">{t('review.subtitle')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['all', ...REPORT_WORKFLOW_STATUSES.map((s) => s.value)].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setReportFilter(filter)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold capitalize transition-colors ${
                        reportFilter === filter
                          ? 'bg-brand text-white border-brand shadow-brand'
                          : 'bg-white border-landing-divider text-ink-secondary hover:border-brand/30 hover:text-brand'
                      }`}
                    >
                      {filter === 'all' ? t('filters.all') : t(`status.${filter === 'pending_review' ? 'pendingReview' : filter}`)}
                    </button>
                  ))}
                </div>
                {filteredReports.length === 0 ? (
                  <EmptyState title={t('review.emptyTitle')} text={t('review.emptyText')} />
                ) : (
                  <div className="space-y-3">
                    {filteredReports.map((assessment) => renderReportRow(assessment, { showStatus: reportFilter === 'all' }))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'payments' && (
              <section className="dashboard-panel overflow-hidden">
                <div className="px-5 py-4 sm:px-6 border-b border-landing-divider">
                  <h2 className="text-lg font-semibold text-ink tracking-tight">{t('payments.title')}</h2>
                  <p className="text-xs text-ink-muted mt-0.5">{t('payments.subtitle')}</p>
                </div>
                {payments.length === 0 ? (
                  <div className="p-8"><EmptyState title={t('payments.emptyTitle')} text={t('payments.emptyText')} /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-warm dark:bg-surface-raised text-left text-xs text-ink-muted">
                        <tr>
                          <th className="px-5 py-3 font-semibold">{t('payments.columns.client')}</th>
                          <th className="px-5 py-3 font-semibold">{t('payments.columns.provider')}</th>
                          <th className="px-5 py-3 font-semibold">{t('payments.columns.amount')}</th>
                          <th className="px-5 py-3 font-semibold">{t('payments.columns.status')}</th>
                          <th className="px-5 py-3 font-semibold">{t('payments.columns.date')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-t border-surface-border">
                            <td className="px-5 py-3">
                              <p className="font-medium text-ink">{displayName(userById[payment.userId], t)}</p>
                              <p className="text-xs text-ink-muted">{userById[payment.userId]?.email || payment.userId || '—'}</p>
                            </td>
                            <td className="px-5 py-3 capitalize">{payment.provider}</td>
                            <td className="px-5 py-3 font-display font-semibold text-brand">{money(payment.amountCents, payment.currency)}</td>
                            <td className="px-5 py-3"><StatusBadge status={payment.status} t={t} /></td>
                            <td className="px-5 py-3 text-ink-muted">{formatHistoryDate(payment.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

          </>
        )}
      </main>
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel || tCommon('confirm')}
        danger={confirmState?.danger}
        loading={!!deletingId}
        onConfirm={() => confirmState?.onConfirm?.()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
