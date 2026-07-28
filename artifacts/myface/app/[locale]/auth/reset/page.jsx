'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useRouter } from '../../../i18n/navigation'
import { resetPassword } from '../../../utils/authClient'
import { BrandLogo } from '../../../components/BrandLogo'
import { LocaleSwitcher } from '../../../components/LocaleSwitcher'
import { AppBootScreen } from '../../../components/AppBootScreen'
import { useApp } from '../../../components/providers/AppProvider'
import { ROUTES } from '../../../utils/routes'

export default function ResetPasswordPage() {
  const t = useTranslations('Auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, authReady } = useApp()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!authReady) return
    if (user) {
      router.replace(ROUTES.dashboard)
    }
  }, [authReady, user, router])

  if (!authReady) {
    return <AppBootScreen withNavbarOffset={false} />
  }

  if (user) {
    return <AppBootScreen withNavbarOffset={false} />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!token) {
      setError(t('resetMissingToken'))
      return
    }
    if (newPassword.length < 8) {
      setError(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }
    setBusy(true)
    try {
      await resetPassword({ token, newPassword })
      setSuccess(true)
    } catch (err) {
      setError(err.message || t('resetFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-card dark:bg-surface">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LocaleSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="flex justify-center">
            <BrandLogo size="lg" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">{t('resetPageTitle')}</h1>
            <p className="text-sm text-ink-muted mt-2">{t('resetPageDesc')}</p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {t('resetSuccess')}
              </div>
              <button
                type="button"
                onClick={() => router.replace(ROUTES.auth)}
                className="btn-primary w-full text-sm"
              >
                {t('backToSignIn')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {t('newPassword')}
                </span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field pr-11"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  {t('confirmNewPassword')}
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field"
                  minLength={8}
                  required
                />
              </label>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('resetPasswordCta')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
