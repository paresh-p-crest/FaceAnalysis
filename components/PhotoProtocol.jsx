import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { PROTOCOL_ITEMS } from '../utils/protocolCheck'

export default function PhotoProtocol({ onComplete, onBack }) {
  const [checked, setChecked] = useState(() => Object.fromEntries(PROTOCOL_ITEMS.map((i) => [i.id, false])))

  const allChecked = PROTOCOL_ITEMS.every((i) => checked[i.id])

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }))

  const toggleAll = () => {
    const next = !allChecked
    setChecked(Object.fromEntries(PROTOCOL_ITEMS.map((i) => [i.id, next])))
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 animate-fade-up bg-surface">
      <div className="w-full max-w-xl">
        <h2 className="font-display text-3xl font-semibold text-ink mb-2">Photo Requirements</h2>
        <p className="text-ink-muted text-sm mb-8">
          Confirm each guideline so your analysis meets standard protocol.
        </p>

        <div className="bg-white dark:bg-surface-card rounded-3xl p-6 sm:p-8 shadow-card border border-surface-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Photo guidelines checklist
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-brand hover:text-brand/80 transition-colors"
            >
              {allChecked ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <ul className="space-y-3">
            {PROTOCOL_ITEMS.map((item) => {
              const on = checked[item.id]
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                    on
                      ? 'border-brand/50 bg-brand-50'
                      : 'border-surface-border bg-surface-warm hover:border-brand/20'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      on ? 'bg-brand border-brand' : 'border-surface-border'
                    }`}
                  >
                    {on && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-sm text-ink-secondary">{item.label}</span>
                </button>
              )
            })}
          </ul>

          {!allChecked && (
            <p className="text-xs text-amber-600 mt-4">
              Check all items to continue. Uploading without protocol (e.g. with glasses) reduces accuracy.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-8">
          <button onClick={onBack} className="btn-ghost text-sm">
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onComplete}
            disabled={!allChecked}
            className="btn-primary text-sm disabled:opacity-40 disabled:pointer-events-none"
          >
            Continue to Upload
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
