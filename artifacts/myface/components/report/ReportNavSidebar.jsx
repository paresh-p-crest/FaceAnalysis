'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Menu } from 'lucide-react'
import {
  REPORT_NAV_GROUPS,
  TOOL_SECTIONS,
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

export function ReportNavSidebar({
  activeId,
  onSelect,
  showAiVisuals = true,
  showAssistant = true,
}) {
  const t = useTranslations('Report')
  const [mobileOpen, setMobileOpen] = useState(false)

  const toolItems = useMemo(() => {
    return TOOL_SECTIONS.filter((item) => {
      if (item.id === 'aiVisuals') return showAiVisuals
      if (item.id === 'beautyAssistant') return showAssistant
      return true
    })
  }, [showAiVisuals, showAssistant])

  const activeGroup = findNavGroupForSection(activeId)
  const activeLabel = useMemo(() => {
    for (const group of REPORT_NAV_GROUPS) {
      const hit = group.items.find((item) => item.id === activeId)
      if (hit) return t(hit.labelKey)
    }
    const tool = toolItems.find((item) => item.id === activeId)
    return tool ? t(tool.labelKey) : t('nav.report')
  }, [activeId, toolItems, t])

  const handleSelect = (id) => {
    onSelect(id)
    setMobileOpen(false)
  }

  const navBody = (
    <>
      <div className="flex-1 space-y-1 min-h-0 overflow-y-auto pr-1">
        {REPORT_NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            label={t(group.labelKey)}
            items={group.items}
            activeId={activeId}
            onSelect={handleSelect}
            defaultOpen={activeGroup === group.id || group.id === 'features'}
            t={t}
          />
        ))}
      </div>

      {toolItems.length > 0 && (
        <div className="pt-4 mt-4 border-t border-surface-border shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2 px-2">
            {t('nav.tools')}
          </p>
          <div className="space-y-0.5">
            {toolItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`qoves-report-nav-item ${activeId === item.id ? 'qoves-report-nav-item--active' : ''}`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <nav className="flex flex-col h-full min-h-0">
      <div className="lg:hidden mb-3">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="w-full inline-flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-surface-border bg-white dark:bg-surface-card text-sm font-medium text-ink"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <Menu className="w-4 h-4 shrink-0 text-ink-muted" />
            <span className="truncate">{activeLabel}</span>
          </span>
          {mobileOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        </button>
        {mobileOpen && (
          <div className="mt-2 rounded-2xl border border-surface-border bg-surface-raised p-3 max-h-[50vh] overflow-y-auto">
            {navBody}
          </div>
        )}
      </div>

      <div className="hidden lg:flex flex-col h-full min-h-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-4 px-2 shrink-0">
          {t('nav.report')}
        </p>
        {navBody}
      </div>
    </nav>
  )
}
