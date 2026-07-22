'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Loader2, Upload } from 'lucide-react'
import { Link, useRouter } from '../../i18n/navigation'
import { fetchMyAssessmentDraft, fetchMyAssessments, isBackendApiEnabled } from '../../utils/apiClient'
import {
  canStartNewAssessment,
  countSubmittedAssessments,
  isAnalysisLimitReached,
  MAX_SUBMITTED_ASSESSMENTS_PER_PACKAGE,
} from '../../utils/assessmentEligibility'
import { adminTabToPath } from '../../utils/adminPanel'
import { isAssessmentSubmitted } from '../../utils/reportWorkflow'
import { ROUTES } from '../../utils/routes'
import { translateApiError } from '../../utils/translateApiError'
import { withTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../../utils/withTimeout'

export function AnalysisEligibilityGate({
  user,
  hasAnalysisAccess,
  accessReady,
  onResumeDraft,
  onStartCheckout,
  billingMessage = '',
  children,
}) {
  const router = useRouter()
  const t = useTranslations('Home')
  const tLimit = useTranslations('AnalysisLimit')
  const tErrors = useTranslations('Errors')
  const [submittedCount, setSubmittedCount] = useState(0)
  const [draftItem, setDraftItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')

  const billingLocked = accessReady && !hasAnalysisAccess
  const limitReached = isAnalysisLimitReached({ user, submittedCount })

  useEffect(() => {
    if (user?.role === 'admin') {
      router.replace(adminTabToPath('overview'))
    }
  }, [user, router])

  const load = useCallback(async (isCancelled) => {
    const cancelled = typeof isCancelled === 'function' ? isCancelled : () => false
    if (!user || user.role === 'admin' || !isBackendApiEnabled()) {
      if (!cancelled()) {
        setSubmittedCount(0)
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
        'Analysis eligibility load timed out',
      )
      if (cancelled()) return
      const submitted = (Array.isArray(list) ? list : []).filter(isAssessmentSubmitted)
      setSubmittedCount(countSubmittedAssessments(submitted))
      setDraftItem(draft)
    } catch (err) {
      if (cancelled()) return
      setError(translateApiError(err, tErrors))
      setSubmittedCount(0)
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

  if (!user || user.role === 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-7 h-7 text-brand animate-spin" />
      </div>
    )
  }

  if (!accessReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
          <p className="text-sm text-ink-muted">{t('loadingDashboard')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button type="button" onClick={() => load(false)} className="btn-primary text-sm">
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  if (billingLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
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

  if (limitReached) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
        <div className="max-w-lg w-full rounded-3xl border border-surface-border bg-white p-8 sm:p-10 text-center shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
            {tLimit('eyebrow')}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-3">
            {tLimit('title')}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-8 max-w-md mx-auto">
            {tLimit('description', {
              limit: MAX_SUBMITTED_ASSESSMENTS_PER_PACKAGE,
              count: submittedCount,
            })}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={ROUTES.report} className="btn-primary w-full sm:w-auto">
              {tLimit('reportCta')}
            </Link>
            <Link
              href={ROUTES.dashboard}
              className="text-sm font-medium text-ink-muted hover:text-brand transition-colors"
            >
              {tLimit('dashboardCta')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (draftItem && canStartNewAssessment({ user, submittedCount })) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface px-4">
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

  return children
}
