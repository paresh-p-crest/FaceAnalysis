'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '../i18n/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import {
  deleteAssessment,
  deleteAdminUser,
  isBackendApiEnabled,
  retryAssessmentPipeline,
  updateAssessmentStatus,
} from '../utils/apiClient'
import { resolveAssessmentFrontPhoto } from '../utils/assessmentPhotos'
import { useMediaUrl } from '../utils/useMediaUrl'
import RetryPipelineModal from './admin/RetryPipelineModal'
import { ADMIN_TABS, adminTabToPath, persistAdminTab } from '../utils/adminPanel'
import { ADMIN_LIST_PAGE_SIZE, isAdminResourceLoading, resourcesForAdminTab } from '../utils/adminWorkspace'
import { formatHistoryDate } from '../utils/historyStorage'
import { formatAssessmentRef, resolveOverallHarmonyScore } from '../utils/reportProtocolModel'
import { isAssessmentProcessing, normalizeReportStatus, REPORT_WORKFLOW_STATUSES } from '../utils/reportWorkflow'
import { isPipelineFailed } from '../utils/pipelineStatus'
import { translateApiError } from '../utils/translateApiError'
import ConfirmDialog from './ConfirmDialog'
import { useApp } from './providers/AppProvider'

const STATUS_STYLE = {
  draft: 'admin-status-pill admin-status-pill--muted',
  pending_review: 'admin-status-pill admin-status-pill--amber',
  approved: 'admin-status-pill admin-status-pill--mint',
  paid: 'admin-status-pill admin-status-pill--mint',
  completed: 'admin-status-pill admin-status-pill--mint',
  pending: 'admin-status-pill admin-status-pill--amber',
  created: 'admin-status-pill admin-status-pill--muted',
}

function StatusBadge({ status, t }) {
  const display = normalizeReportStatus(status)
  const label = display === 'pending_review' ? t('status.pendingReview') : t(`status.${display}`)
  return (
    <span className={STATUS_STYLE[display] || STATUS_STYLE.created}>
      {label}
    </span>
  )
}

/** Admin-only live pipeline indicator. Ready is omitted (mixed signal with pending review). */
function PipelineBadge({ pipeline, t }) {
  if (!pipeline) return null
  const status = pipeline.status || 'queued'
  if (status === 'ready') return null
  const style =
    status === 'failed'
      ? 'admin-status-pill admin-status-pill--danger admin-status-pill--loud'
      : 'admin-status-pill admin-status-pill--sky admin-status-pill--loud'
  const label =
    status === 'running' && pipeline.stage
      ? t('pipelineRunning', { stage: pipeline.stage })
      : t(`pipelineStatus.${status}`, { default: status })
  return (
    <span className={`${style} capitalize`}>
      {label}
    </span>
  )
}

function AdminThumb({ url, fallback }) {
  const src = useMediaUrl(url)
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return <span className="admin-avatar" aria-hidden>{fallback}</span>
  }
  return (
    <img
      src={src}
      alt=""
      className="admin-avatar admin-avatar--photo"
      onError={() => setBroken(true)}
    />
  )
}

function displayName(item, t) {
  const full = [item?.firstName, item?.lastName].filter(Boolean).join(' ').trim()
  return full || item?.email || t('unknownUser')
}

function initials(item, t) {
  const name = displayName(item, t)
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0] || '?').slice(0, 2).toUpperCase()
}

function EmptyState({ title, text, className = '' }) {
  return (
    <div className={`admin-empty ${className}`}>
      <p className="font-semibold text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  )
}

/** Stable icon slot — avoid swapping lucide roots mid-commit (insertBefore NotFoundError). */
function BusyIcon({ busy, IdleIcon }) {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <Loader2
        className={`absolute h-3.5 w-3.5 animate-spin ${busy ? 'opacity-100' : 'opacity-0'}`}
        aria-hidden={!busy}
      />
      <IdleIcon
        className={`absolute h-3.5 w-3.5 ${busy ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden={busy}
      />
    </span>
  )
}

function formatSyncedLabel(syncedAt, t, _tick = 0) {
  if (!syncedAt) return t('sync.never')
  const seconds = Math.max(0, Math.round((Date.now() - syncedAt.getTime()) / 1000))
  if (seconds < 45) return t('sync.justNow')
  if (seconds < 3600) return t('sync.minutesAgo', { count: Math.max(1, Math.round(seconds / 60)) })
  return t('sync.hoursAgo', { count: Math.max(1, Math.round(seconds / 3600)) })
}

function AdminPager({ page, pageSize, total, onPageChange, t, disabled }) {
  const safeTotal = Math.max(0, Number(total) || 0)
  if (safeTotal <= 0) return null
  const pages = Math.max(1, Math.ceil(safeTotal / pageSize))
  const from = page * pageSize + 1
  const to = Math.min(safeTotal, (page + 1) * pageSize)
  return (
    <div className="admin-pager">
      <p className="admin-pager__meta">{t('pagination.showing', { from, to, total: safeTotal })}</p>
      <div className="admin-pager__controls">
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          disabled={disabled || page <= 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          {t('pagination.prev')}
        </button>
        <span className="admin-pager__page">{t('pagination.page', { page: page + 1, pages })}</span>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          disabled={disabled || page + 1 >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('pagination.next')}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function AdminCommandBar({ title, loading, canLoad, syncedLabel, onRefresh, t }) {
  return (
    <header className="admin-command-bar">
      <div className="admin-command-bar__left">
        <h1 className="admin-command-bar__title">{title}</h1>
      </div>
      <div className="admin-command-bar__right">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || !canLoad}
          className="admin-btn admin-btn--ghost"
        >
          <BusyIcon busy={loading} IdleIcon={RefreshCw} />
          {t('refresh')}
        </button>
        <span className="admin-command-bar__sync">{syncedLabel}</span>
      </div>
    </header>
  )
}

function AdminOverviewSkeleton() {
  return (
    <div className="admin-overview admin-fade-in" aria-hidden>
      <div className="admin-metrics">
        <div className="admin-priority-card admin-skel" />
        <div className="admin-metric-stack">
          <div className="admin-metric-readout admin-skel" />
          <div className="admin-metric-readout admin-skel" />
          <div className="admin-metric-readout admin-skel" />
        </div>
      </div>
      <div className="admin-worklist admin-panel-tier-1">
        <div className="admin-worklist__header">
          <div className="admin-skel admin-skel--line w-40 h-4" />
        </div>
        <div className="admin-worklist__body space-y-2 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="admin-worklist-row admin-skel h-16" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AdminPanelPage({ user, onViewCloudItem, activeTab }) {
  const t = useTranslations('Admin.panel')
  const tPipeline = useTranslations('Admin.pipeline')
  const tErrors = useTranslations('Errors')
  const tCommon = useTranslations('Admin.common')
  const router = useRouter()
  const { adminWorkspace, loadAdminTab, refreshAdminTab, patchAdminWorkspace, afterAssessmentDeleted, openingReportId } = useApp()
  const { assessments, payments, users, assessmentsTotal = 0, usersTotal = 0, loading: resourceLoading, error: workspaceError } = adminWorkspace
  const [deletingId, setDeletingId] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [retryingId, setRetryingId] = useState('')
  const [retryModalAssessment, setRetryModalAssessment] = useState(null)
  const [error, setError] = useState('')
  const [reportFilter, setReportFilter] = useState('all')
  const [usersPage, setUsersPage] = useState(0)
  const [reportsPage, setReportsPage] = useState(0)
  const [confirmState, setConfirmState] = useState(null)
  const [syncedAt, setSyncedAt] = useState(null)
  const [syncTick, setSyncTick] = useState(0)
  const [worklistTab, setWorklistTab] = useState(null)
  const wasLoadingRef = useRef(false)

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

  const pagingOpts = useMemo(() => ({
    usersOffset: activeTab === 'users' ? usersPage * ADMIN_LIST_PAGE_SIZE : 0,
    assessmentsOffset: activeTab === 'review' ? reportsPage * ADMIN_LIST_PAGE_SIZE : 0,
    assessmentStatus: activeTab === 'review' && reportFilter !== 'all' ? reportFilter : undefined,
  }), [activeTab, usersPage, reportsPage, reportFilter])

  useEffect(() => {
    if (!canLoad || !activeTab) return
    loadAdminTab(activeTab, pagingOpts)
  }, [activeTab, canLoad, loadAdminTab, pagingOpts])

  useEffect(() => {
    if (workspaceError) setError(translateApiError({ message: workspaceError, code: workspaceError }, tErrors))
  }, [workspaceError, tErrors])

  useEffect(() => {
    if (wasLoadingRef.current && !loading && canLoad) {
      setSyncedAt(new Date())
    } else if (!loading && canLoad && !syncedAt) {
      setSyncedAt(new Date())
    }
    wasLoadingRef.current = loading
  }, [loading, canLoad, syncedAt])

  useEffect(() => {
    if (!syncedAt) return undefined
    const id = setInterval(() => setSyncTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [syncedAt])

  const handleRefresh = () => {
    if (!canLoad || !activeTab) return
    refreshAdminTab(activeTab, pagingOpts)
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

  const filteredReports = visibleAssessments

  const clientUsers = users.filter((item) => item.role !== 'admin')

  const resolvedWorklistTab = worklistTab
    ?? (readyForReviewCount > 0 ? 'reports' : 'clients')

  const pageTitle =
    activeTab === 'users'
      ? t('commandBarTitleUsers')
      : activeTab === 'review'
        ? t('commandBarTitleReview')
        : t('commandBarTitle')

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
            assessmentsTotal: Math.max(0, assessmentsTotal - 1),
          })
          await afterAssessmentDeleted?.(assessmentId)
        } catch (err) {
          setError(translateApiError(err, tErrors))
        } finally {
          setDeletingId('')
          // Defer close so ConfirmDialog spinner opacity settles before unmount.
          queueMicrotask(() => setConfirmState(null))
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
            usersTotal: Math.max(0, usersTotal - 1),
            assessments: assessments.filter((item) => item.userId !== targetUser.id),
            assessmentsTotal: Math.max(0, assessmentsTotal - (targetUser.assessmentCount || 0)),
            payments: payments.filter((item) => item.userId !== targetUser.id),
          })
        } catch (err) {
          setError(translateApiError(err, tErrors))
        } finally {
          setDeletingId('')
          queueMicrotask(() => setConfirmState(null))
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

  const handleRetryConfirm = async (mode) => {
    const assessment = retryModalAssessment
    if (!assessment) return
    setRetryingId(assessment.id)
    setError('')
    try {
      const updated = await retryAssessmentPipeline(assessment.id, { mode })
      patchAdminWorkspace({
        assessments: assessments.map((item) => (item.id === assessment.id ? { ...item, ...updated, id: assessment.id } : item)),
      })
      setRetryModalAssessment(null)
    } catch (err) {
      setError(translateApiError(err, tErrors))
    } finally {
      setRetryingId('')
    }
  }

  const handleOpenAssessment = (assessment) => {
    setError('')
    // Do not pre-fetch here — viewCloudAssessment sets openingReportId
    // immediately, then fetches. A prior await hid "Opening…" for seconds.
    onViewCloudItem?.(assessment)
  }

  const renderReportActions = (assessment) => {
    const normalizedStatus = normalizeReportStatus(assessment.status)
    const processing = isAssessmentProcessing(assessment)
    const isDraft = normalizedStatus === 'draft'
    const failed = isPipelineFailed(assessment.pipeline)
    const pending = normalizedStatus === 'pending_review'

    if (processing) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-ink-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" aria-hidden />
          {t('actions.pipelineRunning')}
        </span>
      )
    }
    if (isDraft) {
      return (
        <p className="admin-draft-note">
          {t('draftNotSubmitted')}
        </p>
      )
    }
    if (failed) {
      return (
        <>
          <button
            type="button"
            onClick={() => setRetryModalAssessment(assessment)}
            disabled={retryingId === assessment.id}
            className="admin-btn admin-btn--primary"
          >
            <BusyIcon busy={retryingId === assessment.id} IdleIcon={RotateCcw} />
            {t('actions.retry')}
          </button>
          <button
            type="button"
            onClick={() => handleDeleteAssessment(assessment.id)}
            disabled={deletingId === assessment.id}
            className="admin-btn admin-btn--danger-quiet"
            aria-label={t('actions.delete')}
          >
            <BusyIcon busy={deletingId === assessment.id} IdleIcon={Trash2} />
          </button>
        </>
      )
    }
    return (
      <>
        <button
          type="button"
          onClick={() => handleOpenAssessment(assessment)}
          disabled={openingReportId === assessment.id}
          className={pending ? 'admin-btn admin-btn--secondary' : 'admin-btn admin-btn--primary'}
        >
          {openingReportId === assessment.id ? t('actions.opening') : t('actions.open')}
        </button>
        {pending && (
          <button
            type="button"
            onClick={() => handleApprove(assessment)}
            disabled={updatingId === assessment.id}
            className="admin-btn admin-btn--primary"
          >
            {t('actions.approve')}
          </button>
        )}
        <button
          type="button"
          onClick={() => handleDeleteAssessment(assessment.id)}
          disabled={deletingId === assessment.id}
          className="admin-btn admin-btn--danger-quiet"
          aria-label={t('actions.delete')}
        >
          <BusyIcon busy={deletingId === assessment.id} IdleIcon={Trash2} />
        </button>
      </>
    )
  }

  const renderReportRow = (assessment, { showStatus = false } = {}) => {
    const rawScore = resolveOverallHarmonyScore(assessment.analysis)
    const hasScore = rawScore != null && Number.isFinite(Number(rawScore))
    const score = hasScore ? rawScore : null
    const refLabel = formatAssessmentRef(assessment)
    const owner = assessment.userId ? userById[assessment.userId] : null
    const thumb = resolveAssessmentFrontPhoto(assessment)
    return (
      <div
        key={assessment.id}
        className={`admin-worklist-row admin-row-tier-2 admin-worklist-row--tracks${hasScore ? '' : ' admin-worklist-row--no-score'}`}
      >
        <div className="admin-worklist-row__identity-track">
          <div className="admin-worklist-row__identity">
            <AdminThumb
              url={thumb}
              fallback={owner ? initials(owner, t) : '?'}
            />
            <div className="admin-worklist-row__who min-w-0">
              <div className="admin-worklist-row__who-top">
                {owner ? (
                  <p className="admin-worklist-row__name">{displayName(owner, t)}</p>
                ) : (
                  <span className="text-xs text-amber-700">{t('unlinkedReport')}</span>
                )}
                <div className="admin-worklist-row__status-track">
                  {showStatus && <StatusBadge status={assessment.status} t={t} />}
                  <PipelineBadge pipeline={assessment.pipeline} t={t} />
                </div>
              </div>
              {owner?.email && (
                <p className="admin-worklist-row__meta truncate">{owner.email}</p>
              )}
            </div>
          </div>
          <p className="admin-worklist-row__meta admin-worklist-row__meta--indent">
            <span className="admin-worklist-row__ref">#{refLabel}</span>
            <span aria-hidden> · </span>
            <span>{formatHistoryDate(assessment.createdAt)}</span>
          </p>
        </div>
        {hasScore && (
          <div className="admin-worklist-row__score-track" title={t('scoreLabel', { score })}>
            <span className="admin-worklist-row__score-label">{t('scoreColumn')}</span>
            <span className="admin-worklist-row__score-value">{score}</span>
          </div>
        )}
        <div className="admin-worklist-row__actions">
          {renderReportActions(assessment)}
        </div>
      </div>
    )
  }

  const showSkeleton = loading && assessments.length === 0 && users.length === 0

  return (
    <div className="admin-shell relative min-h-screen font-sans text-ink">
      {/* Clear fixed navbar only — no --site-navbar-gap (that seam read as a hole). */}
      <div className="shrink-0 h-[var(--site-navbar-height)]" aria-hidden />

      <div aria-hidden className="admin-ambient-bloom" />

      <div className="relative z-10 sticky top-[var(--site-navbar-height)]">
        <AdminCommandBar
          title={pageTitle}
          loading={loading}
          canLoad={canLoad}
          syncedLabel={formatSyncedLabel(syncedAt, t, syncTick)}
          onRefresh={handleRefresh}
          t={t}
        />
      </div>

      <main className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pb-24 pt-3 space-y-5">
        {error && (
          <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!isBackendApiEnabled() ? (
          <EmptyState title={t('empty.backendRequiredTitle')} text={t('empty.backendRequiredText')} />
        ) : !user || user.role !== 'admin' ? (
          <EmptyState title={t('empty.adminRequiredTitle')} text={t('empty.adminRequiredText')} />
        ) : showSkeleton ? (
          <AdminOverviewSkeleton />
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="admin-overview admin-fade-in space-y-4">
                <div className="admin-hero-band admin-metrics">
                  <button
                    type="button"
                    className={`admin-priority-card admin-panel-tier-1 admin-panel-tier-1--strong ${readyForReviewCount > 0 ? 'admin-priority-card--active' : ''}`}
                    onClick={() => changeTab('review')}
                  >
                    <p className="admin-label">{t('stats.pendingReview')}</p>
                    <p className="admin-priority-card__value">{readyForReviewCount}</p>
                    <p className="admin-priority-card__desc">
                      {readyForReviewCount > 0
                        ? t('pendingReviewDescription', { count: readyForReviewCount })
                        : t('queueClear')}
                    </p>
                    {processingCount > 0 && (
                      <p className="admin-priority-card__aside">{t('processingAside', { count: processingCount })}</p>
                    )}
                    <span className="admin-priority-card__cta">{t('viewReviewQueue')}</span>
                  </button>

                  <div className="admin-metric-stack admin-panel-tier-1">
                    {[
                      ['users', usersTotal || clientUsers.length],
                      ['reports', assessmentsTotal || reportStats.total],
                      ['approved', reportStats.approved],
                    ].map(([key, value]) => (
                      <div key={key} className="admin-metric-readout">
                        <span className="admin-metric-readout__value">{value}</span>
                        <span className="admin-label">{t(`stats.${key}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <section className="admin-worklist admin-panel-tier-1">
                  <div className="admin-worklist__header">
                    <div className="admin-segment" role="tablist" aria-label={t('latestReports')}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={resolvedWorklistTab === 'reports'}
                        className={`admin-segment__btn ${resolvedWorklistTab === 'reports' ? 'is-active' : ''}`}
                        onClick={() => setWorklistTab('reports')}
                      >
                        {t('latestReports')}
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={resolvedWorklistTab === 'clients'}
                        className={`admin-segment__btn ${resolvedWorklistTab === 'clients' ? 'is-active' : ''}`}
                        onClick={() => setWorklistTab('clients')}
                      >
                        {t('recentClients')}
                      </button>
                    </div>
                  </div>

                  <div className="admin-worklist__body">
                    {resolvedWorklistTab === 'clients' ? (
                      clientUsers.length === 0 ? (
                        <EmptyState title={t('users.emptyTitle')} text={t('users.emptyText')} />
                      ) : (
                        clientUsers.slice(0, 8).map((item) => (
                          <div key={item.id} className="admin-worklist-row admin-row-tier-2">
                            <div className="admin-worklist-row__identity">
                              <span className="admin-avatar" aria-hidden>{initials(item, t)}</span>
                              <div className="min-w-0">
                                <p className="admin-worklist-row__name">{displayName(item, t)}</p>
                                <p className="admin-worklist-row__meta truncate">{item.email}</p>
                              </div>
                            </div>
                            <span className="admin-worklist-row__aside">
                              {t('reportCount', { count: reportCountByUser[item.id] || 0 })}
                            </span>
                          </div>
                        ))
                      )
                    ) : visibleAssessments.length === 0 ? (
                      <EmptyState title={t('review.emptyTitle')} text={t('empty.noReportsText')} />
                    ) : (
                      visibleAssessments.slice(0, 8).map((assessment) =>
                        renderReportRow(assessment, { showStatus: true }),
                      )
                    )}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'users' && (
              <section className="admin-panel-tier-1 overflow-hidden admin-fade-in">
                {users.length === 0 ? (
                  <EmptyState title={t('users.emptyTitle')} text={t('users.emptyText')} className="m-4" />
                ) : (
                  <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[rgba(4,33,29,0.03)] text-left text-xs text-ink-muted">
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
                          <tr key={item.id} className="border-t border-[var(--admin-border)]">
                            <td className="px-5 py-3 font-medium text-ink">{displayName(item, t)}</td>
                            <td className="px-5 py-3 text-ink-secondary">{item.email}</td>
                            <td className="px-5 py-3">
                              <span className={`admin-status-pill ${
                                item.role === 'admin'
                                  ? 'admin-status-pill--mint'
                                  : 'admin-status-pill--muted'
                              }`}>
                                {item.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
                              </span>
                            </td>
                            <td className="px-5 py-3 tabular-nums">{item.assessmentCount ?? reportCountByUser[item.id] ?? 0}</td>
                            <td className="px-5 py-3 text-ink-muted">{formatHistoryDate(item.createdAt)}</td>
                            <td className="px-5 py-3 text-right">
                              {item.role !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(item)}
                                  disabled={deletingId === item.id}
                                  className="admin-btn admin-btn--danger-quiet"
                                >
                                  <BusyIcon busy={deletingId === item.id} IdleIcon={Trash2} />
                                  {t('actions.delete')}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <AdminPager
                    page={usersPage}
                    pageSize={ADMIN_LIST_PAGE_SIZE}
                    total={usersTotal}
                    onPageChange={setUsersPage}
                    t={t}
                    disabled={loading}
                  />
                  </>
                )}
              </section>
            )}

            {activeTab === 'review' && (
              <section className="space-y-4 admin-fade-in">
                <p className="text-xs text-ink-muted">{t('review.subtitle')}</p>
                <div className="flex flex-wrap gap-2">
                  {['all', ...REPORT_WORKFLOW_STATUSES.map((s) => s.value)].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setReportFilter(filter)
                        setReportsPage(0)
                      }}
                      className={`admin-filter-chip ${reportFilter === filter ? 'is-active' : ''}`}
                    >
                      {filter === 'all' ? t('filters.all') : t(`status.${filter === 'pending_review' ? 'pendingReview' : filter}`)}
                    </button>
                  ))}
                </div>
                {filteredReports.length === 0 ? (
                  <EmptyState title={t('review.emptyTitle')} text={t('review.emptyText')} />
                ) : (
                  <div className="admin-worklist admin-panel-tier-1">
                    <div className="admin-worklist__body">
                      {filteredReports.map((assessment) => renderReportRow(assessment, { showStatus: reportFilter === 'all' }))}
                    </div>
                    <AdminPager
                      page={reportsPage}
                      pageSize={ADMIN_LIST_PAGE_SIZE}
                      total={assessmentsTotal}
                      onPageChange={setReportsPage}
                      t={t}
                      disabled={loading}
                    />
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
      <RetryPipelineModal
        open={!!retryModalAssessment}
        busy={!!retryingId}
        onClose={() => !retryingId && setRetryModalAssessment(null)}
        onConfirm={handleRetryConfirm}
        t={tPipeline}
      />
    </div>
  )
}
