import { useEffect, useState, useMemo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  ScanFace, RotateCcw, Sparkles, Eye, Activity,
  TrendingUp, ClipboardList, Loader2, AlertTriangle, Settings,
} from 'lucide-react'
import { computeMetrics, generateLandmarks } from '../utils/constants'
import { generateReport } from '../utils/openai'
import { isDemoMode } from '../utils/appMode'
import { saveHistoryEntry, createHistoryId, loadHistory } from '../utils/historyStorage'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'structure', label: 'Structure', icon: ScanFace },
  { id: 'protocol', label: 'Protocol', icon: ClipboardList },
]

const METRIC_LABELS = [
  { key: 'symmetry', label: 'Facial Symmetry', unit: '%' },
  { key: 'proportionality', label: 'Proportionality', unit: '%' },
  { key: 'averageness', label: 'Averageness Index', unit: '%' },
  { key: 'eyebrowTilt', label: 'Eyebrow Tilt', unit: '°' },
  { key: 'jawlineAngle', label: 'Jawline Angle', unit: '°' },
  { key: 'canthalTilt', label: 'Canthal Tilt', unit: '°' },
  { key: 'nasalAngle', label: 'Nasolabial Angle', unit: '°' },
]

function ErrorPanel({ title, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="font-display text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-md leading-relaxed font-sans">{message}</p>
    </div>
  )
}

function getCvLabel(analysis, metrics, isDemo) {
  if (isDemo) return 'Demo (mock)'
  if (analysis?.cvEngine === 'aws') return 'AWS Rekognition'
  if (analysis?.cvEngine === 'mediapipe+opencv') {
    return `MediaPipe (${metrics?.landmarkCount || 478} pts) + OpenCV`
  }
  return '—'
}

function stripNotesSection(text) {
  if (!text) return text
  return text.split('## Notes')[0].replace(/\*Provider:.*\*?\s*$/m, '').trim()
}

export default function Report({ photo, photos, answers, analysis, historyId, onRestart }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [report, setReport] = useState('')
  const [reportSource, setReportSource] = useState('')
  const [reportError, setReportError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionId] = useState(() => createHistoryId())

  const historyEntry = useMemo(() => {
    if (!historyId) return null
    return loadHistory().find((h) => h.id === historyId) || null
  }, [historyId])

  const isFromHistory = !!historyEntry
  const displayPhoto = historyEntry?.photo ?? photo
  const displayAnalysis = historyEntry?.analysis ?? analysis
  const displayAnswers = historyEntry?.answers ?? answers

  const isDemo = isDemoMode() || displayAnalysis?.mode === 'demo'
  const cvFailed = !isFromHistory && !isDemo && (!displayAnalysis?.success || displayAnalysis?.error)
  const metrics = isDemo
    ? (displayAnalysis?.metrics || computeMetrics(displayAnswers))
    : displayAnalysis?.metrics
  const landmarks = isDemo
    ? (displayAnalysis?.landmarks || generateLandmarks())
    : displayAnalysis?.landmarks
  const cvLabel = historyEntry?.cvLabel ?? getCvLabel(displayAnalysis, metrics, isDemo)

  const persistHistory = useCallback(
    (content, source, error) => {
      saveHistoryEntry({
        id: sessionId,
        createdAt: new Date().toISOString(),
        photo: displayPhoto,
        photos,
        answers: displayAnswers,
        analysis: displayAnalysis,
        report: content,
        reportSource: source,
        reportError: error,
        cvLabel,
        label: `Analysis · ${metrics?.harmonyScore ?? '—'}/100 harmony`,
      })
    },
    [sessionId, displayPhoto, photos, displayAnswers, displayAnalysis, cvLabel, metrics]
  )

  useEffect(() => {
    setActiveTab('overview')
  }, [historyId])

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
        displayAnalysis?.protocolWarnings
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
  }, [historyEntry, displayAnswers, displayPhoto, metrics, displayAnalysis, persistHistory])

  const tabContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-slate-400 text-sm font-sans">Generating report…</p>
        </div>
      )
    }

    if (reportError) {
      return <ErrorPanel title="Report unavailable" message={reportError} />
    }

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

    const protocol = stripNotesSection(protocolRaw)

    return (
      <div className="markdown-report markdown-protocol overflow-y-auto max-h-[520px] pr-2">
        <ReactMarkdown>
          {protocol ? '## Personalized 30-Day Protocol\n' + protocol : report}
        </ReactMarkdown>
      </div>
    )
  }

  if (cvFailed) {
    return (
      <div className="min-h-screen px-4 sm:px-6 py-8 animate-fade-up font-sans pt-16">
        <div className="max-w-xl mx-auto mt-12">
          <div className="glass rounded-3xl p-8">
            <ErrorPanel title="Analysis failed" message={displayAnalysis.error} />
            <button onClick={onRestart} className="btn-primary w-full mt-6 text-sm font-display">
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 pt-16 animate-fade-up font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl glass-strong flex items-center justify-center">
              <ScanFace className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-white tracking-tight">
                Your Analysis Report
              </h1>
              <p className="text-xs text-slate-500 font-sans">
                CV: {cvLabel} · Report:{' '}
                {reportSource === 'openai' ? 'OpenAI' : reportSource === 'aws' ? 'AWS Rekognition' : isDemo ? 'Demo template' : reportError ? 'Error' : '—'}
                {isFromHistory && <span className="text-accent/70"> · saved</span>}
              </p>
            </div>
          </div>
          <button onClick={onRestart} className="btn-ghost text-sm self-start font-display">
            <RotateCcw className="w-4 h-4" />
            New Assessment
          </button>
        </div>

        {displayAnalysis?.protocolWarnings?.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <p className="text-sm font-display font-semibold text-amber-200 mb-2">Protocol warnings</p>
            <ul className="space-y-1.5">
              {displayAnalysis.protocolWarnings.map((w) => (
                <li key={w.id} className="text-xs text-amber-100/80 font-sans">• {w.message}</li>
              ))}
            </ul>
          </div>
        )}

        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { label: 'Harmony Score', value: metrics.harmonyScore, icon: Sparkles, color: 'text-accent' },
              { label: 'Symmetry', value: `${metrics.symmetry}%`, icon: Activity, color: 'text-violet-glow' },
              { label: 'Visual Age', value: `${metrics.visualAge}y`, icon: Eye, color: 'text-accent-glow' },
              { label: 'Proportionality', value: `${metrics.proportionality}%`, icon: TrendingUp, color: 'text-violet-glow' },
            ].map((card) => (
              <div key={card.label} className="glass rounded-2xl p-4">
                <card.icon className={`w-4 h-4 ${card.color} mb-2`} />
                <div className="text-2xl font-display font-bold text-white tracking-tight">{card.value}</div>
                <div className="text-xs text-slate-500 mt-0.5 font-sans">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass rounded-3xl p-6">
            <h3 className="font-display text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Landmark Mapping
            </h3>
            <div className="relative mx-auto max-w-xs">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/5] ring-1 ring-white/10">
                <img src={displayPhoto} alt="Analysis" className="w-full h-full object-cover" />
                {landmarks?.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {(landmarks.length > 120 ? landmarks.filter((_, i) => i % 4 === 0) : landmarks).map((pt) => (
                      <circle key={pt.id} cx={pt.x * 100} cy={pt.y * 100} r="0.6" fill="rgba(110, 231, 200, 0.7)" />
                    ))}
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 flex flex-col">
            <div className="flex items-center gap-0 border-b border-white/5 mb-6">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 transition-colors border-b-2 -mb-px ${
                    activeTab === tab.id
                      ? 'tab-active report-tab'
                      : 'report-tab-inactive border-transparent hover:text-slate-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            {tabContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
