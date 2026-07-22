'use client'

/** Reference axis for facial-age marker (CV `visualAge`); not questionnaire bio age. */
const AXIS_MIN = 18
const AXIS_MAX = 65

function dashBlank(value) {
  return value != null && value !== '' ? value : '—'
}

/**
 * Protocol dashboard facial-age card — single CV estimate on a fixed reference scale.
 * Layout min-heights match the former face/bio two-column + bar block.
 */
export function FacialAgePanel({ faceAge, t, compact = false }) {
  const face = typeof faceAge === 'number' && Number.isFinite(faceAge) ? faceAge : null

  let axisMin = AXIS_MIN
  let axisMax = AXIS_MAX
  if (face != null) {
    axisMin = Math.min(axisMin, face - 4)
    axisMax = Math.max(axisMax, face + 4)
  }
  if (axisMax <= axisMin) axisMax = axisMin + 10

  const getPct = (val) => ((val - axisMin) / (axisMax - axisMin)) * 100
  const numberClass = compact ? 'text-xl' : 'text-3xl'
  const markerSize = compact ? 'w-2.5 h-2.5 -top-1' : 'w-3.5 h-3.5 -top-1.5'
  const markerOffset = compact ? 5 : 7
  const labelSize = compact ? 'text-[6px]' : 'text-[9px]'
  const axisSize = compact ? 'text-[5px]' : 'text-[8px]'

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-1 items-end justify-items-center ${compact ? 'min-h-0' : 'min-h-[52px]'}`}>
        <div className="text-center">
          <p className={`${numberClass} font-bold text-slate-800 leading-none tabular-nums`}>
            {dashBlank(face)}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">
            {t('executiveSummary.facialAge')}
          </p>
        </div>
      </div>

      <div className={`relative pt-5 pb-4 ${compact ? 'pt-3 pb-2' : ''} min-h-[44px]`}>
        <div className="h-1.5 bg-slate-100 rounded-full w-full relative">
          {face != null ? (
            <div
              className={`absolute ${markerSize} rounded-full border-2 border-white shadow-sm bg-[#5e9f8b]`}
              style={{ left: `calc(${getPct(face)}% - ${markerOffset}px)` }}
              title={String(face)}
            />
          ) : null}
        </div>
        {face != null ? (
          <p
            className={`absolute ${labelSize} font-bold tabular-nums -top-0.5 text-brand-dark`}
            style={{ left: `${getPct(face)}%`, transform: 'translateX(-50%)' }}
          >
            {face}
          </p>
        ) : null}
        <div className={`flex justify-between ${axisSize} text-slate-400 mt-2 font-mono tabular-nums`}>
          <span>{Math.round(axisMin)}</span>
          <span>{Math.round(axisMax)}</span>
        </div>
      </div>
    </div>
  )
}
