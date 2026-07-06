import { useState } from 'react'

function DimorphismScale({ score, scaleLeft, scaleRight }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">Dimorphism Range</p>
      <p className="text-2xl font-display font-bold text-ink mb-4">{score.label}</p>
      <div className="relative h-2.5 rounded-full bg-surface-border mb-2">
        <div
          className="absolute top-0 bottom-0 rounded-full bg-brand/20"
          style={{ left: `${Math.max(0, score.score - 10)}%`, width: '20%' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-ink shadow-lg"
          style={{ left: `calc(${score.score}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-ink-secondary font-sans font-medium">
        <span>{scaleLeft}</span>
        <span>{scaleRight}</span>
      </div>
    </div>
  )
}

function dimorphismBadgeClass(label) {
  const l = (label || '').toLowerCase()
  if (l.includes('very masculine')) return 'bg-slate-800 text-white border-slate-700'
  if (l.includes('masculine')) return 'bg-slate-100 text-slate-800 border-slate-300'
  if (l.includes('very feminine')) return 'bg-rose-100 text-rose-700 border-rose-300'
  if (l.includes('feminine')) return 'bg-rose-50 text-rose-600 border-rose-200'
  if (l.includes('moderate')) return 'bg-amber-50 text-amber-800 border-amber-200'
  return 'bg-gray-50 text-ink-muted border-surface-border'
}

function dimorphismBarClass(label) {
  const l = (label || '').toLowerCase()
  if (l.includes('masculine')) return 'bg-slate-600'
  if (l.includes('feminine')) return 'bg-rose-400'
  return 'bg-amber-400'
}

function FeatureCard({ feature, isExpanded, onToggle }) {
  const badgeClass = dimorphismBadgeClass(feature.label)
  const barClass = dimorphismBarClass(feature.label)

  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-display text-base font-semibold text-ink">{feature.name}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badgeClass}`}>
          {feature.label}
        </span>
      </button>
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Scale bar */}
          <div>
            <div className="relative h-2 rounded-full bg-surface-border">
              <div
                className={`absolute top-0 bottom-0 rounded-full opacity-25 ${barClass}`}
                style={{ left: `${Math.max(0, feature.score - 12)}%`, width: '24%' }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-ink shadow"
                style={{ left: `calc(${feature.score}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-ink-faint font-sans mt-1">
              <span>Hyper Feminine</span>
              <span>Hyper Masculine</span>
            </div>
          </div>
          {/* Explanation */}
          <div className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1.5 font-medium">Explanation</p>
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">{feature.explanation}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function DimorphismSection({ dimorphism }) {
  const [expandedIdx, setExpandedIdx] = useState(0)
  if (!dimorphism) return null

  return (
    <div className="pr-2 space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">
          An overview of your <span className="text-brand">facial dimorphism</span>
        </h3>
        <p className="text-[13px] text-ink-muted font-sans mt-1">
          We're exploring how each of your features leans more <strong className="text-ink-secondary">masculine</strong> and <strong className="text-ink-secondary">feminine</strong>.
        </p>
      </div>

      {/* Overall scale */}
      <DimorphismScale
        score={{ score: dimorphism.overallScore, label: dimorphism.overallLabel }}
        scaleLeft={dimorphism.scaleLeft}
        scaleRight={dimorphism.scaleRight}
      />

      {/* Explanation */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">Explanation</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{dimorphism.explanation}</p>
      </div>

      {/* Per-feature section */}
      <div>
        <h4 className="font-display text-base font-semibold text-ink mb-1">
          Your dimorphism <span className="text-brand">per feature</span>
        </h4>
        <p className="text-[12px] text-ink-muted font-sans mb-4">
          These measurements best highlight the differences between your <strong className="text-ink-secondary">masculine</strong> and <strong className="text-ink-secondary">feminine</strong> features.
        </p>
        <div className="space-y-3">
          {dimorphism.features.map((f, i) => (
            <FeatureCard
              key={f.name}
              feature={f}
              isExpanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
