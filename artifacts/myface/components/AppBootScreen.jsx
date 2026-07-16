'use client'

import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

export function AppBootScreen({ withNavbarOffset = true }) {
  const t = useTranslations('Common')

  return (
    <div
      className={`min-h-screen flex items-center justify-center bg-surface text-ink font-sans ${
        withNavbarOffset ? 'site-navbar-offset' : ''
      }`}
      aria-busy="true"
      aria-label={t('loading')}
    >
      <div className="text-center">
        <p className="font-serif font-bold text-lg tracking-tight mb-4">MyFace</p>
        <Loader2 className="w-6 h-6 text-brand animate-spin mx-auto" />
      </div>
    </div>
  )
}
