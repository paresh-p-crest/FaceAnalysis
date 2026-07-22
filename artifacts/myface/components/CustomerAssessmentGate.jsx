'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Sparkles, CreditCard, Upload } from 'lucide-react'
import AnalysisPreparing from './analysis/AnalysisPreparing'
import { fetchMyAssessmentDraft, fetchMyAssessments, isBackendApiEnabled } from '../utils/apiClient'
import { isAssessmentSubmitted, userReportReady } from '../utils/reportWorkflow'
import { translateApiError } from '../utils/translateApiError'
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../utils/withTimeout'

const PREP_WINDOW_DAYS = 28

export function remainingPrepDays(createdAt, totalDays = PREP_WINDOW_DAYS) {
  if (!createdAt) return totalDays
  const createdMs = new Date(createdAt).getTime()
  if (!Number.isFinite(createdMs)) return totalDays
  const elapsed = Math.floor((Date.now() - createdMs) / 86400000)
  return Math.max(0, totalDays - elapsed)
}

/**
 * Shared customer gates: billing, draft, start CTA, preparing, ready.
 * `children(latest)` renders when the latest submitted assessment is report-ready.
 */
export function CustomerAssessmentGate({
  user,
  hasAnalysisAccess,
  accessReady,
  onStartAssessment,
  onResumeDraft,
  onStartCheckout,
  billingMessage = '',
  loadingLabel,
  children,
}) {
  const t = useTranslations('Home')
  const tErrors = useTranslations('Errors')
  const loadingMessage = loadingLabel ?? t('loadingDashboard')
  const [submittedItems, setSubmittedItems] = useState([])
  const [draftItem, setDraftItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const billingLocked = accessReady && !hasAnalysisAccess

  const load = useCallback(async (isCancelled) => {
    const cancelled = typeof isCancelled === 'function' ? isCancelled : () => false
    if (!user || !isBackendApiEnabled()) {
      if (!cancelled()) {
        setSubmittedItems([])
        setDraftItem(null)
        setLoading(false)
      }
      return
    }
    if (!cancelled()) {
      setLoading(true)
      setError('')
    }
    try {
      const [list, draft] = await withTimeout(
        Promise.all([fetchMyAssessments(20), fetchMyAssessmentDraft()]),
        DEFAULT_FETCH_TIMEOUT_MS,
        'Dashboard load timed out',
      )
      if (cancelled()) return
      const submitted = (Array.isArray(list) ? list : []).filter(isAssessmentSubmitted)
      setSubmittedItems(submitted)
      setDraftItem(draft)
    } catch (err) {
      if (cancelled()) return
      setError(translateApiError(err, tErrors))
      setSubmittedItems([])
      setDraftItem(null)
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }, [user, tErrors])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const latest = submittedItems[0] || null
  const latestReady = latest && userReportReady(latest)

  const daysLeft = useMemo(
    () => remainingPrepDays(latest?.createdAt, PREP_WINDOW_DAYS),
    [latest?.createdAt],
  )

  const handleCheckout = useCallback(async () => {
    if (!onStartCheckout || checkoutBusy) return
    setCheckoutBusy(true)
    setCheckoutError('')
    try {
      await onStartCheckout()
    } catch (err) {
      setCheckoutError(err?.message || t('checkoutFailed'))
      setCheckoutBusy(false)
    }
  }, [onStartCheckout, checkoutBusy, t])

  if (!accessReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface">
        <div className="text-center">
          <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
          <p className="text-sm text-ink-muted">{loadingMessage}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  if (billingLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-lg w-full rounded-3xl border border-brand/30 bg-white p-8 text-center shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">
            {t('billingEyebrow')}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-2">
            {t('billingTitle')}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-6">
            {t('billingDesc')}
          </p>
          {(billingMessage || checkoutError) && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 text-left">
              {checkoutError || billingMessage}
            </div>
          )}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkoutBusy}
            className="btn-primary disabled:opacity-50"
          >
            {checkoutBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {checkoutBusy ? t('checkoutBusy') : t('billingCta')}
          </button>
        </div>
      </div>
    )
  }

  if (!latest && draftItem) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-lg w-full rounded-3xl border border-surface-border bg-white p-8 sm:p-10 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand/30 bg-brand/5">
            <Upload className="h-6 w-6 text-brand" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-2">
            {t('continueTitle')}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-6 max-w-md mx-auto">
            {t('continueDesc')}
          </p>
          <button type="button" onClick={() => onResumeDraft?.(draftItem)} className="btn-primary">
            <Upload className="w-4 h-4" />
            {t('continueCta')}
          </button>
        </div>
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-lg w-full rounded-3xl border border-surface-border bg-white p-8 sm:p-10 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand/30 bg-brand/5">
            <Sparkles className="h-6 w-6 text-brand" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-2">
            {t('startTitle')}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-6 max-w-md mx-auto">
            {t('startDesc')}
          </p>
          <button type="button" onClick={onStartAssessment} className="btn-primary">
            <Sparkles className="w-4 h-4" />
            {t('startCta')}
          </button>
        </div>
      </div>
    )
  }

  if (latestReady) {
    return children(latest)
  }

  return (
    <AnalysisPreparing
      photo={null}
      createdAt={latest.createdAt}
      daysLeft={daysLeft}
      totalDays={PREP_WINDOW_DAYS}
      variant="home"
      onRefresh={load}
    />
  )
}
