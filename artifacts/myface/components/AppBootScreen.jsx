'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { usePathname } from '../i18n/navigation'
import { ROUTES } from '../utils/routes'
import { BrandLogo } from './BrandLogo'

function labelForPath(pathname, tHome, tAssistant, tAiVisuals, tCommon) {
  if (pathname === ROUTES.chat) return tAssistant('loading')
  if (pathname === ROUTES.aiVisuals) return tAiVisuals('loading')
  if (pathname === ROUTES.dashboard) return tHome('loadingDashboard')
  if (pathname === ROUTES.report) return tHome('loadingReport')
  return tCommon('loading')
}

/**
 * Boot/loading screen. Path-based copy is applied only after mount so SSR and the
 * first client paint always match (Replit Agent Preview iframe can disagree on pathname).
 */
export function AppBootScreen({ withNavbarOffset = true, label }) {
  const pathname = usePathname()
  const tHome = useTranslations('Home')
  const tAssistant = useTranslations('Assistant')
  const tAiVisuals = useTranslations('AiVisuals')
  const tCommon = useTranslations('Common')
  const [pathLabel, setPathLabel] = useState(null)

  useEffect(() => {
    if (label != null && label !== '') return undefined
    setPathLabel(labelForPath(pathname, tHome, tAssistant, tAiVisuals, tCommon))
    return undefined
  }, [label, pathname, tHome, tAssistant, tAiVisuals, tCommon])

  const message =
    label != null && label !== '' ? label : pathLabel || tCommon('loading')

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-surface text-ink font-sans ${
        withNavbarOffset ? 'site-navbar-offset' : ''
      }`}
      aria-busy="true"
      aria-label={message}
      suppressHydrationWarning
    >
      <div className="text-center">
        <BrandLogo size="lg" className="mb-4" />
        <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto" />
        <p className="text-sm text-ink-muted mt-3" suppressHydrationWarning>
          {message}
        </p>
      </div>
    </div>
  )
}
