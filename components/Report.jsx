import { useEffect, useState, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ScanFace, RotateCcw, Sparkles, Eye, Activity,
  TrendingUp, ClipboardList, Loader2, AlertTriangle,
  History, Settings, Sun, Moon, Download, Lock,
  ChevronLeft, ShieldCheck,
} from 'lucide-react'
import { useTheme } from '../utils/theme'
import { generateReport } from '../utils/openai'
import { generateProtocol, getTemplateProtocol } from '../utils/protocolGenerator'
import { saveHistoryEntry, createHistoryId, loadHistory } from '../utils/historyStorage'
import {
  downloadAssessmentPdf,
  fetchAssessment,
  fetchAssistantConversation,
  generateAssessmentNarrative,
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
import { ReportNavSidebar } from './report/ReportNavSidebar'
import { CvReportView } from './report/CvReportView'
import { runFaceAnalysis } from '../utils/analyzeFace'
import AdminReviewPanel from './AdminReviewPanel'
import ConfirmDialog from './ConfirmDialog'

const LEGACY_TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'structure', label: 'Structure', icon: ScanFace },
  { id: 'protocol', label: 'Protocol', icon: ClipboardList },
]

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

function getReportLabel(source, reportError) {
  if (source === 'local') return 'Free CV template'
  if (source === 'openai') return 'OpenAI'
  if (source === 'aws') return 'AWS Rekognition'
  if (reportError) return 'Error'
  return '—'
}

function stripNotesSection(text) {
  if (!text) return text
  return text.split('## Notes')[0].replace(/\*Provider:.*\*?\s*$/m, '').trim()
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

function formatMetricPercent(value) {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : '—'
}

export default function Report({ photo, photos, answers, analysis, historyId, onRestart, onRetryLocal, onHistory, onDashboard, onSettings, user }) {
  const { theme, toggleTheme } = useTheme()
  const [activeSection, setActiveSection] = useState('summary')
  const [activeTab, setActiveTab] = useState('overview')
  const [report, setReport] = useState('')
  const [reportSource, setReportSource] = useState('')
  const [reportError, setReportError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [protocolData, setProtocolData] = useState(null)
  const [protocolLoading, setProtocolLoading] = useState(false)
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
        const { downloadAuraScanPdf } = await import('../utils/reportPdf')
        await downloadAuraScanPdf({
          photo: displayPhoto,
          cvReport,
          metrics,
          landmarks,
          protocolData: protocolData || getTemplateProtocol(cvReport),
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
  }, [displayPhoto, cvReport, metrics, landmarks, protocolData, displayAnswers, eyeAnalysis, aiNarrative, pdfLoading, canDownloadPdf, assessmentId, displayAnalysis])

  const persistHistory = useCallback(
    (content, source, error) => {
      saveHistoryEntry({
        id: sessionId,
        createdAt: new Date().toISOString(),
        photo: displayPhoto,
        photos,
        answers: displayAnswers,
        analysis: displayAnalysis,
        eyeAnalysis,
        cvReport,
        report: content,
        reportSource: source,
        reportError: error,
        cvLabel,
        assessmentId,
        savedToDb: displayAnalysis?.savedToDb,
        reportStatus,
        aiNarrative,
        aiVisuals,
        label: showQovesReport
          ? `AuraScan report · ${cvReport?.overall?.score ?? cvReport?.symmetry?.score ?? '—'} overall`
          : `Analysis · ${metrics?.harmonyScore ?? '—'}/100 harmony`,
      })
    },
    [sessionId, displayPhoto, photos, displayAnswers, displayAnalysis, cvLabel, metrics, eyeAnalysis, cvReport, showQovesReport, reportStatus, assessmentId, aiNarrative, aiVisuals]
  )

  useEffect(() => {
    if (showQovesReport) setActiveSection('summary')
    else setActiveTab('overview')
  }, [historyId, showQovesReport])

  useEffect(() => {
    if (historyEntry) {
      setReport(historyEntry.report || '')
      setReportSource(historyEntry.reportSource || '')
      setReportError(historyEntry.reportError || null)
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { content, source, error } = await generateReport(
        displayAnswers,
        displayPhoto,
        metrics,
        displayAnalysis?.error,
        displayAnalysis?.faceDetails,
        displayAnalysis?.protocolWarnings,
        eyeAnalysis
      )
      if (!cancelled) {
        setReport(content || '')
        setReportSource(source || '')
        setReportError(error)
        setLoading(false)
        if (!error && content) persistHistory(content, source, error)
      }
    })()
    return () => { cancelled = true }
  }, [historyEntry, displayAnswers, displayPhoto, metrics, displayAnalysis, eyeAnalysis, persistHistory])

  useEffect(() => {
    setAiNarrative(historyEntry?.aiNarrative || displayAnalysis?.aiNarrative || null)
    setAiNarrativeError('')
    setAiVisuals(historyEntry?.aiVisuals || displayAnalysis?.aiVisuals || null)
    setAiVisualsError('')
  }, [historyEntry, displayAnalysis])

  useEffect(() => {
    if (!showQovesReport || !assessmentId || aiNarrative || !isBackendApiEnabled()) return

    let cancelled = false
    ;(async () => {
      setAiNarrativeLoading(true)
      setAiNarrativeError('')
      try {
        const updated = await generateAssessmentNarrative(assessmentId)
        const narrative = updated?.aiNarrative || null
        if (!cancelled) {
          setAiNarrative(narrative)
          const existing = loadHistory().find((h) => h.id === sessionId)
          if (existing && narrative) saveHistoryEntry({ ...existing, aiNarrative: narrative })
        }
      } catch (err) {
        if (!cancelled) setAiNarrativeError(err.message || 'AI narrative unavailable')
      } finally {
        if (!cancelled) setAiNarrativeLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [showQovesReport, assessmentId, aiNarrative, sessionId])

  const handleGenerateVisuals = useCallback(async () => {
    if (!assessmentId || !isBackendApiEnabled() || aiVisualsLoading) return
    setAiVisualsLoading(true)
    setAiVisualsError('')
    try {
      const updated = await generateAssessmentVisuals(assessmentId)
      const visuals = updated?.aiVisuals || null
      setAiVisuals(visuals)
      const existing = loadHistory().find((h) => h.id === sessionId)
      if (existing && visuals) saveHistoryEntry({ ...existing, aiVisuals: visuals })
    } catch (err) {
      setAiVisualsError(err.message || 'AI visuals unavailable')
    } finally {
      setAiVisualsLoading(false)
    }
  }, [assessmentId, aiVisualsLoading, sessionId])

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

  // Generate LLM-powered protocol when cvReport is available
  useEffect(() => {
    if (!showQovesReport || !cvReport) return

    // If from history, try to restore saved protocol or use template
    if (historyEntry) {
      if (historyEntry.protocolData) {
        setProtocolData(historyEntry.protocolData)
      } else {
        setProtocolData(getTemplateProtocol(cvReport))
      }
      return
    }

    let cancelled = false
    ;(async () => {
      setProtocolLoading(true)
      const result = await generateProtocol(cvReport, metrics, displayAnswers, displayPhoto)
      if (!cancelled) {
        if (result?.protocol) {
          setProtocolData(result.protocol)
        } else {
          // Fallback to template-based recommendations
          setProtocolData(getTemplateProtocol(cvReport))
        }
        setProtocolLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [cvReport, showQovesReport, historyEntry, metrics, displayAnswers, displayPhoto])

  // Save protocol data to history once generated
  useEffect(() => {
    if (!protocolData || isFromHistory) return
    // Update the history entry with the protocol data
    const existing = loadHistory().find((h) => h.id === sessionId)
    if (existing) {
      saveHistoryEntry({ ...existing, protocolData })
    }
  }, [protocolData, isFromHistory, sessionId])

  const legacyTabContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <p className="text-ink-muted text-sm font-sans">Generating report…</p>
        </div>
      )
    }
    if (reportError) return <ErrorPanel title="Report unavailable" message={reportError} />
    if (activeTab === 'overview') {
      return (
        <div className="markdown-report overflow-y-auto max-h-[520px] pr-2">
          <ReactMarkdown>{report.split('---')[0] || report.slice(0, 1200)}</ReactMarkdown>
        </div>
      )
    }
    if (activeTab === 'structure') {
      const structural = report.split('## Structural Analysis')[1]?.split('---')[0] || ''
      return (
        <div className="markdown-report overflow-y-auto max-h-[520px] pr-2">
          {structural ? (
            <ReactMarkdown>{'## Structural Analysis' + structural}</ReactMarkdown>
          ) : (
            <ReactMarkdown>{report}</ReactMarkdown>
          )}
        </div>
      )
    }
    const protocolRaw = report.includes('## Personalized 30-Day Protocol')
      ? report.split('## Personalized 30-Day Protocol')[1]
      : report.split('## Top Strengths')[1] || report.slice(-800)
    return (
      <div className="markdown-report markdown-protocol overflow-y-auto max-h-[520px] pr-2">
        <ReactMarkdown>
          {stripNotesSection(protocolRaw) ? '## Personalized 30-Day Protocol\n' + stripNotesSection(protocolRaw) : report}
        </ReactMarkdown>
      </div>
    )
  }

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
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-display font-semibold bg-brand text-white hover:bg-brand-600 shadow-brand transition-all"
                >
                  <ScanFace className="w-4 h-4" />
                  Use Free Local Analysis Instead
                </button>
                <p className="text-[11px] text-surface-muted text-center mt-1.5">Powered by MediaPipe + OpenCV (free, runs in browser)</p>
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
    <div className="min-h-screen px-4 sm:px-6 py-8 animate-fade-up font-sans bg-surface">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center">
              <ScanFace className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-ink tracking-tight">
                AuraScan Report
              </h1>
              <p className="text-xs text-ink-muted font-sans">
                {cvLabel} · {getReportLabel(reportSource, reportError)}
                {isFromHistory && <span className="text-brand/70"> · saved</span>}
              </p>
              {(requiresApproval || isFromHistory) && (
                <div className="mt-1">
                  <StatusBadge status={reportStatus} />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAdmin ? (
              <>
                <button
                  onClick={onDashboard}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to Admin Dashboard
                </button>
                {assessmentId && !isReportApproved(reportStatus) && (
                  <button
                    onClick={() => setApproveConfirmOpen(true)}
                    disabled={!!statusUpdating}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {statusUpdating === 'approved' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    Approve
                  </button>
                )}
              </>
            ) : isUser && showQovesReport && !loading && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading || !canDownloadPdf}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-brand text-white hover:bg-brand-600 border border-brand shadow-brand transition-colors flex items-center gap-1.5 disabled:opacity-60"
                title={!canDownloadPdf ? 'PDF download is available after admin approval' : 'Download report'}
              >
                {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : canDownloadPdf ? <Download className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                Download Report
              </button>
            )}
            {isUser && (
              <>
                <button onClick={onDashboard} className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft flex items-center gap-1.5">
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back to My Profile
                </button>
                <button onClick={onRestart} className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  New Assessment
                </button>
                <button onClick={onHistory} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title="Analysis History">
                  <History className="w-4 h-4" />
                </button>
              </>
            )}
            {isAdmin && (
              <button onClick={() => onSettings()} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title="API Settings">
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button onClick={toggleTheme} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
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

        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Harmony Score', value: metrics.harmonyScore, icon: Sparkles, color: 'text-brand', bg: 'bg-brand-50' },
              { label: 'Symmetry', value: formatMetricPercent(metrics.symmetry), icon: Activity, color: 'text-brand', bg: 'bg-brand-50' },
              { label: 'Visual Age', value: `${metrics.visualAge}y`, icon: Eye, color: 'text-brand', bg: 'bg-brand-50' },
              { label: 'Proportionality', value: formatMetricPercent(metrics.proportionality), icon: TrendingUp, color: 'text-brand', bg: 'bg-brand-50' },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-surface-card rounded-2xl p-4 shadow-card border border-surface-border">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <div className="text-2xl font-display font-bold text-ink tracking-tight">{card.value}</div>
                <div className="text-xs text-ink-muted mt-0.5 font-sans">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {clientReportLocked && (
          <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-display font-semibold text-amber-800 mb-1">
                  Report under review
                </p>
                <p className="text-xs text-amber-700 font-sans leading-relaxed">
                  {clientAwaitingReviewMessage()}
                </p>
              </div>
            </div>
          </div>
        )}

        {showQovesReport ? (
          <div className="grid lg:grid-cols-[220px_1fr] gap-6">
            <ReportNavSidebar
              activeId={activeSection}
              onSelect={setActiveSection}
              showAiVisuals={isUser}
              showAssistant={isUser}
            />
            <div className="bg-white dark:bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border">
              {clientReportLocked ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center gap-3">
                  <Lock className="w-10 h-10 text-ink-faint" />
                  <p className="font-display text-lg font-semibold text-ink">Full report locked</p>
                  <p className="text-sm text-ink-muted max-w-md">
                    {clientAwaitingReviewMessage()}
                  </p>
                </div>
              ) : loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <p className="text-ink-muted text-sm font-sans">Building your AuraScan report…</p>
                </div>
              ) : (
                <CvReportView
                  activeId={activeSection}
                  cvReport={cvReport}
                  eyeAnalysis={eyeAnalysis}
                  protocolData={protocolData}
                  protocolLoading={protocolLoading}
                  aiNarrative={aiNarrative}
                  aiNarrativeLoading={aiNarrativeLoading}
                  aiNarrativeError={aiNarrativeError}
                  photo={displayPhoto}
                  landmarks={landmarks}
                  metrics={metrics}
                  answers={displayAnswers}
                  aiVisuals={aiVisuals}
                  aiVisualsLoading={aiVisualsLoading}
                  aiVisualsError={aiVisualsError}
                  onGenerateVisuals={handleGenerateVisuals}
                  canGenerateVisuals={isUser && !!assessmentId && isBackendApiEnabled()}
                  assessmentId={assessmentId}
                  canUseAssistant={isUser && !!assessmentId && isBackendApiEnabled()}
                  onLoadAssistant={handleLoadAssistant}
                  onSendAssistant={handleSendAssistant}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border">
              <h3 className="font-display text-sm font-semibold text-ink-muted uppercase tracking-wider mb-4">
                Landmark Mapping
              </h3>
              <div className="relative mx-auto max-w-xs">
                <div className="relative rounded-2xl overflow-hidden aspect-[4/5] ring-1 ring-surface-border">
                  <img src={displayPhoto} alt="Analysis" className="w-full h-full object-cover" />
                  {landmarks?.length > 0 && (
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {(landmarks.length > 120 ? landmarks.filter((_, i) => i % 4 === 0) : landmarks).map((pt) => (
                        <circle key={pt.id} cx={pt.x * 100} cy={pt.y * 100} r="0.6" fill="rgba(15,118,110,0.7)" />
                      ))}
                    </svg>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border flex flex-col">
              <div className="flex items-center gap-0 border-b border-surface-border mb-6 overflow-x-auto">
                {LEGACY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 transition-colors border-b-2 -mb-px shrink-0 text-sm font-medium ${
                      activeTab === tab.id
                        ? 'border-brand text-brand'
                        : 'border-transparent text-ink-muted hover:text-ink-secondary'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
              {legacyTabContent()}
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
