'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, History, Menu } from 'lucide-react'
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

  return (
    <div className="qoves-report-nav-group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="qoves-report-nav-group-label"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <span>{label}</span>
      </button>
      {open && (
        <div className="qoves-report-nav-group-items">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`qoves-report-nav-item ${activeId === item.id ? 'qoves-report-nav-item--active' : ''}`}
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
    <div className="qoves-report-nav-footer shrink-0 pt-3 mt-2 border-t border-surface-border">
      <button type="button" onClick={onClick} className="qoves-report-nav-footer-btn">
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
    <div className="qoves-report-nav-scroll flex-1 space-y-1 min-h-0 overflow-y-auto pr-1">
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
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-full border border-surface-border bg-white dark:bg-surface-card text-sm font-medium text-ink shadow-soft"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Menu className="w-4 h-4 shrink-0 text-ink-muted" />
            <span className="truncate">{activeLabel}</span>
          </span>
          {mobileOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        </button>
        {mobileOpen && (
          <div className="qoves-report-nav-scroll mt-2 rounded-2xl border border-surface-border bg-surface-raised p-3 max-h-[50vh] overflow-y-auto">
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
        <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-4 px-2 shrink-0">
          {t(titleKey)}
        </p>
        {navBody}
        {footerAction ? (
          <SidebarFooter label={footerAction.label} onClick={footerAction.onClick} />
        ) : null}
      </div>
    </nav>
  )
}
