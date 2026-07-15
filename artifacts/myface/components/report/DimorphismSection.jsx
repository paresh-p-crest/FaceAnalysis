import { resolveFeatureHero } from '../../utils/featureParsing'

const FEATURE_NAME_TO_PARSING_ID = {
  Eyebrows: 'eyebrows',
  Eyes: 'eyes',
  Nose: 'nose',
  Cheeks: 'cheeks',
  Lips: 'lips',
  Jaw: 'jaw',
  Chin: 'chin',
  Neck: 'neck',
  Ears: 'ears',
}

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

function FeatureCard({ feature, imageSrc }) {
  const badgeClass = dimorphismBadgeClass(feature.label)
  const barClass = dimorphismBarClass(feature.label)

  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card overflow-hidden p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-semibold text-ink">{feature.name}</span>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badgeClass}`}>
          {feature.label}
        </span>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4 flex items-center justify-center min-h-[9rem]">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={feature.name}
            className="max-h-40 w-auto object-contain rounded-xl"
          />
        ) : null}
      </div>

      <div>
        <div className="relative h-2 rounded-full bg-surface-border">
          <div
            className={`absolute top-0 bottom-0 rounded-full opacity-25 ${barClass}`}
            style={{ left: `${Math.max(0, feature.score - 12)}%`, width: '24%' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-sm bg-ink shadow"
            style={{ left: `calc(${feature.score}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ink-faint font-sans mt-1">
          <span>Hyper Feminine</span>
          <span>Hyper Masculine</span>
        </div>
      </div>

      <div className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1.5 font-medium">Explanation</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{feature.explanation}</p>
      </div>
    </div>
  )
}

export function DimorphismSection({ dimorphism, photo, featureParsing = null }) {
  if (!dimorphism) return null

  const cropFor = (featureName) => {
    const id = FEATURE_NAME_TO_PARSING_ID[featureName]
    if (!id) return null
    return resolveFeatureHero(id, null, featureParsing)
  }

  return (
    <div className="pr-2 space-y-6">
      <div>
        <h3 className="font-display text-2xl font-bold text-ink">
          An overview of your <span className="text-ink-muted">facial masculinity</span>
        </h3>
        <p className="text-sm text-ink-muted font-sans mt-2">
          We&apos;re exploring how each of your facial features leans more masculine or feminine.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {photo && (
          <div className="rounded-2xl overflow-hidden border border-surface-border aspect-[4/5] bg-surface-warm">
            <img src={photo} alt="Portrait" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="space-y-4">
          <DimorphismScale
            score={{ score: dimorphism.overallScore, label: dimorphism.overallLabel }}
            scaleLeft={dimorphism.scaleLeft}
            scaleRight={dimorphism.scaleRight}
          />
          <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
            <p className="qoves-report-mono-label mb-2">Explanation</p>
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">{dimorphism.explanation}</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-display text-base font-semibold text-ink mb-1">
          Your dimorphism <span className="text-brand">per feature</span>
        </h4>
        <p className="text-[12px] text-ink-muted font-sans mb-4">
          These measurements best highlight the differences between your <strong className="text-ink-secondary">masculine</strong> and <strong className="text-ink-secondary">feminine</strong> features.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {dimorphism.features.map((f) => (
            <FeatureCard
              key={f.name}
              feature={f}
              imageSrc={cropFor(f.name)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
