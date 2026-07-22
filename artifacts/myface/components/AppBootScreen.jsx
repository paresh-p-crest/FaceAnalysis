'use client'

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { usePathname } from '../i18n/navigation'
import { ROUTES } from '../utils/routes'
import { BrandLogo } from './BrandLogo'

function useBootLabel(explicitLabel) {
  const pathname = usePathname()
  const tHome = useTranslations('Home')
  const tAssistant = useTranslations('Assistant')
  const tAiVisuals = useTranslations('AiVisuals')
  const tCommon = useTranslations('Common')

  if (explicitLabel) return explicitLabel

  if (pathname === ROUTES.chat) return tAssistant('loading')
  if (pathname === ROUTES.aiVisuals) return tAiVisuals('loading')
  if (pathname === ROUTES.dashboard) return tHome('loadingDashboard')
  if (pathname === ROUTES.report) return tHome('loadingReport')
  return tCommon('loading')
}

export function AppBootScreen({ withNavbarOffset = true, label }) {
  const tCommon = useTranslations('Common')
  const message = useBootLabel(label)

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-surface text-ink font-sans ${
        withNavbarOffset ? 'site-navbar-offset' : ''
      }`}
      aria-busy="true"
      aria-label={message || tCommon('loading')}
    >
      <div className="text-center">
        <BrandLogo size="lg" className="mb-4" />
        <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto" />
        {message ? (
          <p className="text-sm text-ink-muted mt-3">{message}</p>
        ) : null}
      </div>
    </div>
  )
}
