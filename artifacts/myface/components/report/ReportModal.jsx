'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'

const Report = dynamic(() => import('../Report'), { ssr: false })

export function ReportModal({
  open,
  onClose,
  withNavbarOffset = false,
  photo,
  photos,
  answers,
  analysis,
  historyId,
  cloudAssessment = null,
  onCloudAssessmentChange = null,
  user,
  onRestart,
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

  // When the site navbar is present (dashboard/history/admin), sit below it and
  // beneath its stacking order so the navbar stays visible and usable (including
  // the mobile menu). On navbar-less routes (e.g. /analysis) fall back to a
  // full-viewport overlay.
  const containerClass = withNavbarOffset
    ? 'fixed inset-x-0 bottom-0 top-[var(--site-navbar-height)] z-30 flex flex-col bg-surface'
    : 'fixed inset-0 z-[200] flex flex-col bg-surface'

  return (
    <div className={containerClass}>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Report
          photo={photo}
          photos={photos}
          answers={answers}
          analysis={analysis}
          historyId={historyId}
          cloudAssessment={cloudAssessment}
          onCloudAssessmentChange={onCloudAssessmentChange}
          onRestart={onRestart}
          user={user}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
