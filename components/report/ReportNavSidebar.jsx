import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  REPORT_NAV_GROUPS,
  TOOL_SECTIONS,
  findNavGroupForSection,
} from './reportNavConfig'

function NavGroup({ label, items, activeId, onSelect, defaultOpen = false }) {
  const hasActive = items.some((item) => item.id === activeId)
  const [open, setOpen] = useState(defaultOpen || hasActive)

  useEffect(() => {
    if (hasActive) setOpen(true)
  }, [hasActive])

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="qoves-report-nav-group-label"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <span>{label}</span>
      </button>
      {open && (
        <div className="mt-1 ml-1 space-y-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`qoves-report-nav-item ${activeId === item.id ? 'qoves-report-nav-item--active' : ''}`}
            >
              {item.label}
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
  const toolItems = useMemo(() => {
    return TOOL_SECTIONS.filter((item) => {
      if (item.id === 'aiVisuals') return showAiVisuals
      if (item.id === 'beautyAssistant') return showAssistant
      return true
    })
  }, [showAiVisuals, showAssistant])

  const activeGroup = findNavGroupForSection(activeId)

  return (
    <nav className="flex flex-col h-full">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-4 px-2">
        Report
      </p>

      <div className="flex-1 space-y-1">
        {REPORT_NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            label={group.label}
            items={group.items}
            activeId={activeId}
            onSelect={onSelect}
            defaultOpen={activeGroup === group.id}
          />
        ))}
      </div>

      {toolItems.length > 0 && (
        <div className="pt-4 mt-4 border-t border-surface-border">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-2 px-2">
            Tools
          </p>
          <div className="space-y-0.5">
            {toolItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`qoves-report-nav-item ${activeId === item.id ? 'qoves-report-nav-item--active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
