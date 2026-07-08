import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export const REPORT_NAV = [
  {
    id: 'overview',
    label: 'Introduction',
    items: [
      { id: 'summary', label: 'Executive Summary' },
    ],
  },
  {
    id: 'assessments',
    label: 'Facial Assessments',
    items: [
      { id: 'dimorphism', label: 'Dimorphism' },
      { id: 'averageness', label: 'Averageness' },
      { id: 'faceShape', label: 'Face Shape' },
      { id: 'symmetry', label: 'Symmetry' },
      { id: 'proportions', label: 'Proportions' },
    ],
  },
  {
    id: 'features',
    label: 'Features Analysis',
    items: [
      { id: 'eyebrows', label: 'Eyebrows' },
      { id: 'eyes', label: 'Eyes' },
      { id: 'nose', label: 'Nose' },
      { id: 'lips', label: 'Lips' },
      { id: 'cheeks', label: 'Cheeks' },
      { id: 'jaw', label: 'Jaw' },
      { id: 'chin', label: 'Chin' },
      { id: 'hair', label: 'Hair' },
      { id: 'smile', label: 'Smile' },
      { id: 'neck', label: 'Neck' },
      { id: 'ears', label: 'Ear' },
      { id: 'skin', label: 'Skin' },
    ],
  },
  {
    id: 'protocol-section',
    label: 'Protocol',
    items: [
      { id: 'protocol', label: 'Aesthetic Protocol' },
    ],
  },
  {
    id: 'visuals-section',
    label: 'AI Visuals',
    items: [
      { id: 'aiVisuals', label: 'Hair, Outfit, Aging' },
    ],
  },
  {
    id: 'assistant-section',
    label: 'Assistant',
    items: [
      { id: 'beautyAssistant', label: 'Beauty Assistant' },
    ],
  },
]

export function ReportNavSidebar({ activeId, onSelect, showAiVisuals = true, showAssistant = true }) {
  const [open, setOpen] = useState({
    overview: true,
    assessments: true,
    features: true,
    'skin-section': true,
    'protocol-section': true,
    'visuals-section': true,
    'assistant-section': true,
  })

  return (
    <nav className="bg-white dark:bg-surface-card rounded-2xl p-4 h-fit lg:sticky lg:top-24 shadow-card border border-surface-border">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-4 font-sans font-medium">AuraScan Report</p>
      {REPORT_NAV.filter((section) => {
        if (section.id === 'visuals-section') return showAiVisuals
        if (section.id === 'assistant-section') return showAssistant
        return true
      }).map((section) => (
        <div key={section.id} className="mb-3">
          <button
            type="button"
            onClick={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
            className="w-full flex items-center justify-between text-xs font-semibold text-ink-secondary py-2 font-display"
          >
            {section.label}
            {open[section.id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {open[section.id] && (
            <ul className="ml-1 space-y-0.5 border-l border-surface-border pl-3">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    className={`w-full text-left text-sm py-2 px-2 rounded-lg transition-colors font-sans ${
                      activeId === item.id
                        ? 'text-brand bg-brand-50 font-medium'
                        : 'text-ink-muted hover:text-ink-secondary hover:bg-surface-warm'
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
