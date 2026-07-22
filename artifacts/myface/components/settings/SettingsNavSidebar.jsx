'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, CreditCard, KeyRound, Menu, UserPen } from 'lucide-react'

export const SETTINGS_NAV_ITEMS = [
  { id: 'account', labelKey: 'nav.account', icon: UserPen },
  { id: 'password', labelKey: 'nav.password', icon: KeyRound },
  { id: 'billing', labelKey: 'nav.billing', icon: CreditCard },
]

function NavRow({ item, active, onSelect, label }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`settings-nav-item ${active ? 'settings-nav-item--active' : ''}`}
    >
      <span className="settings-nav-icon-well" aria-hidden>
        <Icon className="w-[18px] h-[18px] text-ink-secondary" strokeWidth={1.75} />
      </span>
      <span className="text-[15px] font-medium text-ink">{label}</span>
    </button>
  )
}

export function SettingsNavSidebar({ activeId, onSelect }) {
  const t = useTranslations('Settings')
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeItem = useMemo(
    () => SETTINGS_NAV_ITEMS.find((item) => item.id === activeId) || SETTINGS_NAV_ITEMS[0],
    [activeId],
  )
  const activeLabel = t(activeItem.labelKey)

  const handleSelect = (id) => {
    onSelect(id)
    setMobileOpen(false)
  }

  const navBody = (
    <div className="settings-nav-scroll flex-1 space-y-1 min-h-0 overflow-y-auto pr-1">
      {SETTINGS_NAV_ITEMS.map((item) => (
        <NavRow
          key={item.id}
          item={item}
          active={activeId === item.id}
          onSelect={handleSelect}
          label={t(item.labelKey)}
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
          <div className="settings-nav-scroll mt-2 rounded-2xl border border-surface-border bg-surface-raised p-3 max-h-[50vh] overflow-y-auto">
            {navBody}
          </div>
        )}
      </div>

      <div className="hidden lg:flex flex-col h-full min-h-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-4 px-2 shrink-0">
          {t('title')}
        </p>
        {navBody}
      </div>
    </nav>
  )
}
