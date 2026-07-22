'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'

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
}) {
  const t = useTranslations('Report.shell')
  const isAdmin = user?.role === 'admin'

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
          {/* Mint gap between navbar and report — admin close lives here */}
          <div
            className="shrink-0 flex items-center justify-end px-4 sm:px-6 lg:px-8"
            style={{
              minHeight: isAdmin ? '2rem' : 'var(--site-navbar-gap)',
              height: isAdmin ? '2rem' : 'var(--site-navbar-gap)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {isAdmin && onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink bg-transparent border-0 p-0 shadow-none"
                aria-label={t('closeReport')}
              >
                <X className="w-4 h-4" strokeWidth={2} aria-hidden />
                <span>{t('closeReport')}</span>
              </button>
            ) : null}
          </div>
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
        />
      </div>
    </div>
  )
}
