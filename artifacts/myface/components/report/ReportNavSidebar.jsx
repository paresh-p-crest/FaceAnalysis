'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, History, Menu, X } from 'lucide-react'
import {
  REPORT_NAV_GROUPS,
  findNavGroupForSection,
} from './reportNavConfig'

function NavGroup({ label, items, activeId, onSelect, defaultOpen = false, t }) {
  const hasActive = items.some((item) => item.id === activeId)
  const [open, setOpen] = useState(defaultOpen || hasActive)

  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [hasActive])

  if (items.length === 1) {
    const item = items[0]
    const isActive = activeId === item.id
    return (
      <div className="report-view-nav-group">
        <button
          type="button"
          onClick={() => onSelect(item.id)}
          className={`report-view-nav-group-label ${isActive ? 'report-view-nav-item--active' : ''}`}
        >
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span>{label}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="report-view-nav-group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="report-view-nav-group-label"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <span>{label}</span>
      </button>
      {open && (
        <div className="report-view-nav-group-items">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`report-view-nav-item ${activeId === item.id ? 'report-view-nav-item--active' : ''}`}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarFooter({ label, onClick }) {
  return (
    <div className="report-view-nav-footer shrink-0 pt-3 mt-2 border-t border-surface-border">
      <button type="button" onClick={onClick} className="report-view-nav-footer-btn">
        <History className="w-4 h-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </button>
    </div>
  )
}

/** Report-style sidebar. Pass `groups` + `tNamespace` for AI Visuals etc. */
export function ReportNavSidebar({
  activeId,
  onSelect,
  groups = REPORT_NAV_GROUPS,
  tNamespace = 'Report',
  titleKey = 'nav.report',
  defaultOpenGroupId = 'introduction',
  footerAction = null,
  onClose = null,
  showHeaderClose = false,
}) {
  const t = useTranslations(tNamespace)
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeGroup = findNavGroupForSection(activeId, groups)
  const activeLabel = useMemo(() => {
    for (const group of groups) {
      const hit = group.items.find((item) => item.id === activeId)
      if (hit) return t(hit.labelKey)
    }
    return t(titleKey)
  }, [activeId, groups, t, titleKey])

  const handleSelect = (id) => {
    onSelect(id)
    setMobileOpen(false)
  }

  const navBody = (
    <div className="report-view-nav-scroll flex-1 space-y-1 min-h-0 overflow-y-auto pr-1">
      {groups.map((group) => (
        <NavGroup
          key={group.id}
          label={t(group.labelKey)}
          items={group.items}
          activeId={activeId}
          onSelect={handleSelect}
          defaultOpen={activeGroup === group.id || group.id === defaultOpenGroupId}
          t={t}
        />
      ))}
    </div>
  )

  return (
    <nav className="flex flex-col h-full min-h-0">
      <div className="lg:hidden mb-3">
        <div className={`flex items-center gap-2 ${showHeaderClose && onClose ? '' : ''}`}>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex-1 inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-full border border-surface-border bg-white dark:bg-surface-card text-sm font-medium text-ink shadow-soft min-w-0"
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <Menu className="w-4 h-4 shrink-0 text-ink-muted" />
              <span className="truncate">{activeLabel}</span>
            </span>
            {mobileOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
          </button>
          {showHeaderClose && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full border border-surface-border bg-white dark:bg-surface-card text-ink/70 hover:text-ink shadow-soft"
              aria-label={t('shell.closeReport')}
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        {mobileOpen && (
          <div className="report-view-nav-scroll mt-2 rounded-2xl border border-surface-border bg-surface-raised p-3 max-h-[50vh] overflow-y-auto">
            {navBody}
            {footerAction ? (
              <SidebarFooter label={footerAction.label} onClick={footerAction.onClick} />
            ) : null}
          </div>
        )}
        {!mobileOpen && footerAction ? (
          <SidebarFooter label={footerAction.label} onClick={footerAction.onClick} />
        ) : null}
      </div>

      <div className="hidden lg:flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between gap-2 mb-4 px-2 shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
            {t(titleKey)}
          </p>
          {showHeaderClose && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink/70 hover:text-ink hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              aria-label={t('shell.closeReport')}
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
        {navBody}
        {footerAction ? (
          <SidebarFooter label={footerAction.label} onClick={footerAction.onClick} />
        ) : null}
      </div>
    </nav>
  )
}
