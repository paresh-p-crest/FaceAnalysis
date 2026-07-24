'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { downloadAssessmentPdf, fetchAssessment, isBackendApiEnabled } from '../utils/apiClient'
import { resolveAssessmentFrontPhoto, resolveAssessmentPosePhotos } from '../utils/assessmentPhotos'
import { canDownloadReportPdf } from '../utils/reportWorkflow'
import { ROUTES } from '../utils/routes'
import { translateApiError } from '../utils/translateApiError'
import { CustomerAssessmentGate } from './CustomerAssessmentGate'
import { StandalonePageShell } from './StandalonePageShell'
import { ExecutiveSummary } from './report/ExecutiveSummary'
import { useApp } from './providers/AppProvider'

function OverviewContent({ user, assessmentSummary, onNavigateSection }) {
  const t = useTranslations('Home')
  const tReport = useTranslations('Report')
  const tDash = useTranslations('Dashboard')
  const tErrors = useTranslations('Errors')
  const locale = useLocale()
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  const load = useCallback(async (isCancelled) => {
    const cancelled = typeof isCancelled === 'function' ? isCancelled : () => false
    if (!assessmentSummary?.id || !isBackendApiEnabled()) {
      if (!cancelled()) {
        setAssessment(assessmentSummary)
        setLoading(false)
      }
      return
    }
    if (!cancelled()) {
      setLoading(true)
      setError('')
    }
    try {
      const full = await fetchAssessment(assessmentSummary.id)
      if (cancelled()) return
      setAssessment(full)
    } catch (err) {
      if (cancelled()) return
      setError(translateApiError(err, tErrors))
      setAssessment(null)
    } finally {
      if (!cancelled()) setLoading(false)
    }
  }, [assessmentSummary, tErrors])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const analysis = assessment?.analysis || {}
  const cvReport = analysis?.cvReport || null
  const photo = resolveAssessmentFrontPhoto(assessment)
  const assessmentOwner = useMemo(() => {
    if (assessment?.ownerUser) return assessment.ownerUser
    if (user?.id && assessment?.userId && String(user.id) === String(assessment.userId)) return user
    return assessment?.userId ? { id: assessment.userId } : null
  }, [assessment, user])

  const handleNavigate = useCallback((sectionId) => {
    if (!assessment) return
    onNavigateSection?.(assessment, sectionId)
  }, [assessment, onNavigateSection])

  const isAdmin = user?.role === 'admin'
  const canDownloadPdf = canDownloadReportPdf(assessment?.status, true, isAdmin)
  const handleDownloadPdf = useCallback(async () => {
    if (!assessment || pdfLoading || !canDownloadPdf || !cvReport) return
    setPdfLoading(true)
    try {
      const posePhotos = resolveAssessmentPosePhotos(assessment)
      const frontPhoto = photo || posePhotos.front
      if (frontPhoto) {
        const { downloadMyFacePdf } = await import('../utils/reportPdf')
        const { mergeNarrativesForPdf } = await import('../utils/protocolSections')
        const messagesModule = locale === 'de'
          ? await import('../messages/de.json')
          : await import('../messages/en.json')
        const pdfMessages = messagesModule?.default || messagesModule
        await downloadMyFacePdf({
          photo: frontPhoto,
          photos: posePhotos,
          cvReport,
          metrics: analysis?.metrics ?? null,
          landmarks: analysis?.landmarks ?? null,
          protocolNarrative: mergeNarrativesForPdf(
            assessment.protocolNarrative,
            assessment.featureNarratives,
          ),
          answers: assessment.answers ?? null,
          eyeAnalysis: analysis?.eyeAnalysis ?? null,
          aiNarrative: assessment.aiNarrative || analysis?.aiNarrative || null,
          user,
          assessmentOwner,
          projectedAfter: assessment.projectedAfter || analysis?.projectedAfter || null,
          projectedAnalysis: assessment.projectedAnalysis || analysis?.projectedAnalysis || null,
          assessmentId: assessment.id,
          createdAt: assessment.createdAt ?? null,
          updatedAt: assessment.updatedAt ?? null,
          pdfMessages,
        })
      } else if (assessment.id && isBackendApiEnabled()) {
        await downloadAssessmentPdf(assessment.id)
      } else {
        throw new Error(tReport('shell.pdfFailed'))
      }
    } catch (err) {
      console.error('PDF export failed:', err)
      // Fallback: server PDF when client build fails (bad photo metadata, CORS, etc.)
      if (assessment?.id && isBackendApiEnabled()) {
        try {
          await downloadAssessmentPdf(assessment.id)
          return
        } catch (fallbackErr) {
          console.error('Backend PDF fallback failed:', fallbackErr)
        }
      }
      alert(err?.message || tReport('shell.pdfFailed'))
    } finally {
      setPdfLoading(false)
    }
  }, [
    assessment,
    pdfLoading,
    canDownloadPdf,
    cvReport,
    photo,
    analysis,
    user,
    assessmentOwner,
    locale,
    tReport,
  ])

  if (loading) {
    return (
      <StandalonePageShell scrollable compactTop>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Loader2 className="w-7 h-7 text-brand animate-spin mx-auto mb-3" />
            <p className="text-sm text-ink-muted">{t('loadingDashboard')}</p>
          </div>
        </div>
      </StandalonePageShell>
    )
  }

  if (error || !assessment || !cvReport) {
    return (
      <div className="min-h-screen flex items-center justify-center site-navbar-offset bg-surface px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700 mb-4">{error || tDash('loadFailed')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <StandalonePageShell scrollable compactTop>
      <div className="qoves-report-page qoves-report-page--overview py-2 sm:py-3">
        <ExecutiveSummary
          cvReport={cvReport}
          eyeAnalysis={analysis?.eyeAnalysis ?? null}
          aiNarrative={assessment?.aiNarrative || analysis?.aiNarrative || null}
          aiNarrativeLoading={false}
          protocolNarrative={assessment?.protocolNarrative || null}
          photo={photo}
          landmarks={analysis?.landmarks ?? null}
          metrics={analysis?.metrics ?? null}
          answers={assessment?.answers ?? null}
          user={user}
          assessmentOwner={assessmentOwner}
          projectedAfter={assessment?.projectedAfter || analysis?.projectedAfter || null}
          assessmentId={assessment.id}
          createdAt={assessment.createdAt ?? null}
          updatedAt={assessment.updatedAt ?? null}
          onNavigate={handleNavigate}
          reportHref={ROUTES.report}
          onDownloadPdf={handleDownloadPdf}
          pdfLoading={pdfLoading}
          canDownloadPdf={canDownloadPdf}
        />
      </div>
    </StandalonePageShell>
  )
}

/** Customer home at `/dashboard` — protocol overview (ExecutiveSummary) with shared gates. */
export default function CustomerOverviewDashboard({
  user,
  hasAnalysisAccess,
  accessReady,
  onStartAssessment,
  onResumeDraft,
  onStartCheckout,
  billingMessage = '',
}) {
  const t = useTranslations('Home')
  const { viewCloudAssessment } = useApp()

  const handleNavigateSection = useCallback(async (assessment, sectionId) => {
    await viewCloudAssessment(assessment, sectionId)
  }, [viewCloudAssessment])

  return (
    <CustomerAssessmentGate
      user={user}
      hasAnalysisAccess={hasAnalysisAccess}
      accessReady={accessReady}
      onStartAssessment={onStartAssessment}
      onResumeDraft={onResumeDraft}
      onStartCheckout={onStartCheckout}
      billingMessage={billingMessage}
      loadingLabel={t('loadingDashboard')}
    >
      {(latest) => (
        <OverviewContent
          user={user}
          assessmentSummary={latest}
          onNavigateSection={handleNavigateSection}
        />
      )}
    </CustomerAssessmentGate>
  )
}
