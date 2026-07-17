'use client'

import { useTranslations } from 'next-intl'
import { Link } from '../../i18n/navigation'
import { useApp } from '../../components/providers/AppProvider'
import { dashboardPathForUser, ROUTES } from '../../utils/routes'

export default function ErrorPage({ error, reset }) {
  const t = useTranslations('Errors')
  const { user } = useApp()
  const homeHref = user ? dashboardPathForUser(user) : ROUTES.dashboard

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-surface text-ink font-sans">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">{t('title')}</h1>
        <p className="text-sm text-ink-muted leading-relaxed mb-6">{t('description')}</p>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <p className="text-xs text-red-600 mb-4 break-words">{error.message}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button type="button" onClick={reset} className="btn-ghost text-sm px-5 py-2.5">
            {t('tryAgain')}
          </button>
          <Link href={homeHref} className="btn-primary text-sm px-5 py-2.5 shadow-brand">
            {t('home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
