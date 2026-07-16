'use client'

import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { PhotoLandmarkFrame } from './FaceImageFrame'
import { resolveProjectedAfterUrl } from '../../utils/projectedAfter'

const RADAR_AXIS_KEYS = ['symmetry', 'smoothness', 'jawline', 'skin', 'volume', 'harmony']
const FEATURE_ROW_KEYS = ['forehead', 'eyes', 'nose', 'lips', 'jawline']

function RadarChart({ scores, t }) {
  const cx = 100
  const cy = 100
  const rMax = 70
  const axes = RADAR_AXIS_KEYS.map((key) => t(`executiveSummary.radarAxes.${key}`))

  const backgroundPolygons = [0.2, 0.4, 0.6, 0.8, 1].map((scale) => {
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2
      const x = cx + rMax * scale * Math.cos(angle)
      const y = cy + rMax * scale * Math.sin(angle)
      points.push(`${x},${y}`)
    }
    return points.join(' ')
  })

  const clientPoints = RADAR_AXIS_KEYS.map((key, i) => {
    const scoreVal = scores[key] || 80
    const angle = (i * Math.PI) / 3 - Math.PI / 2
    const x = cx + rMax * (scoreVal / 100) * Math.cos(angle)
    const y = cy + rMax * (scoreVal / 100) * Math.sin(angle)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="w-full max-w-[200px] mx-auto aspect-square flex items-center justify-center">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 200 200">
        {backgroundPolygons.map((pts, idx) => (
          <polygon
            key={idx}
            points={pts}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="0.8"
          />
        ))}

        {axes.map((axis, i) => {
          const angle = (i * Math.PI) / 3 - Math.PI / 2
          const xLine = cx + rMax * Math.cos(angle)
          const yLine = cy + rMax * Math.sin(angle)
          const xLabel = cx + (rMax + 14) * Math.cos(angle)
          const yLabel = cy + (rMax + 14) * Math.sin(angle)

          return (
            <g key={axis}>
              <line
                x1={cx}
                y1={cy}
                x2={xLine}
                y2={yLine}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="0.8"
              />
              <text
                x={xLabel}
                y={yLabel}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[9px] font-bold fill-slate-500 dark:fill-slate-400 font-sans"
              >
                {axis}
              </text>
            </g>
          )
        })}

        <polygon
          points={clientPoints}
          fill="rgba(94, 159, 139, 0.15)"
          stroke="#5e9f8b"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}

function BiologicalAgeScale({ faceAge = 28, bioAge = 33, t }) {
  const diff = bioAge - faceAge
  const diffLabel = diff > 0
    ? t('common.yearsYounger', { count: diff })
    : diff < 0
      ? t('common.yearsOlder', { count: Math.abs(diff) })
      : t('common.sameAge')
  const isYounger = diff >= 0

  const minVal = 20
  const maxVal = 50
  const clamp = (val) => Math.min(Math.max(val, minVal), maxVal)
  const getPct = (val) => ((clamp(val) - minVal) / (maxVal - minVal)) * 100

  const facePct = getPct(faceAge)
  const bioPct = getPct(bioAge)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 items-center border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{faceAge}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400">{t('common.face')}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{bioAge}</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 font-medium">{t('common.bio')}</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
            isYounger ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600'
          }`}>
            {diffLabel}
          </span>
        </div>
      </div>

      <div className="relative pt-2 pb-4">
        <div className="h-1 bg-slate-150 dark:bg-slate-800 rounded-full w-full relative">
          {[20, 30, 40, 50].map((tick) => (
            <div
              key={tick}
              className="absolute w-0.5 h-1.5 bg-slate-300 dark:bg-slate-700"
              style={{ left: `${getPct(tick)}%`, top: '-0.25rem' }}
            />
          ))}

          <div
            className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-slate-400 dark:bg-slate-600 border-2 border-white dark:border-slate-900 shadow-sm"
            style={{ left: `calc(${bioPct}% - 7px)` }}
            title={`Bio Age: ${bioAge}`}
          />

          <div
            className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-[#5e9f8b] border-2 border-white dark:border-slate-900 shadow-sm"
            style={{ left: `calc(${facePct}% - 7px)` }}
            title={`Face Age: ${faceAge}`}
          />
        </div>
        <div className="flex justify-between text-[8px] text-slate-400 mt-2 font-mono">
          <span>20</span>
          <span>30</span>
          <span>40</span>
          <span>50</span>
        </div>
      </div>
    </div>
  )
}

export function ExecutiveSummary({
  cvReport,
  eyeAnalysis: _eyeAnalysis,
  aiNarrative,
  aiNarrativeLoading,
  aiNarrativeError: _aiNarrativeError,
  photo,
  landmarks,
  metrics,
  answers,
  projectedAfter = null,
}) {
  const t = useTranslations('Report')
  const afterSrc = resolveProjectedAfterUrl(projectedAfter)
  const overall = cvReport?.overall || {}
  const faceAge = metrics?.visualAge || overall?.visualAge || 28
  const bioAge = answers?.age || overall?.chronologicalAge || 33

  const radarScores = {
    symmetry: metrics?.symmetryScore || cvReport?.symmetry?.score || 81,
    smoothness: cvReport?.skin?.uniformity || 75,
    jawline: metrics?.jawlineScore || cvReport?.structure?.score || 80,
    skin: metrics?.skinScore || cvReport?.skin?.score || 76,
    volume: metrics?.proportionsScore || cvReport?.proportions?.score || 82,
    harmony: metrics?.harmonyScore || cvReport?.overall?.score || 81,
  }

  const featureRows = [
    { zoneKey: 'forehead', isOk: false },
    { zoneKey: 'eyes', isOk: true },
    { zoneKey: 'nose', isOk: false },
    { zoneKey: 'lips', isOk: true },
    { zoneKey: 'jawline', isOk: false },
  ]

  return (
    <div className="space-y-8 qoves-overview-document">
      <div>
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1">
          {t('executiveSummary.aestheticSummary')}
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight">{t('executiveSummary.executiveDashboard')}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('executiveSummary.beforeOriginal')}</p>
          <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            {photo ? (
              <img src={photo} alt={t('executiveSummary.originalAlt')} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">{t('executiveSummary.originalPhoto')}</div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              {t('executiveSummary.before')}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {afterSrc ? t('executiveSummary.potentialProjected') : t('executiveSummary.potentialLandmarks')}
          </p>
          <div className="relative">
            {afterSrc ? (
              <div className="relative rounded-2xl overflow-hidden aspect-[4/5] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <img src={afterSrc} alt={t('executiveSummary.projectedAlt')} className="w-full h-full object-cover" />
                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {t('executiveSummary.potential')}
                </div>
              </div>
            ) : photo ? (
              <PhotoLandmarkFrame
                src={photo}
                alt={t('executiveSummary.landmarksAlt')}
                fit="cover"
                className="opacity-90"
                overlay={
                  landmarks?.length > 0 ? (
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      {landmarks.map((pt) => (
                        <circle
                          key={pt.id}
                          cx={pt.x * 100}
                          cy={pt.y * 100}
                          r="0.28"
                          fill="#5e9f8b"
                          className="opacity-85"
                        />
                      ))}
                    </svg>
                  ) : null
                }
              />
            ) : (
              <div className="aspect-[4/5] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-400">
                {t('executiveSummary.potentialScan')}
              </div>
            )}
            {!afterSrc && photo && (
              <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider pointer-events-none z-[2]">
                {t('executiveSummary.potential')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-5 border border-slate-150 dark:border-slate-900/40">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3">{t('executiveSummary.facialAgeVsBio')}</p>
        <BiologicalAgeScale faceAge={faceAge} bioAge={bioAge} t={t} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6 items-center bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-5 border border-slate-150 dark:border-slate-900/40">
        <div>
          <RadarChart scores={radarScores} t={t} />
        </div>
        <div className="space-y-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t('executiveSummary.harmonyProfile')}</p>
          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-3 font-sans">
            {aiNarrativeLoading ? (
              <p className="animate-pulse">{t('executiveSummary.analyzingNarrative')}</p>
            ) : aiNarrative?.content?.summary ? (
              <p>{aiNarrative.content.summary}</p>
            ) : (
              <p>{t('executiveSummary.fallbackNarrative')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-50/50 dark:bg-slate-950/20 rounded-3xl p-5 border border-slate-150 dark:border-slate-900/40 overflow-x-auto">
        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-4">{t('executiveSummary.featureEvaluation')}</p>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
              <th className="py-2.5 font-bold">{t('executiveSummary.zone')}</th>
              <th className="py-2.5 font-bold">{t('executiveSummary.finding')}</th>
              <th className="py-2.5 font-bold">{t('executiveSummary.reference')}</th>
              <th className="py-2.5 font-bold text-right">{t('executiveSummary.evaluation')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150/40 dark:divide-slate-850/50">
            {featureRows.map((row) => (
              <tr key={row.zoneKey}>
                <td className="py-3 font-bold text-slate-800 dark:text-slate-200">{t(`executiveSummary.featureRows.${row.zoneKey}.zone`)}</td>
                <td className="py-3 font-medium text-slate-600 dark:text-slate-400">{t(`executiveSummary.featureRows.${row.zoneKey}.befund`)}</td>
                <td className="py-3 text-slate-400">{t(`executiveSummary.featureRows.${row.zoneKey}.ref`)}</td>
                <td className="py-3 text-right">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                    row.isOk
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  }`}>
                    {row.isOk ? t('common.ok') : t('common.review')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
