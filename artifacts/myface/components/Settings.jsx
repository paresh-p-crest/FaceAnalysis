import { X, Settings as SettingsIcon, Info, Cpu, ShieldCheck, Server } from 'lucide-react'

const STACK_ITEMS = [
  {
    icon: Cpu,
    title: 'Computer vision',
    desc: 'MediaPipe Face Landmarker + OpenCV geometry, run on the managed backend.',
  },
  {
    icon: Server,
    title: 'Analysis pipeline',
    desc: 'Photos are processed asynchronously (CV → parsing → narratives) after you submit.',
  },
  {
    icon: ShieldCheck,
    title: 'Care team review',
    desc: 'Every report is reviewed and approved by our team before it is released to you.',
  },
]

export default function Settings({ open, onClose }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-surface-card rounded-3xl p-6 sm:p-8 shadow-modal animate-scale-in max-h-[90vh] overflow-y-auto border border-surface-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">API Settings</h2>
              <p className="text-[11px] text-ink-muted mt-1">How your facial analysis is processed</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-warm text-ink-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-5 p-3 rounded-xl bg-surface-warm border border-surface-border flex gap-3">
          <Info className="w-4 h-4 text-brand shrink-0 mt-0.5" />
          <div className="text-xs text-ink-secondary leading-relaxed">
            Analysis runs entirely on our managed backend — no API keys or configuration required.
          </div>
        </div>

        <div className="space-y-3">
          {STACK_ITEMS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-surface-border bg-surface-warm/60 dark:bg-surface-raised/30 p-4 flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-brand" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="text-xs text-ink-secondary leading-relaxed mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex mt-8">
          <button onClick={onClose} className="btn-primary flex-1 text-sm">Close</button>
        </div>
      </div>
    </div>
  )
}
