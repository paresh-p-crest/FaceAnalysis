'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, CreditCard, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { confirmStripeCheckout, fetchMyPayments } from '../utils/apiClient'
import { isPaidPaymentStatus } from '../utils/paymentAccess'

function isPaidStatus(status) {
  return isPaidPaymentStatus(status)
}

export default function PaymentSuccessPage({
  user,
  sessionId,
  onAuth,
  onStartAnalysis,
  onRetryCheckout,
  onAccessRefresh,
  onPaymentConfirmed,
}) {
  const t = useTranslations('Billing')
  const [status, setStatus] = useState(sessionId ? 'confirming' : 'checking')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) {
      setStatus(sessionId ? 'confirming' : 'checking')
      return
    }

    let cancelled = false

    const applyPaidState = () => {
      if (!cancelled) {
        setStatus('confirmed')
        setError('')
        onAccessRefresh?.()
        onPaymentConfirmed?.()
      }
    }

    const checkExistingPayments = async () => {
      try {
        const payments = await fetchMyPayments(20)
        if (!cancelled && payments.some((payment) => isPaidStatus(payment.status))) {
          applyPaidState()
          return true
        }
      } catch {
        // ignore
      }
      return false
    }

    if (!sessionId) {
      checkExistingPayments().then((paid) => {
        if (!cancelled && !paid) setStatus('pending')
      })
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      setStatus('confirming')
      setError('')
      try {
        const result = await confirmStripeCheckout(sessionId)
        if (!cancelled && isPaidStatus(result?.payment?.status)) {
          applyPaidState()
          return
        }
        const paid = await checkExistingPayments()
        if (!cancelled) {
          if (paid) return
          setStatus('pending')
          setError(t('processingMessage'))
        }
      } catch (err) {
        const paid = await checkExistingPayments()
        if (!cancelled) {
          if (paid) return
          setStatus('error')
          setError(err.message || t('confirmFailed'))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, sessionId, t, onAccessRefresh, onPaymentConfirmed])

  const canStart = status === 'confirmed' && !!user
  const isBusy = status === 'confirming' || status === 'checking'

  return (
    <div
      className="bg-surface overflow-hidden flex flex-col font-sans"
      style={{
        height: '100dvh',
        paddingTop: 'var(--site-navbar-offset)',
      }}
    >
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md rounded-3xl border border-brand/25 bg-white p-8 sm:p-10 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand/30 bg-brand/5">
            {isBusy ? (
              <Loader2 className="w-6 h-6 text-brand animate-spin" />
            ) : (
              <CheckCircle2 className="w-7 h-7 text-brand" strokeWidth={2} />
            )}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand mb-2">
            {t('paymentSuccessTitle')}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink tracking-tight mb-2">
            {canStart ? t('readyForAnalysisTitle') : t('paymentSuccessTitle')}
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed mb-6 max-w-sm mx-auto">
            {t('paymentSuccessDesc')}
          </p>

          {!user ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-left">
              <p className="text-sm font-semibold text-amber-800 mb-0.5">{t('signInRequiredTitle')}</p>
              <p className="text-xs text-amber-700 leading-relaxed">{t('signInRequiredDesc')}</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6 text-left">
              <p className="text-sm font-semibold text-amber-800 mb-0.5">{t('confirmationPendingTitle')}</p>
              <p className="text-xs text-amber-700 leading-relaxed">{error}</p>
            </div>
          ) : canStart ? (
            <p className="text-xs text-ink-muted mb-6 leading-relaxed">
              {t('readyForAnalysisDesc')}
            </p>
          ) : isBusy ? (
            <p className="text-xs text-ink-muted mb-6">{t('processingMessage')}</p>
          ) : null}

          <div className="flex flex-col gap-2.5">
            {!user ? (
              <button type="button" onClick={onAuth} className="btn-primary w-full">
                <CreditCard className="w-4 h-4" />
                {t('signIn')}
              </button>
            ) : canStart ? (
              <button type="button" onClick={onStartAnalysis} className="btn-primary w-full">
                <Sparkles className="w-4 h-4" />
                {t('startFaceAnalysis')}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-ghost w-full"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('refreshStatus')}
                </button>
                {onRetryCheckout ? (
                  <button type="button" onClick={onRetryCheckout} className="btn-primary w-full">
                    <CreditCard className="w-4 h-4" />
                    {t('retryCheckout')}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
