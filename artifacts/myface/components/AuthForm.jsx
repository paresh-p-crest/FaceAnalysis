'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, Lock, UserPlus } from 'lucide-react'
import { login, register } from '../utils/authClient'

export default function AuthForm({ onAuthenticated, className = '' }) {
  const t = useTranslations('Auth')
  const [mode, setMode] = useState('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    <form
      onSubmit={handleSubmit}
      className={`w-full max-w-md bg-white dark:bg-surface-card rounded-3xl p-6 sm:p-8 shadow-modal border border-surface-border animate-scale-in ${className}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          {isRegister ? <UserPlus className="w-5 h-5 text-brand" /> : <Lock className="w-5 h-5 text-brand" />}
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold text-ink">
            {isRegister ? t('createAccount') : t('signIn')}
          </h1>
          <p className="text-xs text-ink-muted mt-1">
            {isRegister ? t('defaultRoleUser') : t('continueWithAccount')}
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border mb-5">
        {[
          ['login', t('signIn')],
          ['register', t('signUp')],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); setError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
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
            <input
              type="text"
              autoComplete="given-name"
              placeholder={t('firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="input-field"
              required
            />
            <input
              type="text"
              autoComplete="family-name"
              placeholder={t('lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="input-field"
              required
            />
          </div>
        )}
        <input
          type="email"
          autoComplete="email"
          placeholder={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          placeholder={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          minLength={8}
          required
        />
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={busy} className="btn-primary w-full text-sm mt-6">
        {busy ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> {t('working')}</>
        ) : (
          <><CheckCircle2 className="w-4 h-4" /> {isRegister ? t('signUp') : t('signIn')}</>
        )}
      </button>
    </form>
  )
}
