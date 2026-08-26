'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ANALYSIS_CARD_CALLOUTS,
  FEATURE_PREVIEW_CALLOUTS,
  mapCoverCenter,
  mapCoverTopCenter,
  resolveFeaturePreviewCallouts,
} from '../../utils/reportProtocolModel'

export { FEATURE_PREVIEW_CALLOUTS, ANALYSIS_CARD_CALLOUTS }

function labelFor(t, id) {
  try {
    return t(`executiveSummary.faceMap.${id}`)
  } catch {
    return id.toUpperCase()
  }
}

/**
 * Portrait with zone callouts.
 * `sideLabels`: photo left + external label column (client analysis card).
 */
export function FeaturePreviewPortrait({
  photo = null,
  alt = '',
  t,
  landmarks = null,
  className = '',
  compact = false,
  sideLabels = false,
  /** Larger portrait (customer dashboard web view); markers remapped via ResizeObserver. */
  enlarged = false,
}) {
  const boxRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return undefined
    const sync = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: r.width, h: r.height })
    }
    sync()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  const catalog = sideLabels ? ANALYSIS_CARD_CALLOUTS : FEATURE_PREVIEW_CALLOUTS
  const callouts = useMemo(() => {
    const base = resolveFeaturePreviewCallouts(landmarks, catalog)
    if (!natural.w || !natural.h || !box.w || !box.h) {
      return base.map((c) => ({ ...c, cx: c.x, cy: c.y }))
    }
    const mapFn = sideLabels ? mapCoverCenter : mapCoverTopCenter
    return base.map((c) => {
      const mapped = mapFn(c.x, c.y, natural.w, natural.h, box.w, box.h)
      return { ...c, cx: mapped.x, cy: mapped.y }
    })
  }, [landmarks, natural.w, natural.h, box.w, box.h, catalog, sideLabels])

  if (sideLabels) {
    // PDF compact ~188; customer dashboard web enlarged ~300 so markers track the bigger box
    const frameH = enlarged ? (compact ? 300 : 340) : (compact ? 188 : 230)
    const photoPct = enlarged ? 70 : 66
    const n = Math.max(1, callouts.length)
    return (
      <div
        className={`relative flex gap-3 items-stretch w-full min-h-0 ${className}`.trim()}
        style={{ height: frameH }}
      >
        <div
          ref={boxRef}
          className="relative overflow-hidden rounded-md bg-[#e8f0ee] border border-surface-border h-full shrink-0 z-[1]"
          style={{ width: `${photoPct}%` }}
        >
          {photo ? (
            <img
              src={photo}
              alt={alt}
              className="absolute inset-0 w-full h-full object-cover object-center"
              onLoad={(e) => {
                setNatural({
                  w: e.currentTarget.naturalWidth || 0,
                  h: e.currentTarget.naturalHeight || 0,
                })
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#c5d4cf]">
              <span className="text-[8px] text-ink-muted">—</span>
            </div>
          )}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {callouts.map((c) => (
              <span
                key={c.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
                style={{
                  left: `${c.cx * 100}%`,
                  top: `${c.cy * 100}%`,
                  width: enlarged ? 5 : compact ? 2.5 : 3.5,
                  height: enlarged ? 5 : compact ? 2.5 : 3.5,
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="relative flex-1 min-w-0 h-full flex flex-col justify-between py-px z-[1] items-start"
          aria-hidden={false}
        >
          {callouts.map((c) => (
            <span
              key={c.id}
              className="block w-fit max-w-full box-border rounded-[3px] bg-slate-100 border border-slate-200 text-left font-medium text-ink truncate leading-none shrink-0"
              style={{
                fontSize: enlarged ? 11 : 8,
                padding: enlarged ? '3px 7px' : compact ? '2px 5px' : '2.5px 6px',
                minHeight: enlarged ? 16 : compact ? 12 : 14,
              }}
            >
              {labelFor(t, c.id)}
            </span>
          ))}
        </div>

        {/* Connector lines: face marker → evenly stacked label */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {callouts.map((c, i) => {
            const x1 = photoPct * c.cx
            const y1 = 100 * c.cy
            // Gap between photo and chips (~gap-3 ≈ 3% of row in this viewBox)
            const x2 = photoPct + 3.2
            const y2 = ((i + 0.5) / n) * 100
            return (
              <line
                key={`line-${c.id}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgb(94 159 139 / 0.75)"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
      </div>
    )
  }

  const labelX = 0.9
  return (
    <div
      ref={boxRef}
      className={`relative overflow-hidden rounded-xl bg-[#e8f0ee] border border-surface-border w-full aspect-[3/4] ${
        compact ? 'min-h-[160px] max-h-[220px]' : 'min-h-[220px] max-h-[320px] rounded-2xl'
      } ${className}`.trim()}
    >
      {photo ? (
        <img
          src={photo}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover object-top"
          onLoad={(e) => {
            setNatural({
              w: e.currentTarget.naturalWidth || 0,
              h: e.currentTarget.naturalHeight || 0,
            })
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#c5d4cf]">
          <span className="text-xs text-ink-muted">—</span>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {callouts.map((c) => {
          const ax = `${c.cx * 100}%`
          const ay = `${c.cy * 100}%`
          const lx = `${labelX * 100}%`
          const lineW = Math.max(0, (labelX - c.cx) * 100)
          return (
            <div key={c.id} className="absolute inset-0">
              <span
                className="absolute rounded-full bg-white shadow-sm border border-white/80 -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: ax,
                  top: ay,
                  width: compact ? 5 : 7,
                  height: compact ? 5 : 7,
                }}
              />
              <span
                className="absolute h-px bg-white/70 -translate-y-1/2"
                style={{ left: ax, top: ay, width: `${lineW}%` }}
              />
              <span
                className={`absolute -translate-x-full -translate-y-1/2 rounded-full bg-white/95 border border-white/80 shadow-sm font-bold uppercase tracking-wider text-ink whitespace-nowrap ${
                  compact ? 'px-1 py-px text-[6px]' : 'px-2 py-0.5 text-[8px] sm:text-[9px]'
                }`}
                style={{ left: lx, top: ay }}
              >
                {labelFor(t, c.id)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const HERO_FEATURE_COUNT = 3

/**
 * Overview hero / page-1 analysis card.
 * `variant="analysisCard"`: title + glance subtitle + side-label portrait + 3 steps (client).
 */
export function FeatureAnalysisHero({
  photo = null,
  alt = '',
  t,
  landmarks = null,
  overallScore = null,
  evaluatedLabel = '—',
  analysisTimeLabel = '—',
  className = '',
  compact = false,
  showMetrics = true,
  variant = 'default',
  /** Customer dashboard web view — larger face map; markers follow image box size. */
  enlarged = false,
}) {
  const metrics = [
    {
      label: t('executiveSummary.kpiOverallScore'),
      value: overallScore != null ? `${overallScore} / 100` : '—',
    },
    {
      label: t('executiveSummary.kpiEvaluated'),
      value: evaluatedLabel,
    },
    {
      label: t('executiveSummary.kpiAnalysisTime'),
      value: analysisTimeLabel,
    },
  ]

  if (variant === 'analysisCard') {
    const snug = compact && !enlarged
    return (
      <section
        className={`rounded-xl border border-surface-border bg-white dark:bg-surface-card overflow-hidden ${className}`.trim()}
      >
        <div className={`flex flex-col ${snug ? 'gap-1 p-2' : 'gap-3 p-4'}`}>
          <div className="shrink-0">
            <h2
              className={`font-sans font-bold tracking-tight leading-tight text-ink ${
                snug ? 'text-[11px]' : 'text-2xl'
              }`}
            >
              {t('executiveSummary.heroTitlePrefix')}{' '}
              <span className="text-brand-dark">{t('executiveSummary.heroTitleAccent')}</span>
            </h2>
            <p className={`text-ink-muted leading-snug mt-0.5 ${snug ? 'text-[7px]' : 'text-sm'}`}>
              {t('executiveSummary.heroGlance')}
            </p>
          </div>

          <FeaturePreviewPortrait
            photo={photo}
            alt={alt}
            t={t}
            landmarks={landmarks}
            compact={compact}
            enlarged={enlarged}
            sideLabels
          />

          <ul className={`shrink-0 ${snug ? 'space-y-2 mt-1' : 'space-y-2.5'}`}>
            {Array.from({ length: HERO_FEATURE_COUNT }, (_, i) => i).map((i) => (
              <li key={i} className={`flex items-start ${snug ? 'gap-2' : 'gap-1.5'}`}>
                <span
                  className={`rounded-full bg-brand-100 text-brand flex items-center justify-center shrink-0 font-bold ${
                    snug ? 'mt-0.5 w-3.5 h-3.5 text-[7px]' : 'mt-0.5 w-7 h-7 text-[10px]'
                  }`}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block font-semibold text-ink leading-snug ${
                      snug ? 'text-[8px]' : 'text-[13px]'
                    }`}
                  >
                    {t(`executiveSummary.heroFeatures.${i}.title`)}
                  </span>
                  <span
                    className={`block text-ink-muted leading-snug ${
                      snug ? 'text-[7px] mt-0.5' : 'text-[11px] mt-0.5'
                    }`}
                  >
                    {t(`executiveSummary.heroFeatures.${i}.detail`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    )
  }

  return (
    <section
      className={`rounded-2xl border border-surface-border bg-white dark:bg-surface-card overflow-hidden ${className}`.trim()}
    >
      <div className={`flex flex-col ${compact ? 'gap-2.5 p-3' : 'gap-4 p-4 sm:p-5'}`}>
        <div
          className={`grid items-start min-w-0 ${
            compact
              ? 'grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-2.5'
              : 'grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4 md:gap-5'
          }`}
        >
          <div className={`min-w-0 ${compact ? 'space-y-1.5' : 'space-y-3'}`}>
            <h2
              className={`font-sans font-bold tracking-tight leading-tight text-ink ${
                compact ? 'text-[13px]' : 'text-2xl sm:text-3xl'
              }`}
            >
              {t('executiveSummary.heroTitlePrefix')}{' '}
              <span className="text-brand-dark">{t('executiveSummary.heroTitleAccent')}</span>
            </h2>
            <p
              className={`text-ink-secondary leading-relaxed ${
                compact ? 'text-[10px]' : 'text-sm'
              }`}
            >
              {t('executiveSummary.heroBody')}
            </p>
            <ul className={compact ? 'space-y-1 pt-0.5' : 'space-y-2.5 pt-1'}>
              {Array.from({ length: HERO_FEATURE_COUNT }, (_, i) => i).map((i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span
                    className={`rounded-full bg-brand-100 text-brand flex items-center justify-center shrink-0 font-bold ${
                      compact ? 'mt-0.5 w-4 h-4 text-[8px]' : 'mt-0.5 w-7 h-7 text-[10px]'
                    }`}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block font-semibold text-ink leading-snug ${
                        compact ? 'text-[10px]' : 'text-[13px]'
                      }`}
                    >
                      {t(`executiveSummary.heroFeatures.${i}.title`)}
                    </span>
                    <span
                      className={`block text-ink-muted leading-snug ${
                        compact ? 'text-[9px]' : 'text-[11px]'
                      }`}
                    >
                      {t(`executiveSummary.heroFeatures.${i}.detail`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start justify-end min-w-0">
            <div className={compact ? 'w-full' : 'w-full max-w-[240px]'}>
              <FeaturePreviewPortrait
                photo={photo}
                alt={alt}
                t={t}
                landmarks={landmarks}
                compact={compact}
              />
            </div>
          </div>
        </div>

        {showMetrics ? (
          <div>
            <p
              className={`font-bold uppercase tracking-[0.14em] text-ink-muted mb-1.5 ${
                compact ? 'text-[8px]' : 'text-[9px]'
              }`}
            >
              {t('executiveSummary.heroSummaryLabel')}
            </p>
            <div className={`grid grid-cols-3 border-t border-surface-border ${compact ? 'gap-2 pt-2' : 'gap-3 pt-3'}`}>
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0">
                  <p
                    className={`font-bold text-ink tabular-nums leading-none truncate ${
                      compact ? 'text-[12px]' : 'text-base sm:text-lg'
                    }`}
                  >
                    {m.value}
                  </p>
                  <p className={`text-ink-muted mt-0.5 truncate ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
