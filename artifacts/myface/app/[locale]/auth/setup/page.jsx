'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useRouter } from '../../../../i18n/navigation'
import { setPasswordAfterImport, validateSetupToken } from '../../../../utils/authClient'
import { BrandLogo } from '../../../../components/BrandLogo'
import { LocaleSwitcher } from '../../../../components/LocaleSwitcher'
import { AppBootScreen } from '../../../../components/AppBootScreen'
import { useApp } from '../../../../components/providers/AppProvider'
import { ROUTES } from '../../../../utils/routes'

const SETUP_TOKEN_STORAGE_KEY = 'myface_auth_setup_token'

function SetupPageShell({ children, contentClassName = '' }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-surface-card dark:bg-surface p-6">
      <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
        <LocaleSwitcher />
      </div>
      <div className={`w-full max-w-md space-y-6 ${contentClassName}`}>
        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>
        {children}
      </div>
    </div>
  )
}

export default function SetupPasswordPage() {
  const t = useTranslations('Auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, authReady } = useApp()
  const [token, setToken] = useState('')
  const [tokenStatus, setTokenStatus] = useState('pending')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const setupCheckDoneRef = useRef(false)

  useEffect(() => {
    // replaceState drops ?token= and re-triggers searchParams — never re-run after resolve.
    if (setupCheckDoneRef.current) return

    const fromUrl = (searchParams.get('token') || '').trim()
    if (fromUrl) {
      try {
        sessionStorage.setItem(SETUP_TOKEN_STORAGE_KEY, fromUrl)
      } catch {
        // sessionStorage unavailable — token stays in React state only
      }
    }

    let stored = ''
    try {
      stored = sessionStorage.getItem(SETUP_TOKEN_STORAGE_KEY) || ''
    } catch {
      stored = ''
    }
    const raw = fromUrl || stored
    if (!raw) {
      setupCheckDoneRef.current = true
      setTokenStatus('invalid')
      return
    }

    setupCheckDoneRef.current = true
    setToken(raw)

    validateSetupToken(raw)
      .then(() => {
        setTokenStatus('valid')
        try {
          sessionStorage.removeItem(SETUP_TOKEN_STORAGE_KEY)
        } catch {
          // ignore
        }
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname)
        }
      })
      .catch(() => {
        try {
          sessionStorage.removeItem(SETUP_TOKEN_STORAGE_KEY)
        } catch {
          // ignore
        }
        setTokenStatus('invalid')
      })
  }, [searchParams])

  useEffect(() => {
    if (!authReady) return
    if (user) {
      router.replace(ROUTES.dashboard)
    }
  }, [authReady, user, router])

  if (!authReady || tokenStatus === 'pending') {
    return <AppBootScreen withNavbarOffset={false} />
  }

  if (user) {
    return <AppBootScreen withNavbarOffset={false} />
  }

  if (tokenStatus === 'invalid') {
    return (
      <SetupPageShell contentClassName="text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('setupMissingToken')}
        </div>
        <button
          type="button"
          onClick={() => router.replace(ROUTES.auth)}
          className="btn-primary mx-auto inline-flex px-8 text-sm"
        >
          {t('backToSignIn')}
        </button>
      </SetupPageShell>
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
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
      await setPasswordAfterImport({ token, newPassword })
      router.replace(ROUTES.dashboard)
    } catch (err) {
      setError(err.message || t('setupFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SetupPageShell>
      <div>
        <h1 className="font-display text-3xl font-bold text-ink">{t('setupPageTitle')}</h1>
        <p className="text-sm text-ink-muted mt-2">{t('setupPageDesc')}</p>
      </div>

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
          {t('setupPasswordCta')}
        </button>
      </form>
    </SetupPageShell>
  )
}
