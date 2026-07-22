'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CreditCard, Loader2, RefreshCw, Wallet } from 'lucide-react'
import {
  createPayPalOrder,
  createStripeCheckout,
  fetchMyPayments,
  fetchPaymentConfig,
  isBackendApiEnabled,
} from '../utils/apiClient'
import { formatHistoryDate } from '../utils/historyStorage'
import { trackEvent } from '../utils/analytics'

const STATUS_STYLE = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-amber-50 text-amber-700 border-amber-200',
  created: 'bg-surface-warm text-ink-muted border-surface-border',
}

function money(amountCents, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format((amountCents || 0) / 100)
}

function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase()
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${STATUS_STYLE[normalized] || STATUS_STYLE.created}`}>
      {normalized}
    </span>
  )
}

function ProviderButton({ provider, configured, loading, onClick, t }) {
  const Icon = provider === 'stripe' ? CreditCard : Wallet
  const label = provider === 'stripe' ? t('payWithStripe') : t('payWithPayPal')
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!configured || loading}
      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-dark shadow-brand transition-colors disabled:opacity-50 disabled:pointer-events-none w-full"
      title={!configured ? t('providerNotConfigured', { provider }) : label}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  )
}

export default function BillingPage({ user, message = '', embedded = false }) {
  const t = useTranslations('Billing')
  const [config, setConfig] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const nextConfig = await fetchPaymentConfig()
      setConfig(nextConfig)
      if (user && isBackendApiEnabled()) {
        setPayments(await fetchMyPayments(20))
      }
    } catch (err) {
      setError(err.message || t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user?.id])

  const product = config?.product

  const startStripe = async () => {
    setBusy('stripe')
    setError('')
    trackEvent('checkout_start', { provider: 'stripe', planId: product?.id || 'myface_report' })
    try {
      const result = await createStripeCheckout()
      if (result.checkoutUrl) window.location.href = result.checkoutUrl
    } catch (err) {
      setError(err.message || t('stripeCheckoutFailed'))
      setBusy('')
    }
  }

  const startPayPal = async () => {
    setBusy('paypal')
    setError('')
    trackEvent('checkout_start', { provider: 'paypal', planId: product?.id || 'myface_report' })
    try {
      const result = await createPayPalOrder()
      if (result.approveUrl) window.location.href = result.approveUrl
    } catch (err) {
      setError(err.message || t('paypalCheckoutFailed'))
      setBusy('')
    }
  }

  const needsBackend = !isBackendApiEnabled()

  const content = (
    <>
        {embedded && (
          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-surface-border text-ink-secondary hover:text-brand transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {t('refresh')}
            </button>
          </div>
        )}
        {error && (
          <div className={`${embedded ? 'mb-4' : 'mb-4'} rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700`}>
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {message}
          </div>
        )}

        {needsBackend ? (
          <div className={`${embedded ? '' : 'bg-white dark:bg-surface-card rounded-2xl p-6 sm:p-8 text-center shadow-card border border-surface-border'}`}>
            <p className="text-ink mb-1">{t('backendRequiredTitle')}</p>
            <p className="text-sm text-ink-muted font-sans">{t('backendRequiredText')}</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${embedded ? 'xl:grid-cols-2' : 'lg:grid-cols-[1fr_1.2fr]'} gap-4 sm:gap-6`}>
            <div className="bg-white dark:bg-surface-card rounded-2xl p-5 sm:p-6 shadow-card border border-surface-border">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-sans font-semibold mb-3">
                {t('currentProduct')}
              </p>
              <h2 className="text-xl font-semibold text-ink mb-2">{product?.name || t('defaultProductName')}</h2>
              <p className="text-sm text-ink-muted leading-relaxed mb-5">{product?.description || t('defaultProductDesc')}</p>
              <div className="text-3xl font-bold text-brand mb-5">
                {money(product?.amountCents || 0, product?.currency || 'usd')}
              </div>
              <div className="grid gap-3">
                <ProviderButton
                  provider="stripe"
                  configured={!!config?.stripe?.configured}
                  loading={busy === 'stripe'}
                  onClick={startStripe}
                  t={t}
                />
                <ProviderButton
                  provider="paypal"
                  configured={!!config?.paypal?.configured}
                  loading={busy === 'paypal'}
                  onClick={startPayPal}
                  t={t}
                />
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-ink-muted">
                <div className="rounded-xl bg-surface-warm border border-surface-border p-3">
                  {t('stripeLabel')}: {config?.stripe?.configured ? t('stripeConfigured') : t('stripeMissingKeys')}
                </div>
                <div className="rounded-xl bg-surface-warm border border-surface-border p-3">
                  {t('paypalLabel')}: {config?.paypal?.configured ? t('paypalConfigured') : t('paypalMissingKeys')}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-card rounded-2xl p-5 sm:p-6 shadow-card border border-surface-border">
              <div className="flex items-center justify-between mb-4 gap-2">
                <p className="text-[10px] uppercase tracking-wider text-ink-muted font-sans font-semibold">
                  {t('recentPayments')}
                </p>
                <span className="text-xs text-ink-muted shrink-0">{t('records', { count: payments.length })}</span>
              </div>
              {loading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">{t('loadingPayments')}</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-surface-border rounded-2xl px-4">
                  <p className="text-ink mb-1">{t('noPaymentsTitle')}</p>
                  <p className="text-sm text-ink-muted">{t('noPaymentsText')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{t('payments')}</p>
                          <p className="text-xs text-ink-muted">{formatHistoryDate(payment.createdAt)}</p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-sm font-bold text-brand">
                            {money(payment.amountCents, payment.currency)}
                          </p>
                          <StatusBadge status={payment.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
    </>
  )

  if (embedded) return content

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 pb-8 site-navbar-offset font-sans bg-surface">
      <div className="w-full">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 pt-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="dashboard-icon-well" aria-hidden>
              <CreditCard className="w-5 h-5 text-brand" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">{t('title')}</h1>
              <p className="text-sm text-ink-muted font-sans">{t('subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border border-surface-border bg-white dark:bg-surface-card text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('refresh')}
          </button>
        </div>
        {content}
      </div>
    </div>
  )
}
