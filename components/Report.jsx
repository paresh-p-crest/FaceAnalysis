import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  ScanFace, RotateCcw, Loader2, AlertTriangle,
  History, Settings, Sun, Moon, Download, Lock,
  ChevronLeft, ShieldCheck,
} from 'lucide-react'
import { useTheme } from '../utils/theme'
import { saveHistoryEntry, createHistoryId, loadHistory } from '../utils/historyStorage'
import {
  downloadAssessmentPdf,
  fetchAssessment,
  fetchAssistantConversation,
  generateAssessmentNarrative,
  ensureAssessmentProtocol,
  generateAssessmentVisuals,
  isBackendApiEnabled,
  sendAssistantMessage,
  updateAssessmentStatus,
} from '../utils/apiClient'
import {
  canClientViewFullReport,
  canDownloadReportPdf,
  clientAwaitingReviewMessage,
  isReportApproved,
  normalizeReportStatus,
} from '../utils/reportWorkflow'
import { userHasAnalysisAccess } from '../utils/paymentAccess'
import { ReportDocumentLayout } from './report/ReportDocumentLayout'
import { ProtocolSideRail } from './report/ProtocolSideRail'
import { LockedSectionGate } from './report/LockedSectionGate'
import { isPublicSection } from './report/reportNavConfig'
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

export default function Report({ photo, photos, answers, analysis, historyId, onRestart, onRetryLocal, onHistory, onDashboard, onSettings, user }) {
  const { theme, toggleTheme } = useTheme()
  const [activeSection, setActiveSection] = useState('intro')
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
  const [hasPaidAccess, setHasPaidAccess] = useState(false)
  const [sessionId] = useState(() => createHistoryId())
  const [pdfLoading, setPdfLoading] = useState(false)
  const [statusOverride, setStatusOverride] = useState('')
  const [statusUpdating, setStatusUpdating] = useState('')
  const [adminAssessment, setAdminAssessment] = useState(null)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)

  const historyEntry = useMemo(() => {
    if (!historyId) return null
    return loadHistory().find((h) => h.id === historyId) || null
  }, [historyId])

  const isFromHistory = !!historyEntry
  const displayPhoto = historyEntry?.photo ?? photo
  const displayAnalysis = historyEntry?.analysis ?? analysis
  const displayAnswers = historyEntry?.answers ?? answers

  const cvFailed = !isFromHistory && (!displayAnalysis?.success || displayAnalysis?.error)
  const metrics = displayAnalysis?.metrics
  const landmarks = displayAnalysis?.landmarks
  const eyeAnalysis = historyEntry?.eyeAnalysis ?? displayAnalysis?.eyeAnalysis ?? null
  const cvReport = historyEntry?.cvReport ?? displayAnalysis?.cvReport ?? null
  const cvLabel = historyEntry?.cvLabel ?? getCvLabel(displayAnalysis, metrics)
  const showQovesReport = !!cvReport
  const reportStatus = normalizeReportStatus(statusOverride || historyEntry?.reportStatus || displayAnalysis?.reportStatus)
  const assessmentId = displayAnalysis?.assessmentId || historyEntry?.assessmentId
  const requiresApproval = !!displayAnalysis?.savedToDb || !!displayAnalysis?.assessmentId || !!historyEntry?.assessmentId
  const isAdmin = user?.role === 'admin'
  const isUser = !isAdmin
  const canDownloadPdf = canDownloadReportPdf(reportStatus, requiresApproval)
  const clientReportLocked = isUser && requiresApproval && !canClientViewFullReport(reportStatus, false)
  const canUsePaidAi = isUser && !!assessmentId && isBackendApiEnabled() && (hasPaidAccess || isAdmin)

  useEffect(() => {
    if (!user || isAdmin) {
      setHasPaidAccess(isAdmin)
      return
    }
    let cancelled = false
    userHasAnalysisAccess(user).then((access) => {
      if (!cancelled) setHasPaidAccess(access)
    })
    return () => { cancelled = true }
  }, [user, isAdmin])

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
    () => {
      void saveHistoryEntry({
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
    if (showQovesReport) setActiveSection((prev) => (prev === 'summary' || prev === 'landmarks' ? 'intro' : prev))
  }, [historyId, showQovesReport])

  useEffect(() => {
    setAiNarrative(historyEntry?.aiNarrative || displayAnalysis?.aiNarrative || null)
    setAiNarrativeError('')
    setAiVisuals(historyEntry?.aiVisuals || displayAnalysis?.aiVisuals || null)
    setAiVisualsError('')
    setProtocolData(historyEntry?.protocolData || displayAnalysis?.protocolData || null)
    setProtocolNarrative(historyEntry?.protocolNarrative || displayAnalysis?.protocolNarrative || null)
    setProtocolError('')
  }, [historyEntry, displayAnalysis])

  useEffect(() => {
    if (!showQovesReport || !assessmentId || aiNarrative || !canUsePaidAi) return

    let cancelled = false
    ;(async () => {
      setAiNarrativeLoading(true)
      setAiNarrativeError('')
      try {
        const updated = await generateAssessmentNarrative(assessmentId)
        const narrative = updated?.aiNarrative || null
        if (!cancelled) setAiNarrative(narrative)
      } catch (err) {
        if (!cancelled) setAiNarrativeError(err.message || 'AI narrative unavailable')
      } finally {
        if (!cancelled) setAiNarrativeLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [showQovesReport, assessmentId, aiNarrative, canUsePaidAi])

  useEffect(() => {
    if (!showQovesReport || !assessmentId || !isBackendApiEnabled()) return
    if (!canUsePaidAi) return
    if (protocolData) return

    let cancelled = false
    ;(async () => {
      setProtocolLoading(true)
      setProtocolError('')
      try {
        const bundle = await ensureAssessmentProtocol(assessmentId)
        if (!cancelled) {
          setProtocolData(bundle?.protocolData || null)
          setProtocolNarrative(bundle?.protocolNarrative || null)
        }
      } catch (err) {
        if (!cancelled) setProtocolError(err.message || 'Protocol unavailable')
      } finally {
        if (!cancelled) setProtocolLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [showQovesReport, assessmentId, canUsePaidAi, protocolData])

  const handleGenerateVisuals = useCallback(async () => {
    if (!assessmentId || !canUsePaidAi || aiVisualsLoading) return
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
  }, [assessmentId, canUsePaidAi, aiVisualsLoading])

  const handleLoadAssistant = useCallback(async () => {
    if (!assessmentId || !canUsePaidAi) return { messages: [] }
    return await fetchAssistantConversation(assessmentId)
  }, [assessmentId, canUsePaidAi])

  const handleSendAssistant = useCallback(async (message) => {
    if (!assessmentId || !canUsePaidAi) return { messages: [] }
    return await sendAssistantMessage(assessmentId, message)
  }, [assessmentId, canUsePaidAi])

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

  const sectionLocked = clientReportLocked && !isPublicSection(activeSection)

  if (cvFailed) {
    const isAwsError = displayAnalysis?.error?.includes('expired') ||
      displayAnalysis?.error?.includes('credential') ||
      displayAnalysis?.error?.includes('security token') ||
      displayAnalysis?.error?.includes('AWS')
    return (
      <div className="min-h-screen px-4 sm:px-6 py-8 animate-fade-up font-sans pt-16 bg-surface">
        <div className="max-w-xl mx-auto mt-12">
          <div className="bg-white dark:bg-surface-card rounded-3xl p-8 shadow-card border border-surface-border">
            <ErrorPanel title="Analysis failed" message={displayAnalysis.error} />
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
    <div className="min-h-screen px-4 sm:px-6 py-8 animate-fade-up font-sans bg-surface text-slate-900 dark:text-slate-100">
      <div className="max-w-[1600px] mx-auto">

        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-8">
          <div className="flex items-center">
            <span className="font-serif font-bold text-slate-900 dark:text-white text-2xl tracking-tight">MyFace</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <>
                <button
                  onClick={onDashboard}
                  className="px-3 py-1.5 rounded-[50px] text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-[#5e9f8b] hover:border-[#5e9f8b]/30 transition-colors shadow-soft flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to Admin
                </button>
                {assessmentId && !isReportApproved(reportStatus) && (
                  <button
                    onClick={() => setApproveConfirmOpen(true)}
                    disabled={!!statusUpdating}
                    className="px-3 py-1.5 rounded-[50px] text-[11px] font-medium font-display bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {statusUpdating === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={onDashboard} className="px-3 py-1.5 rounded-[50px] text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-[#5e9f8b] hover:border-[#5e9f8b]/30 transition-colors shadow-soft flex items-center gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Dashboard
                </button>
                <button onClick={onRestart} className="px-3 py-1.5 rounded-[50px] text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-[#5e9f8b] hover:border-[#5e9f8b]/30 transition-colors shadow-soft flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  New Analysis
                </button>
                <button onClick={onHistory} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-[#5e9f8b] hover:border-[#5e9f8b]/30 transition-colors shadow-soft" title="Analysis History">
                  <History className="w-4 h-4" />
                </button>
              </>
            )}

            {showQovesReport && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading || !canDownloadPdf}
                className="px-4 py-1.5 rounded-[50px] text-[11px] font-bold bg-[#5e9f8b] text-white hover:bg-[#548f7d] shadow-sm transition-colors flex items-center gap-1"
                title={!canDownloadPdf ? 'PDF download is available after admin approval' : 'Download PDF'}
              >
                {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                PDF
              </button>
            )}

            {isAdmin && (
              <button onClick={() => onSettings()} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title="API Settings">
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleTheme} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-[#5e9f8b] hover:border-[#5e9f8b]/30 transition-colors shadow-soft" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isAdmin && adminAssessment && !isReportApproved(reportStatus) && (
          <AdminReviewPanel
            embedded
            assessment={adminAssessment}
            onSaved={handleAdminReviewSaved}
          />
        )}

        {displayAnalysis?.protocolWarnings?.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <p className="text-sm font-display font-semibold text-amber-700 mb-2">Protocol warnings</p>
            <ul className="space-y-1.5">
              {displayAnalysis.protocolWarnings.map((w) => (
                <li key={w.id} className="text-xs text-amber-600 font-sans">• {w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {clientReportLocked && (
          <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-display font-semibold text-amber-800 mb-1">Report under review</p>
                <p className="text-xs text-amber-700 font-sans leading-relaxed">{clientAwaitingReviewMessage()}</p>
              </div>
            </div>
          </div>
        )}

        {!hasPaidAccess && isUser && assessmentId && isBackendApiEnabled() && (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 dark:bg-surface-raised dark:border-surface-border">
            <p className="text-sm text-ink-secondary">
              Complete payment to unlock AI narrative, protocol, visuals, and Beauty Assistant coaching.
            </p>
          </div>
        )}

        {protocolError && (
          <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700">
            {protocolError}
          </div>
        )}

        {showQovesReport ? (
          <ReportDocumentLayout
            activeId={activeSection}
            onSelect={setActiveSection}
            showAiVisuals={isUser && canUsePaidAi}
            showAssistant={isUser && canUsePaidAi}
            clientName={displayAnswers?.name || 'Client'}
            assessmentId={assessmentId}
            rightRail={
              <ProtocolSideRail
                photo={displayPhoto}
                answers={displayAnswers}
                assessmentId={assessmentId}
                onViewProtocol={() => setActiveSection('protocol')}
              />
            }
          >
            <LockedSectionGate locked={sectionLocked}>
              <CvReportView
                activeId={activeSection}
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
                canGenerateVisuals={canUsePaidAi}
                assessmentId={assessmentId}
                canUseAssistant={canUsePaidAi}
                onLoadAssistant={handleLoadAssistant}
                onSendAssistant={handleSendAssistant}
                onDownloadPdf={handleDownloadPdf}
                pdfLoading={pdfLoading}
                canDownloadPdf={canDownloadPdf}
              />
            </LockedSectionGate>
          </ReportDocumentLayout>
        ) : (
          <div className="max-w-lg mx-auto">
            <div className="bg-white dark:bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border text-center">
              <Loader2 className="w-8 h-8 text-brand animate-spin mx-auto mb-4" />
              <p className="text-sm text-ink-muted">Building structured report from landmarks…</p>
            </div>
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
