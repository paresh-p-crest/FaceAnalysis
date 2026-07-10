import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { ScanFace, RotateCcw, Loader2, AlertTriangle, Download, Lock, ShieldCheck, X } from 'lucide-react'
import { saveHistoryEntry, createHistoryId, loadHistory } from '../utils/historyStorage'
import {
  downloadAssessmentPdf,
  fetchAssessment,
  fetchAssessmentProtocol,
  fetchAssistantConversation,
  generateAssessmentVisuals,
  isBackendApiEnabled,
  sendAssistantMessage,
  updateAssessmentStatus,
} from '../utils/apiClient'
import {
  canClientViewFullReport,
  canDownloadReportPdf,
  clientAwaitingReviewMessage,
  isDevAutoApproveEnabled,
  isReportApproved,
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
  TOOL_SECTIONS,
} from './report/reportNavConfig'
import { CvReportView } from './report/CvReportView'
import { runFaceAnalysis } from '../utils/analyzeFace'
import AdminReviewPanel from './AdminReviewPanel'
import ConfirmDialog from './ConfirmDialog'

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
  if (analysis?.cvEngine === 'aws') return 'AWS Rekognition'
  if (analysis?.cvEngine === 'local-cv') return 'MediaPipe + OpenCV (free)'
  if (analysis?.cvEngine === 'mediapipe+opencv') {
    return `MediaPipe (${metrics?.landmarkCount || 478} pts) + OpenCV`
  }
  return '—'
}

const STATUS_META = {
  pending_review: { label: 'Pending review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
}

function StatusBadge({ status }) {
  const normalized = normalizeReportStatus(status)
  const meta = STATUS_META[normalized] || STATUS_META.pending_review
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  )
}

export default function Report({ photo, photos, answers, analysis, historyId, onRestart, onRetryLocal, user, onClose }) {
  const [protocolData, setProtocolData] = useState(null)
  const [protocolNarrative, setProtocolNarrative] = useState(null)
  const [protocolLoading, setProtocolLoading] = useState(false)
  const [protocolError, setProtocolError] = useState('')
  const [aiNarrative, setAiNarrative] = useState(null)
  const [aiNarrativeLoading, setAiNarrativeLoading] = useState(false)
  const [aiNarrativeError, setAiNarrativeError] = useState('')
  const [aiVisuals, setAiVisuals] = useState(null)
  const [aiVisualsLoading, setAiVisualsLoading] = useState(false)
  const [aiVisualsError, setAiVisualsError] = useState('')
  const [sessionId] = useState(() => createHistoryId())
  const [pdfLoading, setPdfLoading] = useState(false)
  const [statusOverride, setStatusOverride] = useState('')
  const [statusUpdating, setStatusUpdating] = useState('')
  const [adminAssessment, setAdminAssessment] = useState(null)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState('intro')
  const nlHydratedForId = useRef(null)

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
  const cvPending = !isFromHistory && !hasRenderableCvReport && !cvFailed && !!displayAnalysis
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
  const canDownloadPdf = canDownloadReportPdf(reportStatus, requiresApproval)
  const clientReportLocked = isUser && requiresApproval && !canClientViewFullReport(reportStatus, false)

  const sectionIds = useMemo(() => {
    return [
      ...INTRO_SECTIONS,
      ...ASSESSMENT_SECTIONS,
      ...FEATURE_SECTIONS,
      ...PROTOCOL_SECTIONS,
      ...TOOL_SECTIONS,
    ].map((section) => section.id)
  }, [])

  useEffect(() => {
    if (!sectionIds.includes(activeSectionId)) {
      setActiveSectionId(sectionIds[0] || 'intro')
    }
  }, [sectionIds, activeSectionId])

  useEffect(() => {
    if (!isAdmin || !assessmentId || !isBackendApiEnabled()) {
      setAdminAssessment(null)
      return
    }
    fetchAssessment(assessmentId)
      .then(setAdminAssessment)
      .catch(() => setAdminAssessment(null))
  }, [isAdmin, assessmentId])

  const handleAdminReviewSaved = useCallback((updated) => {
    setAdminAssessment(updated)
    setStatusOverride(updated?.status || '')
    if (updated?.aiNarrative) setAiNarrative(updated.aiNarrative)
  }, [])

  const handleDownloadPdf = useCallback(async () => {
    const canUseBackendPdf = assessmentId && displayAnalysis?.savedToDb && isBackendApiEnabled()
    if (!cvReport || pdfLoading || !canDownloadPdf || (!displayPhoto && !canUseBackendPdf)) return
    setPdfLoading(true)
    try {
      if (displayPhoto) {
        const { downloadMyFacePdf } = await import('../utils/reportPdf')
        await downloadMyFacePdf({
          photo: displayPhoto,
          photos,
          cvReport,
          metrics,
          landmarks,
          protocolData: protocolData || null,
          protocolNarrative,
          answers: displayAnswers,
          eyeAnalysis,
          aiNarrative,
        })
      } else if (canUseBackendPdf) {
        await downloadAssessmentPdf(assessmentId)
      }
    } catch (err) {
      console.error('PDF export failed:', err)
      alert(err?.message || 'Failed to generate PDF. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }, [displayPhoto, photos, cvReport, metrics, landmarks, protocolData, protocolNarrative, displayAnswers, eyeAnalysis, aiNarrative, pdfLoading, canDownloadPdf, assessmentId, displayAnalysis])

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
        protocolData,
        protocolNarrative,
        label: showQovesReport
          ? `MyFace report · ${cvReport?.overall?.score ?? cvReport?.symmetry?.score ?? '—'} overall`
          : `Analysis · ${metrics?.harmonyScore ?? '—'}/100 harmony`,
      }).catch((err) => {
        console.warn('[MyFace] Could not persist analysis history:', err)
      })
    },
    [sessionId, displayPhoto, photos, displayAnswers, displayAnalysis, cvLabel, metrics, eyeAnalysis, cvReport, showQovesReport, reportStatus, assessmentId, aiNarrative, aiVisuals, protocolData, protocolNarrative]
  )

  useEffect(() => {
    if (!showQovesReport || !cvReport) return
    persistHistory()
  }, [showQovesReport, cvReport, persistHistory])

  useEffect(() => {
    setAiNarrative(historyEntry?.aiNarrative || displayAnalysis?.aiNarrative || null)
    setAiNarrativeError('')
    setAiVisuals(historyEntry?.aiVisuals || displayAnalysis?.aiVisuals || null)
    setAiVisualsError('')
    setProtocolData(historyEntry?.protocolData || displayAnalysis?.protocolData || null)
    setProtocolNarrative(historyEntry?.protocolNarrative || displayAnalysis?.protocolNarrative || null)
    setProtocolError('')
  }, [historyEntry, displayAnalysis])

  // Load stored NL content only — never regenerate on report open.
  useEffect(() => {
    if (!showQovesReport || !assessmentId || !isBackendApiEnabled()) return
    if (aiNarrative && protocolData) {
      nlHydratedForId.current = assessmentId
      return
    }
    if (nlHydratedForId.current === assessmentId) return

    let cancelled = false
    ;(async () => {
      const needsNarrative = !aiNarrative
      const needsProtocol = !protocolData
      if (needsNarrative) setAiNarrativeLoading(true)
      if (needsProtocol) setProtocolLoading(true)
      setAiNarrativeError('')
      setProtocolError('')
      try {
        const full = await fetchAssessment(assessmentId)
        if (cancelled) return
        if (needsNarrative) setAiNarrative(full?.aiNarrative || null)
        let loadedProtocol = full?.protocolData || null
        if (needsProtocol && loadedProtocol) {
          setProtocolData(loadedProtocol)
          setProtocolNarrative(full?.protocolNarrative || null)
        }
        if (needsProtocol && !loadedProtocol) {
          try {
            const bundle = await fetchAssessmentProtocol(assessmentId)
            if (!cancelled) {
              setProtocolData(bundle?.protocolData || null)
              setProtocolNarrative(bundle?.protocolNarrative || null)
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
  }, [showQovesReport, assessmentId, aiNarrative, protocolData])

  const handleGenerateVisuals = useCallback(async () => {
    if (!assessmentId || !isBackendApiEnabled() || aiVisualsLoading) return
    setAiVisualsLoading(true)
    setAiVisualsError('')
    try {
      const updated = await generateAssessmentVisuals(assessmentId)
      setAiVisuals(updated?.aiVisuals || null)
    } catch (err) {
      setAiVisualsError(err.message || 'AI visuals unavailable')
    } finally {
      setAiVisualsLoading(false)
    }
  }, [assessmentId, aiVisualsLoading])

  const handleLoadAssistant = useCallback(async () => {
    if (!assessmentId || !isBackendApiEnabled()) return { messages: [] }
    return await fetchAssistantConversation(assessmentId)
  }, [assessmentId])

  const handleSendAssistant = useCallback(async (message) => {
    if (!assessmentId || !isBackendApiEnabled()) return { messages: [] }
    return await sendAssistantMessage(assessmentId, message)
  }, [assessmentId])

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
    const isAwsError = displayAnalysis?.error?.includes('expired') ||
      displayAnalysis?.error?.includes('credential') ||
      displayAnalysis?.error?.includes('security token') ||
      displayAnalysis?.error?.includes('AWS')
    return (
      <div className="min-h-screen px-4 sm:px-6 py-8 animate-fade-up font-sans pt-16 bg-surface">
        <div className="max-w-xl mx-auto mt-12">
          <div className="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-card border border-surface-border">
            <ErrorPanel title="Analysis failed" message={displayAnalysis?.error || 'Analysis could not be completed.'} />
            {isAwsError && photo && (
              <div className="mt-4">
                <button
                  onClick={() => onRetryLocal?.(photo, photos, answers)}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[50px] text-sm font-display font-semibold bg-brand text-white hover:bg-brand-dark shadow-brand transition-all"
                >
                  <ScanFace className="w-4 h-4" />
                  Use Free Local Analysis Instead
                </button>
              </div>
            )}
            <button onClick={onRestart} className="btn-primary w-full mt-3 text-sm font-display">
              <RotateCcw className="w-4 h-4" />
              Try Again
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
          DEV: Admin approval bypassed
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-border bg-surface-card shrink-0">
        <h2 className="font-display text-sm font-semibold text-ink truncate">Facial Analysis Report</h2>
        <div className="flex items-center gap-2 shrink-0">
          {showQovesReport && isAdmin && assessmentId && !isReportApproved(reportStatus) && (
            <button
              type="button"
              onClick={() => setApproveConfirmOpen(true)}
              disabled={!!statusUpdating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {statusUpdating === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Approve
            </button>
          )}
          {showQovesReport && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !canDownloadPdf}
              className="btn-primary text-xs px-4 py-2 shadow-brand"
              title={!canDownloadPdf ? 'PDF download is available after admin approval' : 'Download PDF'}
            >
              {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-xl text-ink-muted hover:text-ink hover:bg-surface-warm transition-colors"
              aria-label="Close report"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-3 sm:px-4 pb-3 pt-3">
        {isAdmin && adminAssessment && !isReportApproved(reportStatus) && (
          <div className="mb-3 shrink-0">
            <AdminReviewPanel
              embedded
              assessment={adminAssessment}
              onSaved={handleAdminReviewSaved}
            />
          </div>
        )}

        {displayAnalysis?.protocolWarnings?.length > 0 && (
          <div className="mb-3 shrink-0 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-display font-semibold text-amber-700 mb-2">Protocol warnings</p>
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
                <p className="text-sm font-display font-semibold text-amber-800 mb-1">Report under review</p>
                <p className="text-xs text-amber-700 font-sans leading-relaxed">{clientAwaitingReviewMessage()}</p>
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
              onSelect={setActiveSectionId}
              showAiVisuals={!!assessmentId && isBackendApiEnabled()}
              showAssistant={!!assessmentId && isBackendApiEnabled()}
            >
              <LockedSectionGate
                locked={clientReportLocked && !isPublicSection(activeSectionId)}
              >
                <CvReportView
                  activeId={activeSectionId}
                  cvReport={cvReport}
                  eyeAnalysis={eyeAnalysis}
                  protocolData={protocolData}
                  protocolNarrative={protocolNarrative}
                  protocolLoading={protocolLoading}
                  aiNarrative={aiNarrative}
                  photo={displayPhoto}
                  photos={photos}
                  landmarks={landmarks}
                  metrics={metrics}
                  answers={displayAnswers}
                  aiVisuals={aiVisuals}
                  aiVisualsLoading={aiVisualsLoading}
                  aiVisualsError={aiVisualsError}
                  onGenerateVisuals={handleGenerateVisuals}
                  canGenerateVisuals={!!assessmentId && isBackendApiEnabled()}
                  assessmentId={assessmentId}
                  canUseAssistant={!!assessmentId && isBackendApiEnabled()}
                  onLoadAssistant={handleLoadAssistant}
                  onSendAssistant={handleSendAssistant}
                  onDownloadPdf={handleDownloadPdf}
                  pdfLoading={pdfLoading}
                  canDownloadPdf={canDownloadPdf}
                />
              </LockedSectionGate>
            </ReportDocumentLayout>
          </div>
        ) : cvPending ? (
          <div className="max-w-lg mx-auto px-4">
            <div className="bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border text-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-4" />
              <p className="text-sm text-ink-muted">Building structured report from landmarks…</p>
            </div>
          </div>
        ) : (
          <div className="max-w-lg mx-auto px-4">
            <ErrorPanel
              title="Report unavailable"
              message={displayAnalysis?.error || 'No analysis data was returned. Upload all 7 required photos and run analysis again.'}
            />
          </div>
        )}
      </div>
      <ConfirmDialog
        open={approveConfirmOpen}
        title="Approve report?"
        message="This releases the full report and PDF download to the client. This action cannot be undone."
        confirmLabel="Approve"
        onConfirm={confirmAdminApprove}
        onCancel={() => setApproveConfirmOpen(false)}
      />
    </div>
  )
}
