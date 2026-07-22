'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter } from '../../i18n/navigation'
import { useApp } from '../../components/providers/AppProvider'
import { dashboardPathForUser, ROUTES } from '../../utils/routes'
import { navigateHome } from '../../utils/navigateHome'

export default function ErrorPage({ error, reset }) {
  const t = useTranslations('Errors')
  const { user } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const homeHref = user ? dashboardPathForUser(user) : ROUTES.auth

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-surface text-ink font-sans">
      <div className="text-center space-y-3 max-w-md">
        <p className="text-6xl sm:text-7xl font-bold tracking-tight text-ink tabular-nums leading-none">
          500
        </p>
        <h1 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm text-ink-muted leading-relaxed">
          {t('description')}
        </p>
        {process.env.NODE_ENV === 'development' && error?.message && (
          <p className="text-xs text-red-600 break-words">{error.message}</p>
        )}
        <div className="pt-3 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl border border-surface-border bg-white px-5 py-2.5 text-sm font-semibold text-ink-secondary hover:border-brand/30 hover:text-brand transition-colors"
          >
            {t('tryAgain')}
          </button>
          <button
            type="button"
            onClick={() => navigateHome(router, pathname, homeHref)}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition-colors shadow-brand"
          >
            {t('goHome')}
          </button>
        </div>
      </div>
    </div>
  )
}
