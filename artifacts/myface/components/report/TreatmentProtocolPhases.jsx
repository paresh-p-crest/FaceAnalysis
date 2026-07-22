'use client'

const PHASE_KEYS = ['phase01', 'phase02', 'phase03']

function normalizeItem(item) {
  if (!item) return { name: '—', detail: '' }
  if (typeof item === 'string') return { name: item, detail: '' }
  return {
    name: item.name || '—',
    detail: item.detail || '',
  }
}

/** Right-column treatment protocol cards (overview dashboard). */
export function TreatmentProtocolPhases({ phases, summary, title, className = '' }) {
  if (!phases) return null

  return (
    <div className={`space-y-3 min-w-0 ${className}`.trim()}>
      {title ? (
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{title}</p>
      ) : null}
      {PHASE_KEYS.map((phaseKey) => {
        const phase = phases[phaseKey]
        if (!phase) return null
        const items = (phase.items || []).map(normalizeItem)
        return (
          <div key={phaseKey} className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand">
              {phase.label || phaseKey.toUpperCase()}
            </p>
            <p className="text-[11px] font-semibold text-ink mt-0.5">{phase.title || '—'}</p>
            <p className="text-[10px] text-ink-muted mt-0.5">{phase.duration || '—'}</p>
            <div className="border-t border-surface-border my-2" />
            <ul className="space-y-1 text-[11px] text-ink-muted">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <li key={`${phaseKey}-${index}`} className="flex gap-1.5">
                    <span className="text-slate-300 shrink-0">·</span>
                    <span>
                      <span className="font-semibold text-ink-secondary">{item.name}</span>
                      {item.detail ? (
                        <span className="text-ink-muted">{`: ${item.detail}`}</span>
                      ) : null}
                    </span>
                  </li>
                ))
              ) : (
                <li className="flex gap-1.5">
                  <span className="text-slate-300">·</span>
                  <span>—</span>
                </li>
              )}
            </ul>
          </div>
        )
      })}
      {summary ? (
        <p className="text-[10px] text-ink-muted leading-relaxed px-1">{summary}</p>
      ) : null}
    </div>
  )
}
