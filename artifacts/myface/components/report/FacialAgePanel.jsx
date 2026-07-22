'use client'

/** Reference axis for facial-age marker (CV `visualAge`); not questionnaire bio age. */
const AXIS_MIN = 5
const AXIS_MAX = 65

function dashBlank(value) {
  return value != null && value !== '' ? value : '—'
}

/**
 * Protocol dashboard facial-age card — large age on the left; thicker scale on the right
 * with a vertical needle at the estimate and the age under the needle.
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

  const pct = face != null ? ((face - axisMin) / (axisMax - axisMin)) * 100 : null
  const numberClass = compact ? 'text-2xl' : 'text-4xl'
  const axisSize = compact ? 'text-[5px]' : 'text-[8px]'
  const needleLabel = compact ? 'text-[7px]' : 'text-[10px]'
  const trackH = compact ? 'h-1.5' : 'h-2.5'
  const needleH = compact ? 'h-8' : 'h-11'

  return (
    <div className={`flex items-center gap-3 ${compact ? 'gap-2 min-h-0' : 'min-h-[56px]'}`}>
      <div className="shrink-0 text-left leading-none w-[3.25rem]">
        <p className={`${numberClass} font-bold text-slate-800 tabular-nums`}>
          {dashBlank(face)}
        </p>
        {!compact ? (
          <p className="text-[8px] uppercase tracking-wider text-slate-400 mt-1.5">
            {t('executiveSummary.facialAge')}
          </p>
        ) : null}
      </div>

      <div className={`relative flex-1 min-w-0 ${compact ? 'h-11' : 'h-14'}`}>
        <div className="absolute inset-x-0 top-[28%] flex items-center gap-1.5">
          <span className={`${axisSize} text-slate-400 font-mono tabular-nums shrink-0`}>
            {Math.round(axisMin)}
          </span>
          <div className={`relative flex-1 ${trackH} rounded-full bg-slate-200 dark:bg-slate-700`}>
            {pct != null ? (
              <div
                className="absolute top-1/2 flex flex-col items-center"
                style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className={`${needleH} bg-[#5e9f8b] rounded-full`}
                  style={{ width: compact ? 2 : 2.5 }}
                  title={String(face)}
                />
                <p
                  className={`absolute ${needleLabel} font-bold tabular-nums text-brand-dark leading-none whitespace-nowrap`}
                  style={{ top: '100%', marginTop: compact ? 2 : 4 }}
                >
                  {face}
                </p>
              </div>
            ) : null}
          </div>
          <span className={`${axisSize} text-slate-400 font-mono tabular-nums shrink-0`}>
            {Math.round(axisMax)}
          </span>
        </div>
      </div>
    </div>
  )
}
