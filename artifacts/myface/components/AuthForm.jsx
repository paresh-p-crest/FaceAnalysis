'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import { login, register, resetPassword } from '../utils/authClient'
import { BrandLogo } from './BrandLogo'
import { LocaleSwitcher } from './LocaleSwitcher'

function ForgotPasswordModal({ open, initialEmail = '', onClose, t }) {
  const [email, setEmail] = useState(initialEmail)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail(initialEmail || '')
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setBusy(false)
    setError('')
    setSuccess(false)
  }, [open, initialEmail])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

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
      await resetPassword({ email, newPassword })
      setSuccess(true)
    } catch (err) {
      setError(err.message || t('resetFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={busy ? undefined : onClose}
        aria-label={t('closeDialog')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        className="relative w-full max-w-md rounded-2xl border border-surface-border bg-white dark:bg-surface-card shadow-elevated p-6"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="forgot-password-title" className="font-display text-lg font-semibold text-ink">
              {t('forgotPasswordTitle')}
            </h2>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">
              {t('forgotPasswordDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-warm transition-colors disabled:opacity-50"
            aria-label={t('closeDialog')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {t('resetSuccess')}
            </div>
            <button type="button" onClick={onClose} className="btn-primary w-full text-sm">
              {t('backToSignIn')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {t('email')}
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
            </label>
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

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl border border-surface-border text-sm font-semibold text-ink-secondary hover:text-ink transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('resetPasswordCta')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function AuthForm({ onAuthenticated }) {
  const t = useTranslations('Auth')
  const [mode, setMode] = useState('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  const isRegister = mode === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const user = isRegister
        ? await register({ firstName, lastName, email, password })
        : await login(email, password)
      onAuthenticated(user)
    } catch (err) {
      setError(err.message || t('authFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-surface-card dark:bg-surface animate-fade-up">
      {/* Left: brand panel (questionnaire mesh) */}
      <div className="hidden lg:flex lg:w-[60%] bg-[#0d1e1f] fluid-gradient-mesh flex-col justify-between p-16 relative">
        <div className="relative z-10">
          <BrandLogo size="xl" invert />
        </div>

        <div className="space-y-6 max-w-xl text-left relative z-10">
          <div className="inline-block px-3 py-1 rounded-full border border-white/20 text-white/80 text-[10px] uppercase tracking-wider bg-white/5 backdrop-blur-md">
            {t('sidebarBadge')}
          </div>
          <h1 className="font-display text-5xl font-bold text-white tracking-tight leading-tight whitespace-pre-line">
            {isRegister ? t('sidebarTitleSignUp') : t('sidebarTitleSignIn')}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            {isRegister ? t('sidebarDescriptionSignUp') : t('sidebarDescriptionSignIn')}
          </p>
        </div>
      </div>

      {/* Right: form panel */}
      <div className="w-full lg:w-[40%] flex flex-col justify-between p-6 sm:p-12 lg:p-16 bg-surface-card dark:bg-surface border-l border-surface-border relative">
        <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
          <LocaleSwitcher />
        </div>

        <div className="lg:hidden mb-8">
          <BrandLogo size="lg" />
        </div>

        <form onSubmit={handleSubmit} className="my-auto w-full max-w-md mx-auto space-y-6 py-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink leading-tight tracking-tight">
              {isRegister ? t('createAccount') : t('signIn')}
            </h1>
            <p className="text-ink-muted text-sm leading-relaxed mt-3">
              {isRegister ? t('signUpSubtitle') : t('signInSubtitle')}
            </p>
          </div>

          <div className="flex gap-1 p-1 rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border">
            {[
              ['login', t('signIn')],
              ['register', t('signUp')],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => { setMode(id); setError('') }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mode === id
                    ? 'bg-white dark:bg-surface-card text-brand shadow-soft border border-surface-border'
                    : 'text-ink-muted hover:text-ink-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {isRegister && (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    {t('firstName')}
                  </span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-field"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    {t('lastName')}
                  </span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-field"
                    required
                  />
                </label>
              </div>
            )}
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {t('email')}
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
            </label>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label
                  htmlFor="auth-password"
                  className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
                >
                  {t('password')}
                </label>
                {!isRegister && (
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="w-fit shrink-0 p-0 text-[10px] font-semibold uppercase tracking-wider text-brand hover:underline"
                  >
                    {t('forgotPassword')}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full flex items-center px-6 py-4 text-sm disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="flex-1 text-left">{t('working')}</span>
              </>
            ) : (
              <>
                <span className="flex-1 text-left">{isRegister ? t('signUp') : t('signIn')}</span>
                <span className="text-white/40 mr-4">|</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-ink-muted text-center mt-4">
          {isRegister ? t('switchToSignInHint') : t('switchToSignUpHint')}
        </p>
      </div>

      <ForgotPasswordModal
        open={forgotOpen}
        initialEmail={email}
        onClose={() => setForgotOpen(false)}
        t={t}
      />
    </div>
  )
}
