'use client'

import { useEffect } from 'react'
import { usePathname } from '../i18n/navigation'
import { hasSiteNavbar, ROUTES } from '../utils/routes'
import { AppShell } from './AppShell'
import { AnalysisShell } from './analysis/AnalysisShell'
import { AppBootScreen } from './AppBootScreen'
import { useApp } from './providers/AppProvider'

function RouteContent({ children }) {
  const { user, authReady } = useApp()
  const pathname = usePathname()
  const withNavbarOffset = hasSiteNavbar(pathname) && authReady && !!user

  if (!authReady) {
    return <AppBootScreen withNavbarOffset={withNavbarOffset} />
  }

  if (!user) {
    return <AppBootScreen withNavbarOffset={withNavbarOffset} />
  }

  return children
}

export function RouteLayout({ children }) {
  const pathname = usePathname()
  const { user, authReady, setAuthOpen } = useApp()
  const isAnalysis = pathname === ROUTES.analysis
  const Shell = isAnalysis ? AnalysisShell : AppShell

  useEffect(() => {
    if (!authReady) return
    if (!user) setAuthOpen(true)
  }, [authReady, user, setAuthOpen])

  return (
    <Shell authRequired={authReady && !user}>
      <RouteContent>{children}</RouteContent>
    </Shell>
  )
}
