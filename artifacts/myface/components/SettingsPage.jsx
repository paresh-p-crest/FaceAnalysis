'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { changePassword, updateProfile } from '../utils/authClient'
import { translateApiError } from '../utils/translateApiError'
import BillingPage from './BillingPage'
import { StandalonePageShell } from './StandalonePageShell'
import { SettingsDocumentLayout } from './settings/SettingsDocumentLayout'

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink-secondary">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-surface-border bg-white dark:bg-surface-card px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40'

function SettingsPanelHeader({ title, description }) {
  return (
    <header className="mb-6 pb-4 border-b border-surface-border">
      <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">{title}</h1>
      {description ? <p className="text-sm text-ink-muted mt-1">{description}</p> : null}
    </header>
  )
}

export default function SettingsPage({ user, onUserUpdated }) {
  const t = useTranslations('Settings')
  const tAuth = useTranslations('Auth')
  const tErrors = useTranslations('Errors')

  const [activeSection, setActiveSection] = useState('account')

  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [email, setEmail] = useState(user?.email || '')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    setFirstName(user?.firstName || '')
    setLastName(user?.lastName || '')
    setEmail(user?.email || '')
  }, [user?.id, user?.firstName, user?.lastName, user?.email])

  const saveProfile = async (event) => {
    event.preventDefault()
    setProfileSaving(true)
    setProfileMessage('')
    setProfileError('')
    try {
      const updated = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      })
      onUserUpdated?.(updated)
      setProfileMessage(t('profileSaved'))
    } catch (err) {
      setProfileError(translateApiError(err, tErrors) || err.message || t('profileSaveFailed'))
    } finally {
      setProfileSaving(false)
    }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'))
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage(t('passwordSaved'))
    } catch (err) {
      setPasswordError(translateApiError(err, tErrors) || err.message || t('passwordSaveFailed'))
    } finally {
      setPasswordSaving(false)
    }
  }

  let panel = null
  if (activeSection === 'account') {
    panel = (
      <>
        <SettingsPanelHeader title={t('accountTitle')} description={t('accountDesc')} />
        <form onSubmit={saveProfile} className="space-y-4 max-w-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tAuth('firstName')}>
              <input
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
              />
            </Field>
            <Field label={tAuth('lastName')}>
              <input
                className={inputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
              />
            </Field>
          </div>
          <Field label={tAuth('email')}>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          {profileError ? <p className="text-xs text-red-600">{profileError}</p> : null}
          {profileMessage ? <p className="text-xs text-emerald-700">{profileMessage}</p> : null}
          <button type="submit" disabled={profileSaving} className="report-shell-btn-primary min-h-[40px] px-4">
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('saveProfile')}
          </button>
        </form>
      </>
    )
  } else if (activeSection === 'password') {
    panel = (
      <>
        <SettingsPanelHeader title={t('passwordTitle')} description={t('passwordDesc')} />
        <form onSubmit={savePassword} className="space-y-4 max-w-lg">
          <Field label={t('currentPassword')}>
            <input
              type="password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label={t('newPassword')}>
            <input
              type="password"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          <Field label={t('confirmPassword')}>
            <input
              type="password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          {passwordError ? <p className="text-xs text-red-600">{passwordError}</p> : null}
          {passwordMessage ? <p className="text-xs text-emerald-700">{passwordMessage}</p> : null}
          <button type="submit" disabled={passwordSaving} className="report-shell-btn-primary min-h-[40px] px-4">
            {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t('savePassword')}
          </button>
        </form>
      </>
    )
  } else {
    panel = (
      <>
        <SettingsPanelHeader title={t('billingTitle')} description={t('billingDesc')} />
        <BillingPage user={user} embedded />
      </>
    )
  }

  return (
    <StandalonePageShell>
      <SettingsDocumentLayout activeId={activeSection} onSelect={setActiveSection}>
        {panel}
      </SettingsDocumentLayout>
    </StandalonePageShell>
  )
}
