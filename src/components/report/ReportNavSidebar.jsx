import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export const REPORT_NAV = [
  {
    id: 'assessments',
    label: 'Facial Assessments',
    items: [
      { id: 'symmetry', label: 'Symmetry' },
      { id: 'proportions', label: 'Proportions' },
    ],
  },
  {
    id: 'features',
    label: 'Features Analysis',
    items: [
      { id: 'eyes', label: 'Eyes' },
      { id: 'eyebrows', label: 'Eyebrows' },
    ],
  },
]

export function ReportNavSidebar({ activeId, onSelect }) {
  const [open, setOpen] = useState({ assessments: true, features: true })

  return (
    <nav className="glass rounded-2xl p-4 h-fit lg:sticky lg:top-24">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-4 font-sans">AuraScan Report</p>
      {REPORT_NAV.map((section) => (
        <div key={section.id} className="mb-3">
          <button
            type="button"
            onClick={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 py-2 font-display"
          >
            {section.label}
            {open[section.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {open[section.id] && (
            <ul className="ml-1 space-y-0.5 border-l border-white/[0.06] pl-3">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`w-full text-left text-sm py-2 px-2 rounded-lg transition-colors font-sans ${
                      activeId === item.id
                        ? 'text-accent bg-accent/10 font-medium'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </nav>
  )
}
