'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { X } from 'lucide-react'

const Report = dynamic(() => import('../Report'), { ssr: false })

export function ReportModal({
  open,
  onClose,
  photo,
  photos,
  answers,
  analysis,
  historyId,
  user,
  onRestart,
  onRetryLocal,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-surface">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-card shrink-0">
        <h2 className="font-display text-sm font-semibold text-ink">Facial Analysis Report</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-xl text-ink-muted hover:text-ink hover:bg-surface-warm transition-colors"
          aria-label="Close report"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Report
          photo={photo}
          photos={photos}
          answers={answers}
          analysis={analysis}
          historyId={historyId}
          onRestart={onRestart}
          onRetryLocal={onRetryLocal}
          user={user}
        />
      </div>
    </div>
  )
}
