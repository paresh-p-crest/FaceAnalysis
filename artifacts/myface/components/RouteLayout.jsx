'use client'

import { useEffect, useState } from 'react'
import { usePathname } from '../i18n/navigation'
import { ROUTES } from '../utils/routes'
import { AppShell } from './AppShell'
import { AnalysisShell } from './analysis/AnalysisShell'
import { AuthShell } from './AuthShell'
import { AppBootScreen } from './AppBootScreen'
import { useApp } from './providers/AppProvider'

function RouteContent({ children }) {
  const { authReady } = useApp()

  if (!authReady) {
    // Stable key — do NOT key on pathname. In Replit Agent iframe, usePathname() can
    // disagree with SSR and a mismatched key blows up hydration → Invalid hook call.
    return <AppBootScreen withNavbarOffset={false} />
  }

  // Do not key on pathname: admin tabs (/dashboard/admin-users → admin-overview) would
  // remount the whole page tree and throw removeChild NotFoundError during soft nav.
  return <div>{children}</div>
}

export function RouteLayout({ children }) {
  const pathname = usePathname()
  const [shellReady, setShellReady] = useState(false)

  useEffect(() => {
    setShellReady(true)
  }, [])

  // Until mount, render a pathname-agnostic boot screen so SSR HTML matches the
  // first client paint even when usePathname() is wrong in an embedded Preview.
  if (!shellReady) {
    return <AppBootScreen withNavbarOffset={false} />
  }

  const isAuth = pathname === ROUTES.auth
  const isAnalysis = pathname === ROUTES.analysis

  if (isAuth) {
    return (
      <AuthShell>
        <RouteContent>{children}</RouteContent>
      </AuthShell>
    )
  }

  const Shell = isAnalysis ? AnalysisShell : AppShell

  return (
    <Shell>
      <RouteContent>{children}</RouteContent>
    </Shell>
  )
}
