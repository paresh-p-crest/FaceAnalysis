import { useState } from 'react'
import { CheckCircle2, Loader2, Lock, UserPlus, X } from 'lucide-react'
import { login, register } from '../utils/authClient'

export default function AuthModal({ open, onClose, onAuthenticated, required = false }) {
  const [mode, setMode] = useState('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

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
      if (!required) onClose()
    } catch (err) {
      setError(err.message || 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  const handleDismiss = () => {
    if (!required) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={required ? undefined : handleDismiss}
        aria-hidden
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white dark:bg-surface-card rounded-3xl p-6 sm:p-8 shadow-modal border border-surface-border animate-scale-in"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              {isRegister ? <UserPlus className="w-5 h-5 text-brand" /> : <Lock className="w-5 h-5 text-brand" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                {isRegister ? 'Create account' : 'Sign in'}
              </h2>
              <p className="text-xs text-ink-muted mt-1">
                {isRegister ? 'Default role: user' : 'Continue with your MyFace account'}
              </p>
            </div>
          </div>
          {!required && (
            <button type="button" onClick={handleDismiss} className="p-2 rounded-lg hover:bg-surface-warm text-ink-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-surface-warm dark:bg-surface-raised border border-surface-border mb-5">
          {[
            ['login', 'Sign in'],
            ['register', 'Sign up'],
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
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="input-field"
                required
              />
              <input
                type="text"
                autoComplete="family-name"
                placeholder="Last name"
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
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            required
          />
          <input
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            placeholder="Password"
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

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="btn-ghost flex-1 text-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary flex-1 text-sm">
            {busy ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Working</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> {isRegister ? 'Sign up' : 'Sign in'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
