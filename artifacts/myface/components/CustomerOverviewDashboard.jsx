'use client'

/**
 * Customer dashboard web view (`/dashboard`).
 *
 * This is NOT the protocol PDF / A4 HTML report preview. It reuses
 * `ProtocolReport` page 1 (`pageIndex={0}`, `paginated`, `webLayout`) for the
 * same content layout as the report cover, but rendered as a full-width web
 * dashboard under the Share/PDF top bar.
 *
 * - Entry: `app/[locale]/dashboard/page.jsx` → `CustomerOverviewDashboard`
 * - Layout CSS: `.report-protocol-dashboard-page--web` in `app/globals.css`
 * - Do not enable `webLayout` for admin/PDF protocol document viewers.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Loader2, Share2 } from 'lucide-react'
import { downloadAssessmentPdf, fetchAssessment, isBackendApiEnabled } from '../utils/apiClient'
import { resolveAssessmentFrontPhoto, resolveAssessmentPosePhotos } from '../utils/assessmentPhotos'
import { pickLocalizedNarratives } from '../utils/narrativeLocale'
import { formatProtocolId, getClientName } from '../utils/reportProtocolModel'
import { shareReportPage } from '../utils/reportShare'
import { canDownloadReportPdf } from '../utils/reportWorkflow'
import { translateApiError } from '../utils/translateApiError'
import { CustomerAssessmentGate } from './CustomerAssessmentGate'
import { StandalonePageShell } from './StandalonePageShell'
import ProtocolReport from './report/ProtocolReport'
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

  const localized = useMemo(
    () =>
      pickLocalizedNarratives(
        {
          aiNarrative: assessment?.aiNarrative || analysis?.aiNarrative || null,
          protocolNarrative: assessment?.protocolNarrative || null,
          featureNarratives: assessment?.featureNarratives || null,
        },
        locale,
        { t: tReport },
      ),
    [assessment, analysis, locale, tReport],
  )

  const clientName = getClientName(assessment?.answers, user, assessmentOwner)
  const protocolId = formatProtocolId(assessment?.id)
  const reportDate = (() => {
    const raw = assessment?.updatedAt || assessment?.createdAt
    if (!raw) return '—'
    const ms = Date.parse(raw)
    if (!Number.isFinite(ms)) return '—'
    return new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()

  const handleNavigate = useCallback((sectionId) => {
    if (!assessment) return
    onNavigateSection?.(assessment, sectionId)
  }, [assessment, onNavigateSection])

  const handleShare = useCallback(async () => {
    try {
      await shareReportPage(tReport('executiveSummary.shareTitle'))
    } catch {
      /* user cancelled */
    }
  }, [tReport])

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
            localized.protocolNarrative,
            localized.featureNarratives,
          ),
          answers: assessment.answers ?? null,
          eyeAnalysis: analysis?.eyeAnalysis ?? null,
          aiNarrative: localized.aiNarrative,
          user,
          assessmentOwner,
          projectedAfter: assessment.projectedAfter || analysis?.projectedAfter || null,
          projectedAnalysis: assessment.projectedAnalysis || analysis?.projectedAnalysis || null,
          assessmentId: assessment.id,
          createdAt: assessment.createdAt ?? null,
          updatedAt: assessment.updatedAt ?? null,
          pdfMessages,
          locale,
        })
      } else if (assessment.id && isBackendApiEnabled()) {
        await downloadAssessmentPdf(assessment.id, locale)
      } else {
        throw new Error(tReport('shell.pdfFailed'))
      }
    } catch (err) {
      console.error('PDF export failed:', err)
      if (assessment?.id && isBackendApiEnabled()) {
        try {
          await downloadAssessmentPdf(assessment.id, locale)
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
    localized,
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
      <div className="report-view-page report-view-page--overview py-2 sm:py-3 space-y-5 sm:space-y-6">
        {/* Keep current dashboard top bar (meta + Share / PDF) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-surface-border">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] min-w-0">
            <span className="font-bold uppercase tracking-[0.14em] text-ink">
              {tReport('executiveSummary.protocolLabel')}
            </span>
            <span className="hidden sm:inline-block w-px h-3.5 bg-surface-border" aria-hidden />
            <span className="text-ink-muted font-sans truncate">{clientName}</span>
            <span className="text-ink-muted font-mono shrink-0">#{protocolId}</span>
            <span className="text-ink-muted shrink-0">{reportDate}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!canDownloadPdf || pdfLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-surface-warm disabled:opacity-50"
              title={!canDownloadPdf ? tReport('shell.pdfAfterApproval') : tReport('shell.downloadPdf')}
            >
              {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {tReport('shell.downloadPdf')}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-brand/90"
            >
              <Share2 className="w-3 h-3" />
              {tReport('executiveSummary.shareButton')}
            </button>
          </div>
        </div>

        {/*
          Customer dashboard web view only: protocol page-1 content with webLayout.
          Report modal / PDF HTML preview must omit webLayout (A4 sheet + PDF header).
        */}
        <ProtocolReport
          photo={photo}
          photos={resolveAssessmentPosePhotos(assessment)}
          landmarks={analysis?.landmarks ?? null}
          cvReport={cvReport}
          metrics={analysis?.metrics ?? null}
          answers={assessment?.answers ?? null}
          user={user}
          assessmentOwner={assessmentOwner}
          eyeAnalysis={analysis?.eyeAnalysis ?? null}
          protocolNarrative={localized.protocolNarrative}
          aiNarrative={localized.aiNarrative}
          projectedAfter={assessment?.projectedAfter || analysis?.projectedAfter || null}
          projectedAnalysis={assessment?.projectedAnalysis || analysis?.projectedAnalysis || null}
          assessmentId={assessment.id}
          createdAt={assessment.createdAt ?? null}
          updatedAt={assessment.updatedAt ?? null}
          pageIndex={0}
          paginated
          webLayout
          onPriorityFeatureClick={handleNavigate}
        />
      </div>
    </StandalonePageShell>
  )
}

/** Customer home at `/dashboard` — web-view overview (not PDF report preview). */
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
