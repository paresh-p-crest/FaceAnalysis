'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, CreditCard, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { confirmStripeCheckout, fetchMyPayments } from '../utils/apiClient'
import { isPaidPaymentStatus } from '../utils/paymentAccess'

function isPaidStatus(status) {
  return isPaidPaymentStatus(status)
}

export default function PaymentSuccessPage({ user, sessionId, onAuth, onStartAnalysis, onBilling, onAccessRefresh }) {
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
  }, [user?.id, sessionId, t, onAccessRefresh])

  const canStart = status === 'confirmed' && !!user

  return (
    <div className="min-h-screen px-6 pb-8 site-navbar-offset animate-fade-up font-sans bg-surface">
      <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-card border border-surface-border text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-5">
            {status === 'confirming' || status === 'checking' ? (
              <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
            ) : (
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            )}
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink mb-2">{t('paymentSuccessTitle')}</h1>
          <p className="text-sm text-ink-muted leading-relaxed mb-6">
            {t('paymentSuccessDesc')}
          </p>

          {!user ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-amber-800 mb-1">{t('signInRequiredTitle')}</p>
              <p className="text-xs text-amber-700">{t('signInRequiredDesc')}</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-amber-800 mb-1">{t('confirmationPendingTitle')}</p>
              <p className="text-xs text-amber-700">{error}</p>
            </div>
          ) : canStart ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-emerald-800 mb-1">{t('readyForAnalysisTitle')}</p>
              <p className="text-xs text-emerald-700">{t('readyForAnalysisDesc')}</p>
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-3">
            {!user ? (
              <button onClick={onAuth} className="btn-primary text-sm sm:col-span-2">
                <CreditCard className="w-4 h-4" />
                {t('signIn')}
              </button>
            ) : (
              <>
                <button
                  onClick={onStartAnalysis}
                  disabled={!canStart}
                  className="btn-primary text-sm disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('startFaceAnalysis')}
                </button>
                <button onClick={onBilling} className="btn-ghost text-sm">
                  {status === 'pending' || status === 'error' ? <RefreshCw className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                  {t('billing')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
