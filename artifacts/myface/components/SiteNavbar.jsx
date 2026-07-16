'use client'

import { useTranslations } from 'next-intl'
import { Link } from '../i18n/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  CreditCard,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react'
import { dashboardPathForUser, isAdminTabPath, logoPathForUser, ROUTES } from '../utils/routes'
import { LocaleSwitcher } from './LocaleSwitcher'

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

function displayName(user, accountFallback) {
  if (!user) return ''
  if (user.name && String(user.name).trim()) return String(user.name).trim()
  const email = String(user.email || '')
  const local = email.split('@')[0]
  return local || email || accountFallback
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
  const t = useTranslations('Nav')
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)
  const isAdmin = user?.role === 'admin'
  const username = displayName(user, t('account'))

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeAccount = useCallback(() => setAccountOpen(false), [])
  const toggleMenu = useCallback(() => setMenuOpen((open) => !open), [])
  const toggleAccount = useCallback(() => setAccountOpen((open) => !open), [])

  const runAndClose = useCallback(
    (handler) => () => {
      handler?.()
      closeMenu()
      closeAccount()
    },
    [closeMenu, closeAccount],
  )

  useEffect(() => {
    closeMenu()
    closeAccount()
  }, [pathname, closeMenu, closeAccount])

  useEffect(() => {
    if (!menuOpen && !accountOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu()
        closeAccount()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, accountOpen, closeMenu, closeAccount])

  useEffect(() => {
    if (!accountOpen) return undefined
    const onPointerDown = (event) => {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        closeAccount()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [accountOpen, closeAccount])

  const navItems = useMemo(() => {
    const items = []
    if (user) {
      items.push({
        key: 'dashboard',
        label: user.role === 'admin' ? t('adminPanel') : t('dashboard'),
        icon: user.role === 'admin' ? Shield : LayoutDashboard,
        href: dashboardPathForUser(user),
        onClick: onDashboard,
        active: user.role === 'admin' ? isAdminTabPath(pathname) : pathname === ROUTES.dashboard,
      })
    }
    if (user) {
      items.push({
        key: 'history',
        label: t('analysisHistory'),
        icon: History,
        href: ROUTES.history,
        onClick: onHistory,
        active: pathname === ROUTES.history,
      })
    }
    if (user && !isAdmin) {
      items.push({
        key: 'billing',
        label: t('billing'),
        icon: CreditCard,
        href: ROUTES.billing,
        onClick: onBilling,
        active: pathname === ROUTES.billing,
      })
    }
    if (user && isAdmin) {
      items.push({ key: 'settings', label: t('apiSettings'), icon: Settings, onClick: onSettings, active: false })
    }
    return items
  }, [user, isAdmin, pathname, onDashboard, onHistory, onBilling, onSettings, t])

  const logoHref = logoPathForUser(user)

  const accountControl = !authReady ? (
    <div className="site-navbar-icon-btn min-h-[32px] min-w-[32px] opacity-0 pointer-events-none" aria-hidden />
  ) : user ? (
    <div className="relative" ref={accountRef}>
      <button
        type="button"
        onClick={toggleAccount}
        className="inline-flex items-center gap-1.5 max-w-[160px] px-2.5 py-1 rounded-lg border border-surface-border bg-surface-card text-xs font-medium text-ink-secondary hover:text-brand hover:border-brand/30 transition-colors min-h-[32px] shadow-soft"
        aria-expanded={accountOpen}
        aria-haspopup="menu"
        title={user.email}
      >
        <span className="truncate">{username}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 transition-transform ${accountOpen ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {accountOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 min-w-[140px] rounded-xl border border-surface-border bg-surface-card shadow-elevated py-1 z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={runAndClose(onLogout)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-warm hover:text-brand transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
  ) : (
    <button type="button" onClick={onAuth} className="site-navbar-btn">
      <User className="w-3.5 h-3.5" aria-hidden />
      <span>{t('signIn')}</span>
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

        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center min-w-0" aria-label={t('mainNav')}>
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
          <LocaleSwitcher />
          {accountControl}
        </div>

        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <LocaleSwitcher compact />
          {!authReady ? (
            <div className="site-navbar-icon-btn min-h-[36px] min-w-[36px] opacity-0 pointer-events-none" aria-hidden />
          ) : user ? (
            <button
              type="button"
              className="site-navbar-icon-btn min-h-[36px] min-w-[36px]"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="site-navbar-mobile-menu"
              aria-label={menuOpen ? t('closeMenu') : t('openMenu')}
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          ) : (
            <button type="button" onClick={onAuth} className="site-navbar-btn min-h-[36px]">
              <User className="w-3.5 h-3.5" aria-hidden />
              {t('signIn')}
            </button>
          )}
        </div>
      </div>

      <div
        id="site-navbar-mobile-menu"
        className={`site-navbar-mobile-panel md:hidden ${menuOpen ? 'site-navbar-mobile-panel-open' : ''}`}
        aria-hidden={!menuOpen}
      >
        <div className="site-navbar-mobile-panel-inner">
          {user && (
            <div className="px-4 py-2.5 border-b border-surface-border">
              <p className="text-sm font-medium text-ink truncate" title={user.email}>
                {username}
              </p>
              <p className="text-[11px] text-ink-muted truncate mt-0.5">{user.email}</p>
            </div>
          )}

          <nav className="py-1" aria-label={t('mobileNav')}>
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

          <div className="border-t border-surface-border p-2 space-y-1">
            <div className="px-2 pb-1">
              <LocaleSwitcher className="w-full [&>button]:w-full [&>button]:justify-between" />
            </div>
            {user ? (
              <button type="button" onClick={runAndClose(onLogout)} className="site-navbar-mobile-action w-full">
                <LogOut className="w-4 h-4" />
                {t('signOut')}
              </button>
            ) : (
              <button type="button" onClick={runAndClose(onAuth)} className="site-navbar-mobile-action w-full">
                <User className="w-4 h-4" />
                {t('signIn')}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
