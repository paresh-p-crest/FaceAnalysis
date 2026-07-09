import { useEffect, useState } from 'react'
import { CreditCard, ChevronLeft, Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react'
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

function ProviderButton({ provider, configured, loading, onClick }) {
  const Icon = provider === 'stripe' ? CreditCard : Wallet
  const label = provider === 'stripe' ? 'Pay with Stripe' : 'Pay with PayPal'
  return (
    <button
      onClick={onClick}
      disabled={!configured || loading}
      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-dark shadow-brand transition-colors disabled:opacity-50 disabled:pointer-events-none"
      title={!configured ? `${provider} is not configured in backend environment` : label}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  )
}

export default function BillingPage({ user, onBack, onAuth, message = '' }) {
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
      setError(err.message || 'Could not load billing')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [user?.id])

  const startStripe = async () => {
    setBusy('stripe')
    setError('')
    trackEvent('checkout_start', { provider: 'stripe', planId: product?.id || 'myface_report' })
    try {
      const result = await createStripeCheckout()
      if (result.checkoutUrl) window.location.href = result.checkoutUrl
    } catch (err) {
      setError(err.message || 'Stripe checkout failed')
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
      setError(err.message || 'PayPal checkout failed')
      setBusy('')
    }
  }

  const product = config?.product
  const needsBackend = !isBackendApiEnabled()

  return (
    <div className="min-h-screen px-6 py-12 pt-20 animate-fade-up font-sans bg-surface">
      <div className="max-w-4xl mx-auto pt-12">
        <button onClick={onBack} className="btn-ghost text-sm mb-8">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">Billing</h1>
              <p className="text-sm text-ink-muted font-sans">Premium report payment collection</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-surface-border bg-white dark:bg-surface-card text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {message}
          </div>
        )}

        {needsBackend ? (
          <div className="bg-white dark:bg-surface-card rounded-2xl p-8 text-center shadow-card border border-surface-border">
            <p className="font-display text-ink mb-1">Backend API required</p>
            <p className="text-sm text-ink-muted font-sans">Set `NEXT_PUBLIC_API_URL` to use payment collection.</p>
          </div>
        ) : !user ? (
          <div className="bg-white dark:bg-surface-card rounded-2xl p-8 text-center shadow-card border border-surface-border">
            <ShieldCheck className="w-10 h-10 text-brand mx-auto mb-3" />
            <p className="font-display text-ink mb-1">Sign in to continue</p>
            <p className="text-sm text-ink-muted font-sans mb-4">Payments are linked to your MyFace account.</p>
            <button onClick={onAuth} className="btn-primary text-sm">Sign in</button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
            <div className="bg-white dark:bg-surface-card rounded-2xl p-6 shadow-card border border-surface-border">
              <p className="text-[10px] uppercase tracking-wider text-ink-muted font-sans font-semibold mb-3">
                Current Product
              </p>
              <h2 className="font-display text-xl font-semibold text-ink mb-2">{product?.name || 'MyFace Premium Report'}</h2>
              <p className="text-sm text-ink-muted leading-relaxed mb-5">{product?.description || 'Full report workflow access.'}</p>
              <div className="text-3xl font-display font-bold text-brand mb-5">
                {money(product?.amountCents || 0, product?.currency || 'usd')}
              </div>
              <div className="grid gap-3">
                <ProviderButton
                  provider="stripe"
                  configured={!!config?.stripe?.configured}
                  loading={busy === 'stripe'}
                  onClick={startStripe}
                />
                <ProviderButton
                  provider="paypal"
                  configured={!!config?.paypal?.configured}
                  loading={busy === 'paypal'}
                  onClick={startPayPal}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-ink-muted">
                <div className="rounded-xl bg-surface-warm border border-surface-border p-3">
                  Stripe: {config?.stripe?.configured ? 'configured' : 'missing keys'}
                </div>
                <div className="rounded-xl bg-surface-warm border border-surface-border p-3">
                  PayPal: {config?.paypal?.configured ? 'configured' : 'missing keys'}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-surface-card rounded-2xl p-6 shadow-card border border-surface-border">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] uppercase tracking-wider text-ink-muted font-sans font-semibold">
                  Recent Payments
                </p>
                <span className="text-xs text-ink-muted">{payments.length} records</span>
              </div>
              {loading ? (
                <div className="py-10 text-center">
                  <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto mb-3" />
                  <p className="text-sm text-ink-muted">Loading payments...</p>
                </div>
              ) : payments.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-surface-border rounded-2xl">
                  <p className="font-display text-ink mb-1">No payments yet</p>
                  <p className="text-sm text-ink-muted">Completed checkouts will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink capitalize">{payment.provider}</p>
                          <p className="text-xs text-ink-muted">{formatHistoryDate(payment.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-display font-bold text-brand">
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
      </div>
    </div>
  )
}
