'use client'

import { useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { BrandLogo } from './BrandLogo'
import { Providers } from './providers/Providers'
import { RouteLayout } from './RouteLayout'

/** Hook-free first paint — must match SSR HTML exactly (Agent Preview iframe). */
function StaticBoot() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-surface text-ink font-sans"
      aria-busy="true"
      aria-label="Loading"
      suppressHydrationWarning
    >
      <div className="text-center">
        <BrandLogo size="lg" className="mb-4" />
        <div
          className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto"
          aria-hidden
        />
        <p className="text-sm text-ink-muted mt-3" suppressHydrationWarning>
          Loading…
        </p>
      </div>
    </div>
  )
}

export function ClientAppShell({ locale, messages, children }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <StaticBoot />
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Providers>
        <RouteLayout>{children}</RouteLayout>
      </Providers>
    </NextIntlClientProvider>
  )
}
