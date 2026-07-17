'use client'

import { useTranslations } from 'next-intl'
import { Link } from '../../i18n/navigation'
import { useApp } from '../../components/providers/AppProvider'
import { dashboardPathForUser, ROUTES } from '../../utils/routes'

export default function NotFoundPage() {
  const t = useTranslations('Errors')
  const { user } = useApp()
  const homeHref = user ? dashboardPathForUser(user) : ROUTES.dashboard

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-surface text-ink font-sans">
      <div className="max-w-md w-full text-center">
        <h1 className="font-display text-2xl font-semibold text-ink mb-2">{t('notFoundTitle')}</h1>
        <p className="text-sm text-ink-muted leading-relaxed mb-6">{t('notFoundDescription')}</p>
        <Link href={homeHref} className="btn-primary text-sm px-5 py-2.5 shadow-brand inline-flex">
          {t('home')}
        </Link>
      </div>
    </div>
  )
}
