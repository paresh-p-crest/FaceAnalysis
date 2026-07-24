'use client'

import { useTranslations } from 'next-intl'
import { Link } from '../i18n/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react'
import { ADMIN_TABS, adminTabFromPath, adminTabToPath } from '../utils/adminPanel'
import { logoPathForUser, ROUTES } from '../utils/routes'
import { LocaleSwitcher } from './LocaleSwitcher'
import { BrandLogo } from './BrandLogo'

function NavLink({ icon: Icon, label, href, onClick, active, disabled = false, emphasize = false, badge, className = '' }) {
  const classNames = `site-navbar-link ${active ? 'site-navbar-link-active' : ''} ${emphasize ? 'site-navbar-link-emphasis' : ''} ${disabled ? 'site-navbar-link-disabled' : ''} ${className}`

  const content = (
    <>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />}
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span
          className={`ml-0.5 min-w-[1.125rem] rounded-md px-1 py-px text-[10px] font-semibold leading-none tabular-nums ${
            active ? 'bg-brand/15 text-brand' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {badge}
        </span>
      )}
    </>
  )

  if (disabled) {
    return (
      <span className={classNames} aria-disabled="true">
        {content}
      </span>
    )
  }

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classNames}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classNames}>
      {content}
    </button>
  )
}

function MobileNavLink({ icon: Icon, label, href, onClick, active, disabled = false, emphasize = false, badge }) {
  const classNames = `site-navbar-mobile-link ${active ? 'site-navbar-mobile-link-active' : ''} ${emphasize ? 'site-navbar-mobile-link-emphasis' : ''} ${disabled ? 'site-navbar-mobile-link-disabled' : ''}`

  const content = (
    <>
      {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden />}
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="min-w-[1.125rem] rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 tabular-nums">
          {badge}
        </span>
      )}
    </>
  )

  if (disabled) {
    return (
      <span className={classNames} aria-disabled="true">
        {content}
      </span>
    )
  }

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={classNames}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classNames}>
      {content}
    </button>
  )
}

function displayName(user, accountFallback) {
  if (!user) return ''
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (full) return full
  if (user.name && String(user.name).trim()) return String(user.name).trim()
  const email = String(user.email || '')
  const emailUser = email.split('@')[0]
  return emailUser || email || accountFallback
}

/** First + last initials from name, else first two chars of display label. */
function userInitials(user, fallbackLabel = '') {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || (user?.name && String(user.name).trim())
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const email = String(user?.email || '')
  const local = email.split('@')[0] || fallbackLabel || '?'
  const chunks = local.split(/[._\-\s]+/).filter(Boolean)
  if (chunks.length >= 2) {
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase()
  }
  return local.slice(0, 2).toUpperCase()
}

const ADMIN_TAB_ICONS = {
  overview: LayoutDashboard,
  users: Users,
  review: FileText,
  payments: CreditCard,
}

function ReportNavbarActions({ toolbar, tReport, className = '', showLabels = true }) {
  if (!toolbar) return null
  const admin = toolbar.showAdminTools
  return (
    <div className={`flex items-center gap-1.5 flex-wrap justify-end ${className}`.trim()}>
      {admin && (
        <>
          <button
            type="button"
            onClick={() => toolbar.onToggleAdminView?.('images')}
            className={`report-shell-btn min-h-[32px] px-2.5 text-[10px] shrink-0 ${
              toolbar.adminView === 'images' ||
              toolbar.adminView === 'after' ||
              toolbar.adminView === 'visuals'
                ? 'report-shell-btn-active'
                : ''
            }`}
            title={tReport('shell.editGeneratedImages')}
          >
            <ImagePlus className="w-3.5 h-3.5 shrink-0" />
            {showLabels ? <span>{tReport('shell.editGeneratedImages')}</span> : null}
          </button>
          {toolbar.canApprove && (
            <button
              type="button"
              onClick={() => toolbar.onApprove?.()}
              disabled={!!toolbar.statusUpdating}
              className="report-shell-btn min-h-[32px] px-2.5 text-[10px] shrink-0 text-emerald-700 border-emerald-200 hover:border-emerald-300 hover:text-emerald-800"
              title={tReport('shell.approve')}
            >
              {toolbar.statusUpdating === 'approved' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              )}
              {showLabels ? <span>{tReport('shell.approve')}</span> : null}
            </button>
          )}
        </>
      )}
      <button
        type="button"
        onClick={toolbar.onDownloadPdf}
        disabled={!toolbar.canDownloadPdf || toolbar.pdfLoading}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-brand/90 disabled:opacity-50 shrink-0 min-h-[32px]"
      >
        {toolbar.pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        {tReport('executiveSummary.pdfButton')}
      </button>
    </div>
  )
}

export function SiteNavbar({
  pathname,
  authReady = true,
  accessReady = true,
  hasAnalysisAccess = true,
  onAuth,
  onLogout,
  onLogo,
  reportModalOpen = false,
  reportToolbar = null,
  user,
  adminNavBadges,
}) {
  const t = useTranslations('Nav')
  const tAdmin = useTranslations('Admin.panel')
  const tReport = useTranslations('Report')
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef(null)
  const isAdmin = user?.role === 'admin'
  const billingLocked = user && !isAdmin && accessReady && !hasAnalysisAccess
  const username = displayName(user, t('account'))
  const initials = userInitials(user, username)

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

  const activeAdminTab = isAdmin ? (adminTabFromPath(pathname) || 'overview') : null

  const navItems = useMemo(() => {
    if (!user) return []

    if (isAdmin) {
      return ADMIN_TABS.map((tab) => ({
        key: tab,
        label: tAdmin(`tabs.${tab}`),
        icon: ADMIN_TAB_ICONS[tab],
        href: adminTabToPath(tab),
        active: !reportModalOpen && activeAdminTab === tab,
        badge: tab === 'review' ? adminNavBadges?.review : tab === 'users' ? adminNavBadges?.users : undefined,
      }))
    }

    // Customer: Report / AI Visuals / Chat — independent routes (/dashboard is home via logo, not nav)
    return [
      {
        key: 'report',
        label: t('report'),
        icon: FileText,
        href: ROUTES.report,
        active: pathname === ROUTES.report,
        disabled: billingLocked,
        emphasize: false,
      },
      {
        key: 'aiVisuals',
        label: t('aiVisuals'),
        icon: Sparkles,
        href: ROUTES.aiVisuals,
        active: pathname === ROUTES.aiVisuals,
        disabled: billingLocked,
      },
      {
        key: 'chatAssistant',
        label: t('chatAssistant'),
        icon: MessageCircle,
        href: ROUTES.chat,
        active: pathname === ROUTES.chat,
        disabled: billingLocked,
      },
    ]
  }, [
    user,
    isAdmin,
    activeAdminTab,
    adminNavBadges,
    billingLocked,
    pathname,
    reportModalOpen,
    t,
    tAdmin,
  ])

  const logoHref = logoPathForUser(user)
  // Modal can open over admin review routes — don't require pathname === /report
  const showReportActions = reportModalOpen && !!reportToolbar

  const accountControl = !authReady ? (
    <div className="site-navbar-icon-btn min-h-[32px] min-w-[32px] opacity-0 pointer-events-none" aria-hidden />
  ) : user ? (
    <div className="relative" ref={accountRef}>
      <button
        type="button"
        onClick={toggleAccount}
        className="site-navbar-pill max-w-[200px] pl-1.5 pr-2.5 py-1"
        aria-expanded={accountOpen}
        aria-haspopup="menu"
        title={user.email}
      >
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white tracking-wide"
          aria-hidden
        >
          {initials}
        </span>
        <span className="truncate">{username}</span>
        <ChevronDown className={`w-3 h-3 shrink-0 text-ink-muted transition-transform ${accountOpen ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {accountOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 min-w-[160px] rounded-2xl border border-surface-border bg-surface-card shadow-card py-1 z-50"
        >
          <Link
            href={ROUTES.settings}
            role="menuitem"
            onClick={closeAccount}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-ink-secondary hover:bg-surface-warm hover:text-brand transition-colors text-left"
          >
            <Settings className="w-3.5 h-3.5" aria-hidden />
            {t('settings')}
          </Link>
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
        <div className="site-navbar-cluster">
          <Link
            href={logoHref}
            onClick={onLogo}
            className="shrink-0 hover:opacity-80 transition-opacity"
            aria-label="MyFace"
          >
            <BrandLogo size="md" />
          </Link>

          <nav
            className="hidden md:flex items-center gap-0.5 min-w-0 overflow-x-auto"
            aria-label={isAdmin ? tAdmin('title') : t('mainNav')}
          >
            {authReady && user && navItems.map((item) => (
              <NavLink
                key={item.key}
                icon={item.icon}
                label={item.label}
                href={item.href}
                onClick={item.onClick}
                active={item.active}
                disabled={item.disabled}
                emphasize={item.emphasize}
                badge={item.badge}
              />
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-1.5 shrink-0">
          {showReportActions && (
            <ReportNavbarActions
              toolbar={reportToolbar}
              tReport={tReport}
            />
          )}
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
                disabled={item.disabled}
                emphasize={item.emphasize}
                badge={item.badge}
              />
            ))}
          </nav>

          {showReportActions && (
            <div className="border-t border-surface-border px-4 py-3">
              <ReportNavbarActions
                toolbar={reportToolbar}
                tReport={tReport}
                className="flex-wrap"
              />
            </div>
          )}

          <div className="border-t border-surface-border p-2 space-y-1">
            <div className="px-2 pb-1">
              <LocaleSwitcher className="w-full [&>button]:w-full [&>button]:justify-between" />
            </div>
            {user ? (
              <>
                <Link href={ROUTES.settings} onClick={closeMenu} className="site-navbar-mobile-action w-full">
                  <Settings className="w-4 h-4" />
                  {t('settings')}
                </Link>
                <button type="button" onClick={runAndClose(onLogout)} className="site-navbar-mobile-action w-full">
                  <LogOut className="w-4 h-4" />
                  {t('signOut')}
                </button>
              </>
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
