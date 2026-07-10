'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'

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
      <div className="flex-1 min-h-0 overflow-hidden">
        <Report
          photo={photo}
          photos={photos}
          answers={answers}
          analysis={analysis}
          historyId={historyId}
          onRestart={onRestart}
          onRetryLocal={onRetryLocal}
          user={user}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
