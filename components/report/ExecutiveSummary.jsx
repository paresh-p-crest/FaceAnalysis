import { Sparkles, TrendingUp, Star, AlertCircle, Loader2 } from 'lucide-react'
import { FaceImageFrame } from './FaceImageFrame'

/* ── Score Ring SVG ── */
function ScoreRing({ score, size = 140, stroke = 8 }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="report-score-ring mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="ring-bg" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring-value">
        <span className="text-3xl font-display font-bold text-brand">{score}</span>
        <span className="text-[10px] text-ink-muted font-sans">/ 100</span>
      </div>
    </div>
  )
}

/* ── Feature Score Bar ── */
function FeatureScoreBar({ label, score, icon: Icon }) {
  return (
    <div className="feature-score-mini">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-brand" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-ink font-sans">{label}</span>
          <span className="text-sm font-display font-bold text-brand">{score}</span>
        </div>
        <div className="score-bar">
          <div className="score-bar-fill" style={{ width: `${score}%` }} />
        </div>
      </div>
    </div>
  )
}

/* ── Main Executive Summary ── */
function AiNarrativeCard({ aiNarrative, loading, error }) {
  const content = aiNarrative?.content || aiNarrative
  const strengths = Array.isArray(content?.strengths) ? content.strengths : []
  const focusAreas = Array.isArray(content?.focusAreas) ? content.focusAreas : []
  const recommendations = Array.isArray(content?.recommendations) ? content.recommendations : []

  if (loading) {
    return (
      <div className="rounded-2xl border border-brand/20 bg-brand-50/60 dark:bg-brand-500/10 p-5">
        <div className="flex items-center gap-2 text-brand">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm font-display font-semibold">Generating AI narrative</p>
        </div>
      </div>
    )
  }

  if (!content && !error) return null

  return (
    <div className="rounded-2xl border border-brand/20 bg-brand-50/60 dark:bg-brand-500/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" />
          <p className="text-xs font-semibold text-brand font-display uppercase tracking-wider">AI Narrative</p>
        </div>
        <span className="text-[10px] text-ink-muted font-sans">CV-grounded</span>
      </div>
      {error && !content ? (
        <p className="text-xs text-ink-muted font-sans leading-relaxed">{error}</p>
      ) : (
        <div className="space-y-4">
          {content?.summary && (
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">{content.summary}</p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {strengths.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-sans">Strengths</p>
                <ul className="space-y-1.5">
                  {strengths.map((item, index) => (
                    <li key={index} className="text-xs text-ink-secondary leading-relaxed font-sans">{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {focusAreas.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-sans">Focus Areas</p>
                <ul className="space-y-1.5">
                  {focusAreas.map((item, index) => (
                    <li key={index} className="text-xs text-ink-secondary leading-relaxed font-sans">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {recommendations.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-sans">Recommendations</p>
              <ul className="grid sm:grid-cols-2 gap-2">
                {recommendations.map((item, index) => (
                  <li key={index} className="rounded-xl border border-brand/10 bg-white/70 dark:bg-surface-card/70 p-3 text-xs text-ink-secondary leading-relaxed font-sans">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {content?.disclaimer && (
            <p className="text-[10px] text-ink-muted leading-relaxed font-sans">{content.disclaimer}</p>
          )}
        </div>
      )}
    </div>
  )
}

export function ExecutiveSummary({ cvReport, eyeAnalysis, metrics, aiNarrative, aiNarrativeLoading, aiNarrativeError }) {
  const overall = cvReport?.overall?.score || metrics?.harmonyScore || 75
  const overallLabel = cvReport?.overall?.scoreLabel || 'Analysis Complete'

  const features = [
    { label: 'Symmetry', score: cvReport?.symmetry?.score, icon: Sparkles },
    { label: 'Proportions', score: cvReport?.proportions?.score, icon: TrendingUp },
    { label: 'Nose', score: cvReport?.nose?.score, icon: null },
    { label: 'Lips', score: cvReport?.lips?.score, icon: null },
    { label: 'Jaw & Chin', score: cvReport?.jawChin?.score, icon: null },
    { label: 'Skin', score: cvReport?.skin?.score, icon: null },
  ].filter((f) => f.score)

  // Identify strengths and areas for improvement
  const sorted = [...features].sort((a, b) => b.score - a.score)
  const strengths = sorted.slice(0, 2)
  const improve = sorted.slice(-2).reverse()

  return (
    <div className="pr-2 space-y-6">
      {/* Hero Section */}
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted font-sans font-medium mb-4">
          AuraScan Facial Analysis Report
        </p>
        <ScoreRing score={overall} />
        <h2 className="font-display text-xl font-bold text-ink mt-4 mb-1">
          {overallLabel}
        </h2>
        <p className="text-sm text-ink-muted font-sans max-w-md mx-auto">
          Your overall facial analysis score based on symmetry, proportions, feature harmony, and skin quality.
        </p>
      </div>

      {/* Face Photo */}
      {cvReport?.symmetry?.imageSrc && (
        <div className="flex justify-center">
          <FaceImageFrame src={cvReport.symmetry.imageSrc} aspect="4/5" maxW="220px" />
        </div>
      )}

      <AiNarrativeCard aiNarrative={aiNarrative} loading={aiNarrativeLoading} error={aiNarrativeError} />

      {/* Feature Breakdown */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-4 font-sans">
          Feature Breakdown
        </p>
        <div className="space-y-3">
          {features.map((f) => (
            <FeatureScoreBar key={f.label} label={f.label} score={f.score} icon={f.icon} />
          ))}
        </div>
      </div>

      {/* Strengths & Areas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-700 font-display uppercase tracking-wider">Strengths</p>
          </div>
          <ul className="space-y-2">
            {strengths.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="text-sm font-display font-bold text-emerald-700">{s.score}</span>
                <span className="text-sm text-emerald-800 font-sans">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-xs font-semibold text-amber-700 font-display uppercase tracking-wider">Areas to Watch</p>
          </div>
          <ul className="space-y-2">
            {improve.map((s) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="text-sm font-display font-bold text-amber-700">{s.score}</span>
                <span className="text-sm text-amber-800 font-sans">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Face Shape */}
      {cvReport?.faceShape && (
        <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2 font-sans">
            Face Shape
          </p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-display font-bold text-brand">{cvReport.faceShape.shape}</span>
            <span className="text-xs text-ink-muted font-sans">· W/H ratio {cvReport.faceShape.widthHeightRatio}</span>
          </div>
          <p className="text-sm text-ink-secondary leading-relaxed font-sans">
            {cvReport.faceShape.explanation}
          </p>
        </div>
      )}
    </div>
  )
}
