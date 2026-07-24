'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { RotateCcw, Loader2, AlertTriangle, Lock } from 'lucide-react'
import { saveHistoryEntry, createHistoryId, loadHistory } from '../utils/historyStorage'
import {
  downloadAssessmentPdf,
  fetchAssessment,
  fetchAssessmentProtocol,
  fetchMyAssessments,
  isBackendApiEnabled,
  updateAssessmentStatus,
} from '../utils/apiClient'
import {
  canClientViewFullReport,
  canDownloadReportPdf,
  isAssessmentSubmitted,
  isDevAutoApproveEnabled,
  isReportApproved,
  isAssessmentProcessing,
  normalizeReportStatus,
} from '../utils/reportWorkflow'
import { ReportDocumentLayout } from './report/ReportDocumentLayout'
import { LockedSectionGate } from './report/LockedSectionGate'
import {
  isPublicSection,
  INTRO_SECTIONS,
  ASSESSMENT_SECTIONS,
  FEATURE_SECTIONS,
  PROTOCOL_SECTIONS,
} from './report/reportNavConfig'
import { CvReportView } from './report/CvReportView'
import { PastAssessmentsPanel } from './report/PastAssessmentsPanel'
import AdminReviewPanel from './AdminReviewPanel'
import ConfirmDialog from './ConfirmDialog'
import { useApp } from './providers/AppProvider'

function ErrorPanel({ title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink mb-2">{title}</h3>
      <p className="text-ink-muted text-sm max-w-md leading-relaxed font-sans">{message}</p>
    </div>
  )
}

function getCvLabel(analysis, metrics) {
  if (analysis?.cvEngine === 'local-cv') return 'MediaPipe + OpenCV (free)'
  if (analysis?.cvEngine === 'mediapipe+opencv') {
    return `MediaPipe (${metrics?.landmarkCount || 478} pts) + OpenCV`
  }
  return '—'
}

const STATUS_META_KEYS = {
  pending_review: { labelKey: 'shell.pendingReview', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { labelKey: 'shell.approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

function StatusBadge({ status }) {
  const t = useTranslations('Report')
  const normalized = normalizeReportStatus(status)
  const meta = STATUS_META_KEYS[normalized] || STATUS_META_KEYS.pending_review
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${meta.className}`}>
      {t(meta.labelKey)}
    </span>
  )
}

export default function Report({
  photo,
  photos,
  answers,
  analysis,
  historyId,
  cloudAssessment = null,
  onCloudAssessmentChange = null,
  sectionId = 'intro',
  onSectionChange = null,
  onRestart,
  user,
  onClose,
}) {
  const t = useTranslations('Report')
  const locale = useLocale()
  const { setReportToolbar, adminWorkspace, viewCloudAssessment, openingReportId } = useApp()
  const [protocolNarrative, setProtocolNarrative] = useState(null)
  const [featureNarratives, setFeatureNarratives] = useState(null)
  const [featureParsing, setFeatureParsing] = useState(null)
  const [projectedAfter, setProjectedAfter] = useState(null)
  const [projectedAnalysis, setProjectedAnalysis] = useState(null)
  const [protocolLoading, setProtocolLoading] = useState(false)
  const [protocolError, setProtocolError] = useState('')
  const [aiNarrative, setAiNarrative] = useState(null)
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false)
  const [aiNarrativeError, setAiNarrativeError] = useState('')
  const [aiVisuals, setAiVisuals] = useState(null)
  const [sessionId] = useState(() => createHistoryId())
  const [pdfLoading, setPdfLoading] = useState(false)
  const [statusOverride, setStatusOverride] = useState('')
  const [statusUpdating, setStatusUpdating] = useState('')
  const [adminAssessment, setAdminAssessment] = useState(null)
  const [adminView, setAdminView] = useState(null) // null | 'images' — admin-only generated-images overlay
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [pastAssessmentsOpen, setPastAssessmentsOpen] = useState(false)
  const [showPastAssessmentsNav, setShowPastAssessmentsNav] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState(sectionId || 'intro')
  const nlHydratedForId = useRef(null)

  const handlePastAssessments = useCallback(() => {
    setPastAssessmentsOpen(true)
  }, [])

  const handleSelectPastAssessment = useCallback(async (item) => {
    setPastAssessmentsOpen(false)
    await viewCloudAssessment(item)
  }, [viewCloudAssessment])

  const historyEntry = useMemo(() => {
    if (!historyId) return null
    return loadHistory().find((h) => h.id === historyId) || null
  }, [historyId])

  const isFromHistory = !!historyEntry
  const displayPhoto = historyEntry?.photo ?? photo
  const displayAnalysis = historyEntry?.analysis ?? analysis
  const displayAnswers = historyEntry?.answers ?? answers
  const cvReport = historyEntry?.cvReport ?? displayAnalysis?.cvReport ?? null
  const isSavedAssessment = !!(displayAnalysis?.savedToDb || displayAnalysis?.assessmentId || historyEntry?.assessmentId)
  const cvFailed = !isFromHistory && !!displayAnalysis && !isSavedAssessment
    && (displayAnalysis.success === false || !!displayAnalysis.error)
  const hasRenderableCvReport = !!(
    cvReport?.faceShape
    || cvReport?.nose
    || cvReport?.eyes
    || cvReport?.features
    || cvReport?.symmetry?.summary
    || cvReport?.proportions?.summary
  )
  const isProcessing = isAssessmentProcessing(displayAnalysis) || displayAnalysis?.pipeline?.status === 'queued' || displayAnalysis?.pipeline?.status === 'running'
  const cvPending = !isFromHistory && !hasRenderableCvReport && !cvFailed && !!displayAnalysis && !isProcessing
  const metrics = displayAnalysis?.metrics
  const landmarks = displayAnalysis?.landmarks
  const eyeAnalysis = historyEntry?.eyeAnalysis ?? displayAnalysis?.eyeAnalysis ?? null
  const cvLabel = historyEntry?.cvLabel ?? getCvLabel(displayAnalysis, metrics)
  const showQovesReport = hasRenderableCvReport
  const reportStatus = normalizeReportStatus(statusOverride || historyEntry?.reportStatus || displayAnalysis?.reportStatus)
  const assessmentId = displayAnalysis?.assessmentId || historyEntry?.assessmentId
  const requiresApproval = !!displayAnalysis?.savedToDb || !!displayAnalysis?.assessmentId || !!historyEntry?.assessmentId
  const isAdmin = user?.role === 'admin'
  const isUser = !isAdmin
  const canDownloadPdf = canDownloadReportPdf(reportStatus, requiresApproval, isAdmin)
  const clientReportLocked = isUser && requiresApproval && !canClientViewFullReport(reportStatus, false)

  useEffect(() => {
    // Admins review one assessment at a time; platform-wide past list is noise.
    if (!user || isAdmin || !isBackendApiEnabled() || !showQovesReport) {
      setShowPastAssessmentsNav(false)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const items = await fetchMyAssessments(30)
        if (cancelled) return
        const submitted = (Array.isArray(items) ? items : []).filter(isAssessmentSubmitted)
        setShowPastAssessmentsNav(submitted.length > 1)
      } catch {
        if (!cancelled) setShowPastAssessmentsNav(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, isAdmin, showQovesReport])

  const sectionIds = useMemo(() => {
    return [
      ...INTRO_SECTIONS,
      ...ASSESSMENT_SECTIONS,
      ...FEATURE_SECTIONS,
      ...PROTOCOL_SECTIONS,
    ].map((section) => section.id)
  }, [])

  useEffect(() => {
    if (!sectionIds.includes(activeSectionId)) {
      setActiveSectionId(sectionIds[0] || 'intro')
    }
  }, [sectionIds, activeSectionId])

  useEffect(() => {
    if (sectionId && sectionIds.includes(sectionId) && sectionId !== activeSectionId) {
      setActiveSectionId(sectionId)
    }
  }, [sectionId, sectionIds])

  const selectSection = useCallback((id) => {
    setActiveSectionId(id)
    onSectionChange?.(id)
  }, [onSectionChange])

  useEffect(() => {
    if (!isAdmin || !assessmentId || !isBackendApiEnabled()) {
      setAdminAssessment(null)
      setAdminView(null)
      return
    }
    // Reuse the same full GET that opened the report (admin / dashboard).
    if (cloudAssessment?.id === assessmentId) {
      setAdminAssessment(cloudAssessment)
      return
    }
    fetchAssessment(assessmentId)
      .then(setAdminAssessment)
      .catch(() => setAdminAssessment(null))
  }, [isAdmin, assessmentId, cloudAssessment])

  useEffect(() => {
    if (isReportApproved(reportStatus) || !isAdmin) setAdminView(null)
  }, [reportStatus, isAdmin])

  const handleAdminReviewSaved = useCallback((updated) => {
    if (!updated) return
    setAdminAssessment(updated)
    onCloudAssessmentChange?.(updated)
    setStatusOverride(updated.status || '')
    if (updated.aiNarrative) setAiNarrative(updated.aiNarrative)
    if (updated.protocolNarrative) setProtocolNarrative(updated.protocolNarrative)
    if (updated.featureNarratives) setFeatureNarratives(updated.featureNarratives)
    if (updated.projectedAfter) setProjectedAfter(updated.projectedAfter)
    if (updated.projectedAnalysis) setProjectedAnalysis(updated.projectedAnalysis)
    if (updated.aiVisuals) setAiVisuals(updated.aiVisuals)
  }, [onCloudAssessmentChange])

  const showAdminTools = isAdmin && !!assessmentId && !isReportApproved(reportStatus)
  const toggleAdminView = useCallback((next) => {
    setAdminView((prev) => (prev === next ? null : next))
  }, [])

  const assessmentRecord = cloudAssessment || adminAssessment
  const assessmentCreatedAt = assessmentRecord?.createdAt ?? null
  const assessmentUpdatedAt = assessmentRecord?.updatedAt ?? null
  // Subject who took the analysis — not the viewer (admin may open others' reports)
  const assessmentOwner = useMemo(() => {
    if (assessmentRecord?.ownerUser) return assessmentRecord.ownerUser
    const uid = assessmentRecord?.userId
    if (!uid) return null
    const fromWorkspace = adminWorkspace?.users?.find((u) => u.id === uid)
    if (fromWorkspace) return fromWorkspace
    if (user?.id && String(user.id) === String(uid)) return user
    return { id: uid }
  }, [assessmentRecord, adminWorkspace?.users, user])

  const handleDownloadPdf = useCallback(async () => {
    const canUseBackendPdf = assessmentId && displayAnalysis?.savedToDb && isBackendApiEnabled()
    if (!cvReport || pdfLoading || !canDownloadPdf || (!displayPhoto && !canUseBackendPdf)) return
    setPdfLoading(true)
    try {
      if (displayPhoto) {
        const { downloadMyFacePdf } = await import('../utils/reportPdf')
        const { mergeNarrativesForPdf } = await import('../utils/protocolSections')
        const messagesModule = locale === 'de'
          ? await import('../messages/de.json')
          : await import('../messages/en.json')
        await downloadMyFacePdf({
          photo: displayPhoto,
          photos,
          cvReport,
          metrics,
          landmarks,
          protocolNarrative: mergeNarrativesForPdf(protocolNarrative, featureNarratives),
          answers: displayAnswers,
          eyeAnalysis,
          aiNarrative,
          user,
          assessmentOwner,
          projectedAfter,
          projectedAnalysis,
          assessmentId,
          createdAt: assessmentCreatedAt,
          updatedAt: assessmentUpdatedAt,
          pdfMessages: messagesModule.default,
        })
      } else if (canUseBackendPdf) {
        await downloadAssessmentPdf(assessmentId)
      }
    } catch (err) {
      console.error('PDF export failed:', err)
      alert(err?.message || t('shell.pdfFailed'))
    } finally {
      setPdfLoading(false)
    }
  }, [displayPhoto, photos, cvReport, metrics, landmarks, protocolNarrative, featureNarratives, displayAnswers, eyeAnalysis, aiNarrative, pdfLoading, canDownloadPdf, assessmentId, displayAnalysis, user, assessmentOwner, projectedAfter, projectedAnalysis, locale, t, assessmentCreatedAt, assessmentUpdatedAt])

  useEffect(() => {
    if (!showQovesReport) {
      setReportToolbar(null)
      return undefined
    }
    setReportToolbar({
      onDownloadPdf: handleDownloadPdf,
      pdfLoading,
      canDownloadPdf,
      showAdminTools,
      adminView,
      onToggleAdminView: toggleAdminView,
      canApprove: showAdminTools && !!assessmentId && !isReportApproved(reportStatus),
      onApprove: () => setApproveConfirmOpen(true),
      statusUpdating,
    })
    return () => setReportToolbar(null)
  }, [
    showQovesReport,
    handleDownloadPdf,
    pdfLoading,
    canDownloadPdf,
    setReportToolbar,
    showAdminTools,
    adminView,
    toggleAdminView,
    assessmentId,
    reportStatus,
    statusUpdating,
  ])

  const persistHistory = useCallback(
    (content, source, error) => {
      const label = showQovesReport
        ? `AuraScan report · ${cvReport?.overall?.score ?? cvReport?.symmetry?.score ?? '—'} overall`
        : `Analysis · ${metrics?.harmonyScore ?? '—'}/100 harmony`

      if (assessmentId || displayAnalysis?.savedToDb) {
        saveHistoryEntry({
          id: sessionId,
          createdAt: new Date().toISOString(),
          answers: displayAnswers,
          analysis: {
            success: displayAnalysis?.success,
            savedToDb: displayAnalysis?.savedToDb,
            assessmentId,
            reportStatus,
            cvEngine: displayAnalysis?.cvEngine,
            activeProvider: displayAnalysis?.activeProvider,
            metrics,
          },
          reportSource: source,
          reportError: error,
          cvLabel,
          assessmentId,
          savedToDb: true,
          reportStatus,
          label,
        })
        return
      }

      saveHistoryEntry({
        id: sessionId,
        createdAt: new Date().toISOString(),
        photo: displayPhoto,
        photos,
        answers: displayAnswers,
        analysis: displayAnalysis,
        eyeAnalysis,
        cvReport,
        cvLabel,
        assessmentId,
        savedToDb: displayAnalysis?.savedToDb,
        reportStatus,
        aiNarrative,
        aiVisuals,
        protocolNarrative,
        featureNarratives,
        label: showQovesReport
          ? `MyFace report · ${cvReport?.overall?.score ?? cvReport?.symmetry?.score ?? '—'} overall`
          : `Analysis · ${metrics?.harmonyScore ?? '—'}/100 harmony`,
      }).catch((err) => {
        console.warn('[MyFace] Could not persist analysis history:', err)
      })
    },
    [sessionId, displayPhoto, photos, displayAnswers, displayAnalysis, cvLabel, metrics, eyeAnalysis, cvReport, showQovesReport, reportStatus, assessmentId, aiNarrative, aiVisuals, protocolNarrative, featureNarratives]
  )

  useEffect(() => {
    if (!showQovesReport || !cvReport) return
    persistHistory()
  }, [showQovesReport, cvReport, persistHistory])

  useEffect(() => {
    nlHydratedForId.current = null
  }, [assessmentId])

  useEffect(() => {
    setAiNarrative(historyEntry?.aiNarrative || displayAnalysis?.aiNarrative || null)
    setAiNarrativeError('')
    setAiVisuals(historyEntry?.aiVisuals || displayAnalysis?.aiVisuals || null)
    setProtocolNarrative(historyEntry?.protocolNarrative || displayAnalysis?.protocolNarrative || null)
    setFeatureNarratives(historyEntry?.featureNarratives || displayAnalysis?.featureNarratives || null)
    setFeatureParsing(historyEntry?.featureParsing || displayAnalysis?.featureParsing || null)
    setProjectedAfter(historyEntry?.projectedAfter || displayAnalysis?.projectedAfter || null)
    setProjectedAnalysis(historyEntry?.projectedAnalysis || displayAnalysis?.projectedAnalysis || null)
    setProtocolError('')
  }, [historyEntry, displayAnalysis, assessmentId])

  // Hydrate NL from the open-path payload when available; otherwise one GET (legacy / incomplete).
  useEffect(() => {
    if (!showQovesReport || !assessmentId || !isBackendApiEnabled()) return
    if (nlHydratedForId.current === assessmentId) return

    const applyPacked = (full) => {
      if (!full) return
      if (full.aiNarrative) setAiNarrative(full.aiNarrative)
      if (full.protocolNarrative) setProtocolNarrative(full.protocolNarrative)
      if (full.featureNarratives) setFeatureNarratives(full.featureNarratives)
      if (full.featureParsing) setFeatureParsing(full.featureParsing)
      if (full.projectedAfter) setProjectedAfter(full.projectedAfter)
      if (full.projectedAnalysis) setProjectedAnalysis(full.projectedAnalysis)
    }

    // Prefer the same full assessment already loaded when opening the report.
    if (cloudAssessment?.id === assessmentId) {
      applyPacked(cloudAssessment)
      nlHydratedForId.current = assessmentId
      return
    }

    // HydrateFromCloudAssessment already seeded displayAnalysis — skip GET if enrichment is present.
    const fromAnalysis = {
      aiNarrative: displayAnalysis?.aiNarrative,
      protocolNarrative: displayAnalysis?.protocolNarrative,
      featureNarratives: displayAnalysis?.featureNarratives,
      featureParsing: displayAnalysis?.featureParsing,
      projectedAfter: displayAnalysis?.projectedAfter,
      projectedAnalysis: displayAnalysis?.projectedAnalysis,
    }
    if (
      fromAnalysis.aiNarrative
      || fromAnalysis.protocolNarrative
      || fromAnalysis.featureNarratives
      || fromAnalysis.featureParsing
      || fromAnalysis.projectedAfter
      || fromAnalysis.projectedAnalysis
    ) {
      applyPacked(fromAnalysis)
      nlHydratedForId.current = assessmentId
      return
    }

    let cancelled = false
    ;(async () => {
      const needsNarrative = !aiNarrative
      const needsProtocol = !protocolNarrative || !featureNarratives
      if (needsNarrative) setAiNarrativeLoading(true)
      if (needsProtocol) setProtocolLoading(true)
      setAiNarrativeError('')
      setProtocolError('')
      try {
        const full = await fetchAssessment(assessmentId)
        if (cancelled) return
        if (needsNarrative) setAiNarrative(full?.aiNarrative || null)
        if (!protocolNarrative && full?.protocolNarrative) {
          setProtocolNarrative(full.protocolNarrative)
        }
        if (!featureNarratives && full?.featureNarratives) {
          setFeatureNarratives(full.featureNarratives)
        }
        if (full?.featureParsing) setFeatureParsing(full.featureParsing)
        if (full?.projectedAfter) setProjectedAfter(full.projectedAfter)
        if (full?.projectedAnalysis) setProjectedAnalysis(full.projectedAnalysis)
        const stillNeedsProtocol = !protocolNarrative && !full?.protocolNarrative
        const stillNeedsFeatures = !featureNarratives && !full?.featureNarratives
        if (stillNeedsProtocol || stillNeedsFeatures) {
          try {
            const bundle = await fetchAssessmentProtocol(assessmentId)
            if (!cancelled) {
              if (stillNeedsProtocol) setProtocolNarrative(bundle?.protocolNarrative || null)
              if (stillNeedsFeatures) setFeatureNarratives(bundle?.featureNarratives || null)
            }
          } catch (err) {
            if (!cancelled && err.status !== 404) {
              setProtocolError(err.message || 'Protocol unavailable')
            }
          }
        }
      } catch (err) {
        if (!cancelled && needsNarrative) {
          setAiNarrativeError(err.message || 'AI narrative unavailable')
        }
      } finally {
        if (!cancelled) {
          nlHydratedForId.current = assessmentId
          setAiNarrativeLoading(false)
          setProtocolLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [showQovesReport, assessmentId, cloudAssessment, displayAnalysis, aiNarrative, protocolNarrative, featureNarratives])

  const confirmAdminApprove = useCallback(async () => {
    if (!assessmentId || statusUpdating) return
    setApproveConfirmOpen(false)
    setStatusUpdating('approved')
    try {
      const updated = await updateAssessmentStatus(assessmentId, 'approved')
      setStatusOverride(updated?.status || 'approved')
      setAdminAssessment((prev) => (prev ? { ...prev, status: updated?.status || 'approved' } : prev))
    } catch (err) {
      alert(err?.message || 'Could not approve report')
    } finally {
      setStatusUpdating('')
    }
  }, [assessmentId, statusUpdating])

  if (cvFailed) {
    return (
      <div className="min-h-screen px-4 sm:px-6 py-8 animate-fade-up font-sans pt-16 bg-surface">
        <div className="max-w-xl mx-auto mt-12">
          <div className="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-card border border-surface-border">
            <ErrorPanel title={t('shell.analysisFailed')} message={displayAnalysis?.error || t('shell.analysisFailedMessage')} />
            <button onClick={onRestart} className="btn-primary w-full mt-3 text-sm font-display">
              <RotateCcw className="w-4 h-4" />
              {t('shell.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col animate-fade-up font-sans bg-surface text-ink relative">
      {isDevAutoApproveEnabled && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9998] rounded-full border-2 border-amber-400 bg-amber-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-900 shadow-lg shadow-amber-500/30">
          {t('shell.devBypass')}
        </div>
      )}

      <div className="report-shell-body report-shell-inner">
        {displayAnalysis?.protocolWarnings?.length > 0 && (
          <div className="mb-3 shrink-0 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-display font-semibold text-amber-700 mb-2">{t('shell.protocolWarnings')}</p>
            <ul className="space-y-1.5">
              {displayAnalysis.protocolWarnings.map((w) => (
                <li key={w.id} className="text-xs text-amber-600 font-sans">• {w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {clientReportLocked && (
          <div className="mb-3 shrink-0 p-5 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-display font-semibold text-amber-800 mb-1">{t('shell.reportUnderReview')}</p>
                <p className="text-xs text-amber-700 font-sans leading-relaxed">{t('locked.awaitingReview')}</p>
              </div>
            </div>
          </div>
        )}

        {protocolError && (
          <div className="mb-3 shrink-0 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
            {protocolError}
          </div>
        )}

        {showQovesReport ? (
          <div className="flex-1 min-h-0">
            <ReportDocumentLayout
              activeId={activeSectionId}
              onSelect={selectSection}
              sidebarFooter={showPastAssessmentsNav ? {
                label: t('nav.pastAssessments'),
                onClick: handlePastAssessments,
              } : null}
            >
              <LockedSectionGate
                locked={clientReportLocked && !isPublicSection(activeSectionId)}
              >
                <CvReportView
                  activeId={activeSectionId}
                  cvReport={cvReport}
                  eyeAnalysis={eyeAnalysis}
                  protocolNarrative={protocolNarrative}
                  featureNarratives={featureNarratives}
                  featureParsing={featureParsing}
                  projectedAfter={projectedAfter}
                  projectedAnalysis={projectedAnalysis}
                  protocolLoading={protocolLoading}
                  aiNarrative={aiNarrative}
                  photo={displayPhoto}
                  photos={photos}
                  landmarks={landmarks}
                  metrics={metrics}
                  answers={displayAnswers}
                  user={user}
                  assessmentOwner={assessmentOwner}
                  assessmentId={assessmentId}
                  createdAt={assessmentCreatedAt}
                  updatedAt={assessmentUpdatedAt}
                  onDownloadPdf={handleDownloadPdf}
                  pdfLoading={pdfLoading}
                  canDownloadPdf={canDownloadPdf}
                  showAdminEdit={showAdminTools}
                  adminAssessment={adminAssessment}
                  onNarrativesSaved={handleAdminReviewSaved}
                  onNavigate={selectSection}
                />
              </LockedSectionGate>
            </ReportDocumentLayout>
          </div>
        ) : isProcessing ? (
          <div className="max-w-lg mx-auto px-4">
            <div className="bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border text-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-4" />
              <p className="font-display text-base font-semibold text-ink mb-2">{t('shell.analysisPreparing')}</p>
              <p className="text-sm text-ink-muted">{t('shell.analysisPreparingHint')}</p>
            </div>
          </div>
        ) : cvPending ? (
          <div className="max-w-lg mx-auto px-4">
            <div className="bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border text-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-4" />
              <p className="text-sm text-ink-muted">{t('shell.buildingReport')}</p>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto px-4">
            <ErrorPanel
              title={t('shell.reportUnavailable')}
              message={displayAnalysis?.error || t('shell.reportUnavailableMessage')}
            />
          </div>
        )}
      </div>

      {showAdminTools && adminView && (adminAssessment || cloudAssessment) && (
        <AdminReviewPanel
          view={adminView}
          assessment={adminAssessment || cloudAssessment}
          onClose={() => setAdminView(null)}
          onSaved={handleAdminReviewSaved}
        />
      )}

      <ConfirmDialog
        open={approveConfirmOpen}
        title={t('shell.approveTitle')}
        message={t('shell.approveMessage')}
        confirmLabel={t('shell.approve')}
        onConfirm={confirmAdminApprove}
        onCancel={() => setApproveConfirmOpen(false)}
      />

      {showPastAssessmentsNav ? (
        <PastAssessmentsPanel
          open={pastAssessmentsOpen}
          onClose={() => setPastAssessmentsOpen(false)}
          onSelect={handleSelectPastAssessment}
          user={user}
          currentAssessmentId={assessmentId}
          openingReportId={openingReportId}
        />
      ) : null}
    </div>
  )
}
