import { FaceImageFrame, SymmetryOverlay, ProportionsOverlay } from './FaceImageFrame'

export function ScoreScalePanel({
  title,
  subtitle,
  score,
  scoreMax = 100,
  scoreLabel,
  scaleLeft,
  scaleRight,
  scaleMarkerPct,
  rangeHighlight,
  explanation,
  imageSrc,
  overlay,
  imageAspect = '4/5',
  children,
}) {
  return (
    <div className="pr-2 space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">{title}</h3>
        {subtitle && <p className="text-xs text-ink-muted font-sans mb-4">{subtitle}</p>}
        {imageSrc && (
          <FaceImageFrame src={imageSrc} aspect={imageAspect} overlay={overlay} />
        )}
      </div>

      {children}

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">Score</p>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-4xl font-display font-bold text-brand">{score}</span>
          <span className="text-sm text-ink-muted mb-1">/ {scoreMax}</span>
          {scoreLabel && (
            <span className="ml-auto text-sm font-medium text-brand bg-brand-50 px-3 py-1 rounded-full border border-brand/20">{scoreLabel}</span>
          )}
        </div>
        <div className="relative h-2 rounded-full bg-surface-border mb-2">
          {rangeHighlight && (
            <div
              className="absolute top-0 bottom-0 rounded-full bg-brand/20"
              style={{ left: `${rangeHighlight.left}%`, width: `${rangeHighlight.width}%` }}
            />
          )}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-brand shadow-glow"
            style={{ left: `calc(${scaleMarkerPct}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ink-faint font-sans mb-4">
          <span>{scaleLeft}</span>
          <span>{scaleRight}</span>
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">Explanation</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{explanation}</p>
      </div>
    </div>
  )
}

export { SymmetryOverlay, ProportionsOverlay, FaceShapeOverlay }
