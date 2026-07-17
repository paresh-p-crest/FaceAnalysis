'use client'

import { usePathname } from '../i18n/navigation'
import { hasSiteNavbar, ROUTES } from '../utils/routes'
import { AppShell } from './AppShell'
import { AnalysisShell } from './analysis/AnalysisShell'
import { AuthShell } from './AuthShell'
import { AppBootScreen } from './AppBootScreen'
import { useApp } from './providers/AppProvider'

function RouteContent({ children }) {
  const { user, authReady } = useApp()
  const pathname = usePathname()
  const withNavbarOffset = hasSiteNavbar(pathname) && authReady && !!user

  if (!authReady) {
    return <AppBootScreen withNavbarOffset={withNavbarOffset} />
  }

  return children
}

export function RouteLayout({ children }) {
  const pathname = usePathname()
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
