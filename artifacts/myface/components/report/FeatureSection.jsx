'use client'

import { useTranslations } from 'next-intl'
import { FaceImageFrame } from './FaceImageFrame'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function MetricCard({ label, value, note }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
      {note && <p className="text-[10px] text-ink-faint mt-0.5">{note}</p>}
    </div>
  )
}

export function FeatureSection({ title, subtitle, score, scoreMax = 100, scoreLabel, scaleLeft, scaleRight, scaleMarkerPct, rangeHighlight, explanation, imageSrc, overlay, imageAspect = 'auto', metrics = [], children }) {
  const t = useTranslations('Report')

  return (
    <div className="pr-2 space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">{title}</h3>
        {subtitle && <p className="text-[10px] text-ink-muted font-sans mb-4">{subtitle}</p>}
      </div>

      {imageSrc && (
        <FaceImageFrame src={imageSrc} aspect={imageAspect} overlay={overlay} />
      )}

      {score != null && (
        <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">{t('common.score')}</p>
          <div className="flex items-end gap-3 mb-4">
            <span className="text-4xl font-display font-bold text-brand">{score}</span>
            <span className="text-sm text-ink-muted mb-1">/ {scoreMax}</span>
            {scoreLabel && (
              <span className="ml-auto text-sm font-medium text-brand bg-brand-50 px-3 py-1 rounded-full border border-brand/20">{scoreLabel}</span>
            )}
          </div>
          {scaleMarkerPct != null && (
            <>
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
            </>
          )}
          {explanation && (
            <>
              <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">{t('common.explanation')}</p>
              <p className="text-sm text-ink-secondary leading-relaxed font-sans">{explanation}</p>
            </>
          )}
        </div>
      )}

      {metrics.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3 font-sans">
            {t('common.measurements')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {metrics.map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} note={m.note} />
            ))}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

export function ProtocolSection({ recommendations = [] }) {
  const t = useTranslations('Report')

  if (!recommendations.length) return null

  return (
    <div className="pr-2 space-y-6">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">{t('featureSection.personalizedProtocol')}</h3>
        <p className="text-[10px] text-ink-muted font-sans mb-4">{t('featureSection.protocolSubtitle')}</p>
      </div>

      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <div key={i} className="recommendation-card">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                rec.priority === 'high' ? 'bg-brand-50 text-brand' :
                rec.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                'bg-surface-warm text-ink-muted'
              }`}>
                {rec.priority === 'high' ? <TrendingUp className="w-4 h-4" /> :
                 rec.priority === 'medium' ? <Minus className="w-4 h-4" /> :
                 <TrendingDown className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink font-sans mb-1">{rec.title}</p>
                <p className="text-xs text-ink-muted font-sans leading-relaxed">{rec.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
