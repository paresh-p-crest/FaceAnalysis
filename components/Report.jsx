import { useEffect, useState, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ScanFace, RotateCcw, Sparkles, Eye, Activity,
  TrendingUp, ClipboardList, Loader2, AlertTriangle,
  History, Settings, Sun, Moon, Download,
} from 'lucide-react'
import { useTheme } from '../utils/theme'
import { generateReport } from '../utils/openai'
import { generateProtocol, getTemplateProtocol } from '../utils/protocolGenerator'
import { saveHistoryEntry, createHistoryId, loadHistory } from '../utils/historyStorage'
import { ReportNavSidebar } from './report/ReportNavSidebar'
import { CvReportView } from './report/CvReportView'
import { runFaceAnalysis } from '../utils/analyzeFace'

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

export default function Report({ photo, photos, answers, analysis, historyId, onRestart, onRetryLocal, onHistory, onSettings }) {
  const { theme, toggleTheme } = useTheme()
  const [activeSection, setActiveSection] = useState('summary')
  const [activeTab, setActiveTab] = useState('overview')
  const [report, setReport] = useState('')
  const [reportSource, setReportSource] = useState('')
  const [reportError, setReportError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [protocolData, setProtocolData] = useState(null)
  const [protocolLoading, setProtocolLoading] = useState(false)
  const [sessionId] = useState(() => createHistoryId())
  const [pdfLoading, setPdfLoading] = useState(false)

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

  const handleDownloadPdf = useCallback(async () => {
    if (!displayPhoto || !cvReport || pdfLoading) return
    setPdfLoading(true)
    try {
      const { downloadAuraScanPdf } = await import('../utils/reportPdf')
      await downloadAuraScanPdf({
        photo: displayPhoto,
        cvReport,
        metrics,
        landmarks,
        protocolData: protocolData || getTemplateProtocol(cvReport),
        answers: displayAnswers,
        eyeAnalysis,
      })
    } catch (err) {
      console.error('PDF export failed:', err)
      alert(err?.message || 'Failed to generate PDF. Please try again.')
    } finally {
      setPdfLoading(false)
    }
  }, [displayPhoto, cvReport, metrics, landmarks, protocolData, displayAnswers, eyeAnalysis, pdfLoading])

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
        label: showQovesReport
          ? `AuraScan report · ${cvReport?.overall?.score ?? cvReport?.symmetry?.score ?? '—'} overall`
          : `Analysis · ${metrics?.harmonyScore ?? '—'}/100 harmony`,
      })
    },
    [sessionId, displayPhoto, photos, displayAnswers, displayAnalysis, cvLabel, metrics, eyeAnalysis, cvReport, showQovesReport]
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
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {showQovesReport && !loading && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-brand text-white hover:bg-brand-600 border border-brand shadow-brand transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Download Report
              </button>
            )}
            <button onClick={onRestart} className="px-3 py-1.5 rounded-lg text-[11px] font-medium font-display bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              New Assessment
            </button>
            <button onClick={onHistory} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title="Analysis History">
              <History className="w-4 h-4" />
            </button>
            <button onClick={() => onSettings()} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title="API Settings">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={toggleTheme} className="p-1.5 rounded-lg bg-white dark:bg-surface-card border border-surface-border text-ink-muted hover:text-brand hover:border-brand/30 transition-colors shadow-soft" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

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
              { label: 'Symmetry', value: `${metrics.symmetry}%`, icon: Activity, color: 'text-brand', bg: 'bg-brand-50' },
              { label: 'Visual Age', value: `${metrics.visualAge}y`, icon: Eye, color: 'text-brand', bg: 'bg-brand-50' },
              { label: 'Proportionality', value: `${metrics.proportionality}%`, icon: TrendingUp, color: 'text-brand', bg: 'bg-brand-50' },
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

        {showQovesReport ? (
          <div className="grid lg:grid-cols-[220px_1fr] gap-6">
            <ReportNavSidebar activeId={activeSection} onSelect={setActiveSection} />
            <div className="bg-white dark:bg-surface-card rounded-3xl p-6 shadow-card border border-surface-border">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  <p className="text-ink-muted text-sm font-sans">Building your AuraScan report…</p>
                </div>
              ) : (
                <CvReportView activeId={activeSection} cvReport={cvReport} eyeAnalysis={eyeAnalysis} protocolData={protocolData} protocolLoading={protocolLoading} />
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
    </div>
  )
}
