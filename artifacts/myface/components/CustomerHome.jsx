'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { CustomerAssessmentGate } from './CustomerAssessmentGate'

/**
 * Customer `/report` launcher — opens the full report modal when latest assessment is ready.
 * Gates (billing, draft, start, preparing) match `/dashboard`.
 */
export default function CustomerHome({
  user,
  hasAnalysisAccess,
  accessReady,
  onStartAssessment,
  onResumeDraft,
  onStartCheckout,
  billingMessage = '',
  onViewCloudItem,
  openingReportId = null,
}) {
  const t = useTranslations('Home')

  return (
    <CustomerAssessmentGate
      user={user}
      hasAnalysisAccess={hasAnalysisAccess}
      accessReady={accessReady}
      onStartAssessment={onStartAssessment}
      onResumeDraft={onResumeDraft}
      onStartCheckout={onStartCheckout}
      billingMessage={billingMessage}
      loadingLabel={t('loadingReport')}
    >
      {(latest) => (
        <ReportLauncher
          latest={latest}
          onViewCloudItem={onViewCloudItem}
          openingReportId={openingReportId}
          t={t}
        />
      )}
    </CustomerAssessmentGate>
  )
}

function ReportLauncher({ latest, onViewCloudItem, openingReportId, t }) {
  const [openedId, setOpenedId] = useState('')

  useEffect(() => {
    if (!latest?.id) return undefined
    if (openedId === latest.id || openingReportId === latest.id) return undefined
    let active = true
    setOpenedId(latest.id)
    if (active) onViewCloudItem?.(latest)
    return () => {
      active = false
    }
  }, [latest, openedId, openingReportId, onViewCloudItem])

  return (
    <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface">
      <div className="text-center">
        {openingReportId === latest.id ? (
          <>
            <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
            <p className="text-sm text-ink-muted">{t('openingReport')}</p>
          </>
        ) : (
          <p className="text-sm text-ink-muted">{t('reportReadyHint')}</p>
        )}
      </div>
    </div>
  )
}
