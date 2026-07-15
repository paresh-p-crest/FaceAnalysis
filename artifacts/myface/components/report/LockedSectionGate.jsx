import { Lock } from 'lucide-react'
import { clientAwaitingReviewMessage } from '../../utils/reportWorkflow'

export function LockedSectionGate({ locked, children }) {
  if (!locked) return children

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
        <Lock className="w-7 h-7 text-amber-500" />
      </div>
      <div>
        <p className="font-display text-lg font-semibold text-ink mb-2">Section locked</p>
        <p className="text-sm text-ink-muted max-w-md leading-relaxed font-sans">
          {clientAwaitingReviewMessage()}
        </p>
      </div>
    </div>
  )
}
