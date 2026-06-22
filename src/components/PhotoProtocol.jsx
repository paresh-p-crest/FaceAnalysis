import { useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { PROTOCOL_ITEMS } from '../utils/protocolCheck'

export default function PhotoProtocol({ onComplete, onBack }) {
  const [checked, setChecked] = useState(() => Object.fromEntries(PROTOCOL_ITEMS.map((i) => [i.id, false])))

  const allChecked = PROTOCOL_ITEMS.every((i) => checked[i.id])

  const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 animate-fade-up">
      <div className="w-full max-w-xl">
        <h2 className="font-display text-3xl font-semibold text-white mb-2">Photo Requirements</h2>
        <p className="text-slate-500 text-sm mb-8">
          Confirm each guideline so your analysis meets standard protocol.
        </p>

        <div className="glass rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-4">
            Photo guidelines checklist
          </p>

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
                      ? 'border-accent/50 bg-accent/[0.06]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      on ? 'bg-accent border-accent' : 'border-white/25'
                    }`}
                  >
                    {on && <Check className="w-3 h-3 text-surface" />}
                  </div>
                  <span className="text-sm text-slate-200">{item.label}</span>
                </button>
              )
            })}
          </ul>

          {!allChecked && (
            <p className="text-xs text-amber-400/90 mt-4">
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
