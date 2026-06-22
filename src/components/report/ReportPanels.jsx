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
    <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-2 space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-white mb-1">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 font-sans mb-4">{subtitle}</p>}
        {imageSrc && (
          <FaceImageFrame src={imageSrc} aspect={imageAspect} overlay={overlay} />
        )}
      </div>

      {children}

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Score</p>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-4xl font-display font-bold text-accent">{score}</span>
          <span className="text-sm text-slate-500 mb-1">/ {scoreMax}</span>
          {scoreLabel && (
            <span className="ml-auto text-sm font-medium text-accent bg-accent/10 px-3 py-1 rounded-full">{scoreLabel}</span>
          )}
        </div>
        <div className="relative h-2 rounded-full bg-white/[0.06] mb-2">
          {rangeHighlight && (
            <div
              className="absolute top-0 bottom-0 rounded-full bg-accent/20"
              style={{ left: `${rangeHighlight.left}%`, width: `${rangeHighlight.width}%` }}
            />
          )}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-accent shadow-[0_0_10px_rgba(79,209,197,0.45)]"
            style={{ left: `calc(${scaleMarkerPct}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 font-sans mb-4">
          <span>{scaleLeft}</span>
          <span>{scaleRight}</span>
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">Explanation</p>
        <p className="text-sm text-slate-300 leading-relaxed font-sans">{explanation}</p>
      </div>
    </div>
  )
}

export { SymmetryOverlay, ProportionsOverlay }
