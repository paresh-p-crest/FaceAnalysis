'use client'

import { useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Loader2, Share2 } from 'lucide-react'
import { PhotoLandmarkFrame } from './FaceImageFrame'
import { resolveProjectedAfterUrl } from '../../utils/projectedAfter'
import {
  buildProtocolDashboardData,
  formatProtocolId,
  getClientName,
  resolveTreatmentPhases,
} from '../../utils/qovesProtocolModel'
import { shareReportPage } from '../../utils/reportShare'
import { FeatureAnalysisHero } from './FeaturePreviewPortrait'
import { NameProtocolPlate } from './NameProtocolPlate'
import { TreatmentProtocolPhases } from './TreatmentProtocolPhases'

const RADAR_AXIS_KEYS = ['symmetry', 'smoothness', 'jawline', 'skin', 'volume', 'harmony']

function dashBlank(value) {
  return value != null && value !== '' ? value : '—'
}

function RadarChart({ scores, t }) {
  const cx = 100
  const cy = 100
  const rMax = 70
  const axes = RADAR_AXIS_KEYS.map((key) => t(`executiveSummary.radarAxes.${key}`))

  const backgroundPolygons = [0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2
      points.push(`${cx + rMax * scale * Math.cos(angle)},${cy + rMax * scale * Math.sin(angle)}`)
    }
    return points.join(' ')
  })

  const clientPoints = RADAR_AXIS_KEYS.map((key, i) => {
    const scoreVal = scores[key]
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    const pct = scoreVal != null ? scoreVal / 100 : 0
    return `${cx + rMax * pct * Math.cos(angle)},${cy + rMax * pct * Math.sin(angle)}`
  }).join(' ')

  const hasData = RADAR_AXIS_KEYS.some((key) => scores[key] != null)
  if (!hasData) {
    return (
      <div className="w-full max-w-[200px] mx-auto aspect-square flex items-center justify-center text-slate-400 text-sm">
        —
      </div>
    )
  }

  return (
    <div className="w-full max-w-[180px] mx-auto aspect-square flex items-center justify-center">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200">
        {backgroundPolygons.map((pts, idx) => (
          <polygon key={idx} points={pts} fill="none" stroke="#E5E7EB" strokeWidth="0.8" />
        ))}
        {axes.map((axis, i) => {
          const angle = (i * Math.PI) / 3 - Math.PI / 2
          const xLine = cx + rMax * Math.cos(angle)
          const yLine = cy + rMax * Math.sin(angle)
          const xLabel = cx + (rMax + 14) * Math.cos(angle)
          const yLabel = cy + (rMax + 14) * Math.sin(angle)
          return (
            <g key={axis}>
              <line x1={cx} y1={cy} x2={xLine} y2={yLine} stroke="#E5E7EB" strokeWidth="0.8" />
              <text
                x={xLabel}
                y={yLabel}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[8px] font-bold fill-slate-400 font-sans"
              >
                {axis}
              </text>
            </g>
          )
        })}
        <polygon points={clientPoints} fill="rgba(94, 159, 139, 0.12)" stroke="#5e9f8b" strokeWidth="2" />
      </svg>
    </div>
  )
}

function BiologicalAgeScale({ faceAge, bioAgeBounds, bioAgeLabel, t }) {
  const face = typeof faceAge === 'number' && Number.isFinite(faceAge) ? faceAge : null
  const lo = bioAgeBounds?.lo ?? null
  const hi = bioAgeBounds?.hi ?? null
  const hasRange = lo != null && hi != null
  const bioDisplay = bioAgeLabel || (hasRange ? `${lo}–${hi}` : null)
  const isOutlier = face != null && hasRange && (face < lo || face > hi)

  // Axis: questionnaire range ± pad; expand if face sits outside so the marker stays on-line
  const pad = 5
  let axisMin = hasRange ? lo - pad : 20
  let axisMax = hasRange ? hi + pad : 50
  if (face != null) {
    axisMin = Math.min(axisMin, face - 2)
    axisMax = Math.max(axisMax, face + 2)
  }
  if (axisMax <= axisMin) axisMax = axisMin + 10
  const getPct = (val) => ((val - axisMin) / (axisMax - axisMin)) * 100
  const rangeLeft = hasRange ? getPct(lo) : 0
  const rangeWidth = hasRange ? Math.max(2, getPct(hi) - getPct(lo)) : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-end gap-3">
        <div>
          <p className="text-3xl font-bold text-slate-800 leading-none">{dashBlank(face)}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">{t('common.face')}</p>
        </div>
        <div>
          <p className={`font-bold text-slate-400 leading-none ${bioDisplay && String(bioDisplay).length > 3 ? 'text-2xl' : 'text-3xl'}`}>
            {bioDisplay || '—'}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">{t('common.bio')}</p>
        </div>
      </div>

      {hasRange ? (
        <div className="relative pt-5 pb-4">
          <div className="h-1.5 bg-slate-100 rounded-full w-full relative">
            <div
              className="absolute top-0 bottom-0 rounded-full bg-brand/35"
              style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
              title={bioDisplay || undefined}
            />
            {face != null ? (
              <div
                className={`absolute -top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                  isOutlier ? 'bg-amber-500' : 'bg-[#5e9f8b]'
                }`}
                style={{ left: `calc(${getPct(face)}% - 7px)` }}
                title={isOutlier ? t('executiveSummary.ageOutlier') : String(face)}
              />
            ) : null}
          </div>
          {face != null ? (
            <p
              className={`absolute text-[9px] font-bold tabular-nums -top-0.5 ${
                isOutlier ? 'text-amber-600' : 'text-brand-dark'
              }`}
              style={{
                left: `${getPct(face)}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {face}{isOutlier ? ` · ${t('executiveSummary.ageOutlier')}` : ''}
            </p>
          ) : null}
          <div className="flex justify-between text-[8px] text-slate-400 mt-2 font-mono tabular-nums">
            <span>{Math.round(axisMin)}</span>
            {hasRange ? <span className="text-ink-muted">{bioDisplay || `${lo}–${hi}`}</span> : null}
            <span>{Math.round(axisMax)}</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400">—</p>
      )}
    </div>
  )
}

function KpiCard({ label, value, parts = null }) {
  return (
    <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card px-4 py-3 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted truncate">{label}</p>
      <p className="text-base font-bold mt-1 tabular-nums truncate">
        {parts?.length ? (
          parts.map((part, i) => (
            <span key={i} className={part.brand ? 'text-brand' : 'text-ink'}>
              {part.text}
            </span>
          ))
        ) : (
          <span className="text-ink">{value}</span>
        )}
      </p>
    </div>
  )
}

export function ExecutiveSummary({
  cvReport,
  eyeAnalysis,
  aiNarrative,
  aiNarrativeLoading,
  protocolNarrative,
  photo,
  landmarks,
  metrics,
  answers,
  user = null,
  assessmentOwner = null,
  projectedAfter = null,
  assessmentId = null,
  createdAt = null,
  updatedAt = null,
  onNavigate,
  reportHref = null,
  onDownloadPdf = null,
  pdfLoading = false,
  canDownloadPdf = true,
}) {
  const t = useTranslations('Report')
  const locale = useLocale()
  const afterSrc = resolveProjectedAfterUrl(projectedAfter)
  const clientName = getClientName(answers, user, assessmentOwner)
  const firstName = clientName.split(/\s+/)[0] || clientName
  const protocolId = formatProtocolId(assessmentId)
  const reportDate = (() => {
    const raw = updatedAt || createdAt
    if (!raw) return '—'
    const ms = Date.parse(raw)
    if (!Number.isFinite(ms)) return '—'
    return new Date(ms).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  })()

  const dash = buildProtocolDashboardData({
    cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt,
  })
  const overviewText = protocolNarrative?.summary || aiNarrative?.content?.summary || null
  const treatment = resolveTreatmentPhases({ protocolNarrative, dash, t })

  const analysisTimeLabel = dash.analysisTimeDays
    ? t('executiveSummary.kpiAnalysisTimeValue', { days: dash.analysisTimeDays })
    : '—'

  const handleShare = useCallback(async () => {
    try {
      await shareReportPage(t('executiveSummary.shareTitle'))
    } catch {
      /* user cancelled share */
    }
  }, [t])

  return (
    <div className="w-full space-y-5 sm:space-y-6">
      {/* Top bar — PROTOCOL meta | Share + PDF */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] min-w-0">
          <span className="font-bold uppercase tracking-[0.14em] text-ink">
            {t('executiveSummary.protocolLabel')}
          </span>
          <span className="hidden sm:inline-block w-px h-3.5 bg-surface-border" aria-hidden />
          <span className="text-ink-muted font-sans truncate">{clientName}</span>
          <span className="text-ink-muted font-mono shrink-0">#{protocolId}</span>
          <span className="text-ink-muted shrink-0">{reportDate}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onDownloadPdf ? (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={!canDownloadPdf || pdfLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-surface-border bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink hover:bg-surface-warm disabled:opacity-50"
              title={!canDownloadPdf ? t('shell.pdfAfterApproval') : t('shell.downloadPdf')}
            >
              {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {t('shell.downloadPdf')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-brand/90"
          >
            <Share2 className="w-3 h-3" />
            {t('executiveSummary.shareButton')}
          </button>
        </div>
      </div>

      {/* KPI strip — brand-green numbers only (same as PDF page-1 metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label={t('executiveSummary.kpiOverallScore')}
          parts={dash.overallScore != null
            ? [
                { text: String(dash.overallScore), brand: true },
                { text: ' / 100', brand: false },
              ]
            : null}
          value="—"
        />
        <KpiCard
          label={t('executiveSummary.kpiEvaluated')}
          parts={dash.evaluatedPoints != null
            ? (() => {
                const full = t('executiveSummary.kpiEvaluatedValue', { count: dash.evaluatedPoints })
                const m = String(full).match(/^(\d[\d,]*\+?)(.*)$/)
                if (!m) return [{ text: full, brand: false }]
                return [
                  { text: m[1], brand: true },
                  ...(m[2] ? [{ text: m[2], brand: false }] : []),
                ]
              })()
            : null}
          value="—"
        />
        <KpiCard
          label={t('executiveSummary.kpiAnalysisTime')}
          parts={dash.analysisTimeDays != null
            ? (() => {
                const full = t('executiveSummary.kpiAnalysisTimeValue', { days: dash.analysisTimeDays })
                const m = String(full).match(/^(\d[\d,]*\+?)(.*)$/)
                if (!m) return [{ text: full, brand: false }]
                return [
                  { text: m[1], brand: true },
                  ...(m[2] ? [{ text: m[2], brand: false }] : []),
                ]
              })()
            : null}
          value="—"
        />
      </div>

      {/* 3-col: left (name+hero+priority) | center | treatment */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.65fr)_minmax(0,1fr)] gap-5 xl:gap-6 items-start">
        {/* Left column — same column as Priority Features */}
        <div className="space-y-3 min-w-0">
          <NameProtocolPlate
            firstName={firstName}
            protocolLine={t('executiveSummary.protocolIdLine', { id: protocolId })}
            reportHref={reportHref}
            reportLinkLabel={t('executiveSummary.namePlateViewReport')}
          />

          <FeatureAnalysisHero
            photo={photo}
            alt={t('executiveSummary.originalAlt')}
            t={t}
            landmarks={landmarks}
            overallScore={dash.overallScore}
            evaluatedLabel={dash.evaluatedPoints
              ? t('executiveSummary.kpiEvaluatedValue', { count: dash.evaluatedPoints })
              : '—'}
            analysisTimeLabel={analysisTimeLabel}
            compact
          />

          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted px-0.5 pt-2">
            {t('executiveSummary.priorityFeatures')}
          </p>

          {(dash.miniCards || []).map((card) => {
            const findings = (card.findings || []).filter((f) => f?.title)
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onNavigate?.(card.id)}
                className="w-full text-left rounded-xl border border-surface-border bg-white dark:bg-surface-card hover:bg-surface-warm transition-colors overflow-hidden h-auto"
              >
                <div className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12px] font-bold text-ink leading-tight min-w-0">
                      {t(`nav.${card.id}`)}
                    </p>
                    {card.score && (
                      <p className="text-[12px] font-bold text-ink tabular-nums shrink-0">
                        {card.score}
                      </p>
                    )}
                  </div>
                  {card.scoreLabel && (
                    <p className="mt-0.5 text-[10px] text-ink-muted text-right">
                      {card.scoreLabel}
                    </p>
                  )}
                  {findings.length > 0 && (
                    <div className="mt-2.5 border-t border-surface-border pt-2.5 space-y-1.5">
                      {findings.map((finding, lineIdx) => (
                        <div key={lineIdx} className="flex items-start justify-between gap-3">
                          <p className="text-[11px] font-semibold text-ink leading-snug min-w-0">
                            {finding.title}
                          </p>
                          <p className="text-[11px] text-ink-muted leading-snug text-right shrink-0 max-w-[55%] whitespace-normal break-words">
                            {finding.detail || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Center column */}
        <div className="flex flex-col gap-4 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-surface-warm border border-surface-border">
              {photo ? (
                <img src={photo} alt={t('executiveSummary.originalAlt')} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">{t('executiveSummary.originalPhoto')}</div>
              )}
              <span className="absolute bottom-2 left-2 rounded-full bg-slate-800/80 px-2 py-0.5 text-[8px] font-bold uppercase text-white">
                {t('executiveSummary.before')}
              </span>
            </div>
            <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-surface-warm border border-surface-border">
              {afterSrc ? (
                <img src={afterSrc} alt={t('executiveSummary.projectedAlt')} className="w-full h-full object-cover" />
              ) : photo ? (
                <PhotoLandmarkFrame
                  src={photo}
                  alt={t('executiveSummary.landmarksAlt')}
                  fit="cover"
                  className="opacity-90 h-full"
                  overlay={
                    landmarks?.length > 0 ? (
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {landmarks.map((pt) => (
                          <circle key={pt.id} cx={pt.x * 100} cy={pt.y * 100} r="0.28" fill="#5e9f8b" className="opacity-85" />
                        ))}
                      </svg>
                    ) : null
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">{t('executiveSummary.potentialScan')}</div>
              )}
              <span className="absolute bottom-2 left-2 rounded-full bg-brand px-2 py-0.5 text-[8px] font-bold uppercase text-white">
                {t('executiveSummary.potential')}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-4">
            <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2">
              {t('executiveSummary.facialAgeVsBio')}
            </p>
            <BiologicalAgeScale
              faceAge={dash.faceAge}
              bioAgeBounds={dash.bioAgeBounds}
              bioAgeLabel={dash.bioAgeLabel}
              t={t}
            />
          </div>

          <div className="grid grid-rows-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)] gap-4 flex-1 min-h-[360px]">
            <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-4 flex flex-col min-h-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-1 shrink-0">
                {t('executiveSummary.harmonyProfile')}
              </p>
              <div className="flex-1 flex items-center justify-center min-h-0">
                <RadarChart scores={dash.radarScores} t={t} />
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-4 flex flex-col min-h-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2 shrink-0">
                {t('executiveSummary.overviewHeading')}
              </p>
              <div className="flex-1 overflow-y-auto text-sm text-ink-secondary leading-relaxed pr-1">
                {aiNarrativeLoading ? (
                  <p className="animate-pulse">{t('executiveSummary.analyzingNarrative')}</p>
                ) : (
                  <p>{dashBlank(overviewText)}</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-white dark:bg-surface-card p-4 flex flex-col min-h-0 overflow-hidden">
              <p className="text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2 shrink-0">
                {t('executiveSummary.featureEvaluation')}
              </p>
              <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-surface-border text-[9px] text-ink-muted uppercase tracking-wider">
                      <th className="py-2 font-bold pr-2">{t('executiveSummary.zone')}</th>
                      <th className="py-2 font-bold pr-2">{t('executiveSummary.finding')}</th>
                      <th className="py-2 font-bold pr-2">{t('executiveSummary.reference')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {dash.featureRows.map((row) => (
                      <tr key={row.zoneKey}>
                        <td className="py-2 font-bold text-ink">{t(`executiveSummary.featureRows.${row.zoneKey}.zone`)}</td>
                        <td className="py-2 text-ink-secondary">{dashBlank(row.finding)}</td>
                        <td className="py-2 text-ink-muted">{dashBlank(row.ref)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — treatment protocol */}
        <TreatmentProtocolPhases
          title={t('executiveSummary.treatmentProtocol')}
          phases={treatment.phases}
          summary={treatment.summary}
          className="xl:sticky xl:top-0"
        />
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-border text-[10px] text-ink-muted">
        <span>—</span>
        <span>
          {t('executiveSummary.footerMetrics', {
            points: String(dash.evaluatedPoints || '—'),
          })}
        </span>
      </div>
    </div>
  )
}
