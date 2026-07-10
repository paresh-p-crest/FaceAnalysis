'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Sun,
  Moon,
  User,
  X,
} from 'lucide-react'
import { adminTabToPath, dashboardPathForUser, isAdminTabPath, logoPathForUser, ROUTES } from '../utils/routes'
import { useTheme } from '../utils/theme'

function NavLink({ icon: Icon, label, href, onClick, active, className = '' }) {
  const classNames = `site-navbar-link ${active ? 'site-navbar-link-active' : ''} ${className}`

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classNames}>
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classNames}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />}
      <span>{label}</span>
    </button>
  )
}

function MobileNavLink({ icon: Icon, label, href, onClick, active }) {
  const classNames = `site-navbar-mobile-link ${active ? 'site-navbar-mobile-link-active' : ''}`

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classNames}>
        {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden />}
        <span>{label}</span>
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classNames}>
      {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden />}
      <span>{label}</span>
    </button>
  )
}

export function SiteNavbar({
  pathname,
  authReady = true,
  onDashboard,
  onHistory,
  onBilling,
  onSettings,
  onAuth,
  onLogout,
  onLogo,
  user,
}) {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const isAdmin = user?.role === 'admin'

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const toggleMenu = useCallback(() => setMenuOpen((open) => !open), [])

  const runAndClose = useCallback(
    (handler) => () => {
      handler?.()
      closeMenu()
    },
    [closeMenu],
  )

  useEffect(() => {
    closeMenu()
  }, [pathname, closeMenu])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, closeMenu])

  const navItems = useMemo(() => {
    const items = []
    if (user) {
      items.push({
        key: 'dashboard',
        label: user.role === 'admin' ? 'Admin Panel' : 'Dashboard',
        icon: user.role === 'admin' ? Shield : LayoutDashboard,
        href: dashboardPathForUser(user),
        onClick: onDashboard,
        active: user.role === 'admin' ? isAdminTabPath(pathname) : pathname === ROUTES.dashboard,
      })
    }
    if (user) {
      items.push({
        key: 'history',
        label: 'Analysis History',
        icon: History,
        href: ROUTES.history,
        onClick: onHistory,
        active: pathname === ROUTES.history,
      })
    }
    if (user && !isAdmin) {
      items.push({
        key: 'billing',
        label: 'Billing',
        icon: CreditCard,
        href: ROUTES.billing,
        onClick: onBilling,
        active: pathname === ROUTES.billing,
      })
    }
    if (user && isAdmin) {
      items.push({ key: 'settings', label: 'API Settings', icon: Settings, onClick: onSettings, active: false })
    }
    return items
  }, [user, isAdmin, pathname, onDashboard, onHistory, onBilling, onSettings])

  const themeTitle = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  const themeLabel = theme === 'dark' ? 'Light mode' : 'Dark mode'
  const logoHref = logoPathForUser(user)

  const emailBadge = user ? (
    <div
      className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-warm border border-surface-border text-[11px] text-ink-secondary max-w-[160px]"
      title={`${user.email} (${user.role})`}
    >
      {isAdmin ? <Shield className="w-3 h-3 text-brand shrink-0" /> : <User className="w-3 h-3 text-brand shrink-0" />}
      <span className="truncate">{user.email}</span>
    </div>
  ) : null

  const authButton = !authReady ? (
    <div className="site-navbar-icon-btn min-h-[32px] min-w-[32px] opacity-0 pointer-events-none" aria-hidden />
  ) : user ? (
    <button type="button" onClick={onLogout} className="site-navbar-btn">
      <LogOut className="w-3.5 h-3.5" aria-hidden />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  ) : (
    <button type="button" onClick={onAuth} className="site-navbar-btn">
      <User className="w-3.5 h-3.5" aria-hidden />
      <span className="hidden sm:inline">Sign in</span>
    </button>
  )

  const themeButton = (
    <button
      type="button"
      onClick={toggleTheme}
      className="site-navbar-icon-btn"
      title={themeTitle}
      aria-label={themeTitle}
    >
      {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  )

  return (
    <header className={`site-navbar ${menuOpen ? 'site-navbar-expanded' : ''}`} role="banner">
      <div className="site-navbar-inner">
        <Link
          href={logoHref}
          onClick={onLogo}
          className="font-serif font-bold text-lg text-ink tracking-tight shrink-0 hover:text-brand transition-colors"
        >
          MyFace
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center min-w-0" aria-label="Main">
          {authReady && user && navItems.map((item) => (
            <NavLink
              key={item.key}
              icon={item.icon}
              label={item.label}
              href={item.href}
              onClick={item.onClick}
              active={item.active}
            />
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {emailBadge}
          {authButton}
          {themeButton}
        </div>

        <button
          type="button"
          className="md:hidden site-navbar-icon-btn min-h-[36px] min-w-[36px]"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-controls="site-navbar-mobile-menu"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          disabled={!authReady || !user}
          style={!authReady || !user ? { visibility: 'hidden' } : undefined}
        >
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      <div
        id="site-navbar-mobile-menu"
        className={`site-navbar-mobile-panel md:hidden ${menuOpen ? 'site-navbar-mobile-panel-open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <div className="site-navbar-mobile-panel-inner">
          {user && (
            <div className="px-4 py-2.5 border-b border-surface-border">
              <div className="inline-flex items-center gap-1.5 text-xs text-ink-secondary max-w-full">
                {isAdmin ? <Shield className="w-3.5 h-3.5 text-brand shrink-0" /> : <User className="w-3.5 h-3.5 text-brand shrink-0" />}
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          )}

          <nav className="py-1" aria-label="Mobile">
            {navItems.map((item) => (
              <MobileNavLink
                key={item.key}
                icon={item.icon}
                label={item.label}
                href={item.href}
                onClick={runAndClose(item.onClick)}
                active={item.active}
              />
            ))}
          </nav>

          <div className="border-t border-surface-border p-2 grid grid-cols-2 gap-2">
            {user ? (
              <button type="button" onClick={runAndClose(onLogout)} className="site-navbar-mobile-action">
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            ) : (
              <button type="button" onClick={runAndClose(onAuth)} className="site-navbar-mobile-action">
                <User className="w-4 h-4" />
                Sign in
              </button>
            )}
            <button
              type="button"
              onClick={() => { toggleTheme(); closeMenu() }}
              className="site-navbar-mobile-action"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {themeLabel}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
