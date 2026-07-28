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
  sectionId = 'intro',
  onSectionChange = null,
  user,
  onRestart,
  onReportReady,
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
    <div
      className="fixed inset-0 z-30 flex flex-col"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      {withNavbarOffset && (
        <>
          {/* Clear the fixed navbar */}
          <div
            className="shrink-0"
            style={{ height: 'var(--site-navbar-height)' }}
            aria-hidden
          />
          {/* Mint gap between navbar and report */}
          <div
            className="shrink-0"
            style={{
              height: 'var(--site-navbar-gap)',
              backgroundColor: 'var(--color-surface)',
            }}
            aria-hidden
          />
        </>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Report
          key={cloudAssessment?.id || analysis?.assessmentId || historyId || 'report'}
          photo={photo}
          photos={photos}
          answers={answers}
          analysis={analysis}
          historyId={historyId}
          cloudAssessment={cloudAssessment}
          onCloudAssessmentChange={onCloudAssessmentChange}
          sectionId={sectionId}
          onSectionChange={onSectionChange}
          onRestart={onRestart}
          user={user}
          onClose={onClose}
          onReportReady={onReportReady}
        />
      </div>
    </div>
  )
}
