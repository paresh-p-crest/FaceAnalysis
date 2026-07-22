'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { History, Trash2, ScanFace, ShieldCheck, Loader2, RefreshCw } from 'lucide-react'
import { formatHistoryDate } from '../utils/historyStorage'
import {
  deleteAssessment,
  fetchMyAssessments,
  isBackendApiEnabled,
} from '../utils/apiClient'
import { formatAssessmentRef, resolveOverallHarmonyScore } from '../utils/qovesProtocolModel'
import { isReportApproved, userReportReady } from '../utils/reportWorkflow'

const STATUS_STYLE = {
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

function StatusBadge({ item, readyLabel, inPreparationLabel }) {
  const ready = userReportReady(item)
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${ready ? STATUS_STYLE.approved : STATUS_STYLE.pending_review}`}>
      {ready ? readyLabel : inPreparationLabel}
    </span>
  )
}

/** Analysis History — cloud assessments only (no localStorage report list). */
export default function HistoryPage({ onViewCloudItem, onOpenAdmin, user, openingReportId = null }) {
  const t = useTranslations('History')
  const [cloudItems, setCloudItems] = useState([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const isAdmin = user?.role === 'admin'
  const canLoadCloud = !!user && !isAdmin && isBackendApiEnabled()

  const loadCloudItems = async () => {
    if (!canLoadCloud) return
    setCloudLoading(true)
    setCloudError('')
    try {
      setCloudItems(await fetchMyAssessments(20))
    } catch (err) {
      setCloudError(err.message || t('loadFailed'))
    } finally {
      setCloudLoading(false)
    }
  }

  useEffect(() => {
    loadCloudItems()
  }, [user?.id])

  const handleDeleteCloudItem = async (assessmentId) => {
    if (!window.confirm(t('confirmDeleteCloud'))) return
    setDeletingId(assessmentId)
    setCloudError('')
    try {
      await deleteAssessment(assessmentId)
      setCloudItems((prev) => prev.filter((item) => item.id !== assessmentId))
    } catch (err) {
      setCloudError(err.message || t('deleteFailed'))
    } finally {
      setDeletingId('')
    }
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 pb-8 site-navbar-offset font-sans bg-surface">
      <div className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="dashboard-icon-well" aria-hidden>
              <History className="w-5 h-5 text-brand" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">{t('title')}</h1>
              <p className="text-sm text-ink-muted font-sans">
                {canLoadCloud
                  ? t('savedResults', { count: cloudItems.length })
                  : t('cloudReportsDesc')}
              </p>
            </div>
          </div>
          {canLoadCloud && (
            <button
              type="button"
              onClick={loadCloudItems}
              disabled={cloudLoading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border border-surface-border bg-white dark:bg-surface-card text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              {cloudLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {t('refresh')}
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="mb-8 sm:mb-10 bg-white dark:bg-surface-card rounded-2xl p-6 sm:p-8 shadow-card border border-surface-border text-center">
            <ShieldCheck className="w-10 h-10 text-brand mx-auto mb-3" />
            <p className="text-ink mb-1">{t('adminToolsTitle')}</p>
            <p className="text-sm text-ink-muted font-sans mb-4">
              {t('adminToolsDesc')}
            </p>
            <button type="button" onClick={onOpenAdmin} className="btn-primary text-sm w-full sm:w-auto">
              {t('openDashboard')}
            </button>
          </div>
        )}

        {!isAdmin && !isBackendApiEnabled() && (
          <div className="bg-white dark:bg-surface-card rounded-3xl p-10 sm:p-16 text-center shadow-card border border-surface-border">
            <ScanFace className="w-12 h-12 text-ink-faint mx-auto mb-4" />
            <p className="text-ink mb-2">{t('noAnalysesTitle')}</p>
            <p className="text-sm text-ink-muted font-sans">{t('noAnalysesDesc')}</p>
          </div>
        )}

        {canLoadCloud && (
          <>
            {cloudError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {cloudError}
              </div>
            )}

            {cloudLoading && cloudItems.length === 0 ? (
              <div className="bg-white dark:bg-surface-card rounded-2xl p-8 text-center shadow-card border border-surface-border">
                <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
                <p className="text-sm text-ink-muted">{t('loadingReports')}</p>
              </div>
            ) : cloudItems.length === 0 ? (
              <div className="bg-white dark:bg-surface-card rounded-3xl p-10 sm:p-16 text-center shadow-card border border-surface-border">
                <ScanFace className="w-12 h-12 text-ink-faint mx-auto mb-4" />
                <p className="text-ink mb-2">{t('noCloudReportsTitle')}</p>
                <p className="text-sm text-ink-muted font-sans">{t('noCloudReportsDesc')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cloudItems.map((item) => {
                  const approved = isReportApproved(item.status)
                  const ready = userReportReady(item)
                  const score = approved ? resolveOverallHarmonyScore(item.analysis) : null
                  const refLabel = formatAssessmentRef(item)
                  return (
                    <div key={item.id} className="bg-white dark:bg-surface-card rounded-2xl p-4 shadow-card border border-surface-border">
                      <div className="flex flex-col gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-ink font-mono tracking-tight">
                              #{refLabel}
                            </p>
                            <StatusBadge item={item} readyLabel={t('ready')} inPreparationLabel={t('inPreparation')} />
                          </div>
                          <p className="text-xs text-ink-muted">
                            {formatHistoryDate(item.createdAt)}
                            {approved && score != null
                              ? t('scoreLine', { score })
                              : ` · ${t('awaitingReview')}`}
                          </p>
                        </div>

                        <p className="text-xs text-ink-muted">
                          {isReportApproved(item.status)
                            ? t('approvedPdfAvailable')
                            : t('awaitingReviewMessage')}
                        </p>

                        <div className="flex flex-col xs:flex-row gap-2 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => onViewCloudItem?.(item)}
                            disabled={openingReportId === item.id || !ready}
                            className="flex-1 sm:flex-none px-3 py-2.5 rounded-lg border border-surface-border bg-white dark:bg-surface-card text-xs font-semibold text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-60"
                          >
                            {openingReportId === item.id ? (
                              <span className="inline-flex items-center justify-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                {t('opening')}
                              </span>
                            ) : !ready ? (
                              t('inPreparation')
                            ) : (
                              t('viewReport')
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCloudItem(item.id)}
                            disabled={deletingId === item.id}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 flex-1 sm:flex-none"
                          >
                            {deletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
