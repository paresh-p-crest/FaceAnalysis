'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { History, Loader2, RefreshCw, X } from 'lucide-react'
import { formatHistoryDate } from '../../utils/historyStorage'
import { fetchAdminAssessments, fetchMyAssessments, isBackendApiEnabled } from '../../utils/apiClient'
import { formatAssessmentRef, resolveOverallHarmonyScore } from '../../utils/qovesProtocolModel'
import { isReportApproved, userReportReady } from '../../utils/reportWorkflow'

function StatusPill({ ready, readyLabel, pendingLabel }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${
        ready ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {ready ? readyLabel : pendingLabel}
    </span>
  )
}

/** Overlay list of past assessments — opens on top of the current report. */
export function PastAssessmentsPanel({
  open,
  onClose,
  onSelect,
  user,
  currentAssessmentId = null,
  openingReportId = null,
}) {
  const t = useTranslations('History')
  const tReport = useTranslations('Report')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin'

  const loadItems = async () => {
    if (!user || !isBackendApiEnabled()) return
    setLoading(true)
    setError('')
    try {
      const next = isAdmin ? await fetchAdminAssessments(30) : await fetchMyAssessments(30)
      setItems(Array.isArray(next) ? next : [])
    } catch (err) {
      setError(err.message || t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    loadItems()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, user?.id, isAdmin])

  if (!open) return null

  return (
    <div className="past-assessments-overlay" role="dialog" aria-modal="true" aria-labelledby="past-assessments-title">
      <button type="button" className="past-assessments-backdrop" onClick={onClose} aria-label={tReport('shell.closePastAssessments')} />
      <div className="past-assessments-sheet">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-brand shrink-0" aria-hidden />
            <div className="min-w-0">
              <h2 id="past-assessments-title" className="text-sm font-semibold text-ink truncate">
                {tReport('nav.pastAssessments')}
              </h2>
              <p className="text-[11px] text-ink-muted truncate">{t('cloudReportsDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-ink-muted hover:text-brand hover:bg-surface-warm transition-colors disabled:opacity-50"
              title={t('refresh')}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-ink-muted hover:text-ink hover:bg-surface-warm transition-colors"
              aria-label={tReport('shell.closePastAssessments')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="past-assessments-scroll px-3 py-3">
          {!isBackendApiEnabled() ? (
            <p className="text-sm text-ink-muted text-center py-8 px-4">{t('noAnalysesDesc')}</p>
          ) : error ? (
            <p className="text-xs text-red-600 rounded-xl border border-red-200 bg-red-50 px-3 py-2">{error}</p>
          ) : loading && items.length === 0 ? (
            <div className="py-12 text-center">
              <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-2" />
              <p className="text-sm text-ink-muted">{t('loadingReports')}</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-8 px-4">{t('noCloudReportsDesc')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const ready = userReportReady(item)
                const approved = isReportApproved(item.status)
                const score = approved ? resolveOverallHarmonyScore(item.analysis) : null
                const refLabel = formatAssessmentRef(item)
                const isCurrent = currentAssessmentId && item.id === currentAssessmentId
                const isOpening = openingReportId === item.id

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!ready || isOpening}
                      onClick={() => onSelect?.(item)}
                      className={`past-assessments-row w-full text-left ${isCurrent ? 'past-assessments-row--current' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink font-mono tracking-tight truncate">
                            #{refLabel}
                            {isCurrent ? (
                              <span className="ml-2 text-[10px] font-sans font-medium text-brand normal-case">
                                {tReport('shell.currentReport')}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-ink-muted mt-0.5 truncate">
                            {formatHistoryDate(item.createdAt)}
                            {approved && score != null ? t('scoreLine', { score }) : ''}
                          </p>
                        </div>
                        <StatusPill
                          ready={ready}
                          readyLabel={t('ready')}
                          pendingLabel={t('inPreparation')}
                        />
                      </div>
                      {isOpening ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-brand mt-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {t('opening')}
                        </span>
                      ) : !ready ? (
                        <p className="text-[11px] text-ink-muted mt-2">{t('awaitingReviewMessage')}</p>
                      ) : (
                        <p className="text-[11px] text-brand mt-2">{t('viewReport')}</p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
