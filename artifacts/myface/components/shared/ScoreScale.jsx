'use client'

import { useTranslations } from 'next-intl'

export default function ScoreScale({ score, scoreMax = 100, scoreLabel, scaleLeft, scaleRight, markerPct, rangeHighlight }) {
  const t = useTranslations('Shared.scoreScale')

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2">{t('heading')}</p>
      <div className="flex items-end gap-3 mb-4">
        <span className="text-4xl font-display font-bold text-brand">{score}</span>
        <span className="text-sm text-ink-muted mb-1">{t('outOf', { max: scoreMax })}</span>
        {scoreLabel && (
          <span className="ml-auto text-sm font-medium text-brand bg-brand-50 px-3 py-1 rounded-full">{scoreLabel}</span>
        )}
      </div>
      <div className="relative h-2.5 rounded-full bg-surface-warm mb-2 overflow-hidden">
        {rangeHighlight && (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-brand/20"
            style={{ left: `${rangeHighlight.left}%`, width: `${rangeHighlight.width}%` }}
          />
        )}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-brand shadow-brand border-2 border-white"
          style={{ left: `calc(${markerPct}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-ink-muted">
        <span>{scaleLeft}</span>
        <span>{scaleRight}</span>
      </div>
    </div>
  )
}
