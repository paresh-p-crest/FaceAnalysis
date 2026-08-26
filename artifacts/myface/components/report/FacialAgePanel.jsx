'use client'

/** Reference axis for facial-age marker (CV `visualAge`); not questionnaire bio age. */
const AXIS_MIN = 5
const AXIS_MAX = 65

function dashBlank(value) {
  return value != null && value !== '' ? value : '—'
}

function ageAxisBounds(ages) {
  let axisMin = AXIS_MIN
  let axisMax = AXIS_MAX
  for (const age of ages) {
    if (age == null) continue
    axisMin = Math.min(axisMin, age - 4)
    axisMax = Math.max(axisMax, age + 4)
  }
  if (axisMax <= axisMin) axisMax = axisMin + 10
  return { axisMin, axisMax }
}

function AgeScaleRow({
  label,
  age,
  axisMin,
  axisMax,
  needleClass,
  labelClass,
  numberClass: numberColorClass = 'text-slate-800',
  compact,
}) {
  const pct = age != null ? ((age - axisMin) / (axisMax - axisMin)) * 100 : null
  const axisSize = compact ? 'text-[5px]' : 'text-[8px]'
  const needleLabel = compact ? 'text-[6px]' : 'text-[10px]'
  const trackH = compact ? 'h-1.5' : 'h-3'
  const needleH = compact ? 'h-6' : 'h-11'
  const numberSize = compact ? 'text-sm' : 'text-4xl'

  return (
    <div className={`flex items-center gap-2.5 ${compact ? 'min-h-[2.75rem]' : 'min-h-[56px]'}`}>
      <div className={`shrink-0 text-left leading-none ${compact ? 'w-[4.75rem]' : 'w-[3.25rem]'}`}>
        {label ? (
          <p
            className={`facial-age-row-label ${compact ? 'text-[6px]' : 'text-[8px]'} text-ink-muted leading-tight ${compact ? 'mb-1' : 'mb-0.5'}`}
          >
            {label}
          </p>
        ) : null}
        <p className={`${numberSize} font-bold tabular-nums ${numberColorClass}`}>
          {dashBlank(age)}
        </p>
      </div>

      <div className={`relative flex-1 min-w-0 ${compact ? 'h-9' : 'h-14'}`}>
        <div className="absolute inset-x-0 top-[32%] flex items-center gap-1.5">
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
                  className={`${needleH} ${needleClass} rounded-full`}
                  style={{ width: compact ? 2 : 2.5 }}
                  title={String(age)}
                />
                <p
                  className={`absolute ${needleLabel} font-bold tabular-nums ${labelClass} leading-none whitespace-nowrap`}
                  style={{ top: '100%', marginTop: compact ? 3 : 4 }}
                >
                  {age}
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

/**
 * Protocol dashboard facial-age card.
 * Dual mode when `potentialAge` is set (Altersprofil + Potenzialprofil).
 */
export function FacialAgePanel({ faceAge, potentialAge = null, t, compact = false }) {
  const face = typeof faceAge === 'number' && Number.isFinite(faceAge) ? faceAge : null
  const potential =
    typeof potentialAge === 'number' && Number.isFinite(potentialAge) ? potentialAge : null

  if (face != null && potential != null) {
    const { axisMin, axisMax } = ageAxisBounds([face, potential])
    return (
      <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-3'}`}>
        <AgeScaleRow
          label={t('executiveSummary.ageProfile')}
          age={face}
          axisMin={axisMin}
          axisMax={axisMax}
          needleClass="bg-slate-700"
          labelClass="text-slate-700"
          compact={compact}
        />
        <AgeScaleRow
          label={t('executiveSummary.potentialAgeProfile')}
          age={potential}
          axisMin={axisMin}
          axisMax={axisMax}
          needleClass="bg-[#5e9f8b]"
          labelClass="text-[#5e9f8b]"
          numberClass="text-[#5e9f8b]"
          compact={compact}
        />
      </div>
    )
  }

  const { axisMin, axisMax } = ageAxisBounds([face])
  return (
    <AgeScaleRow
      label={compact ? null : t('executiveSummary.facialAge')}
      age={face}
      axisMin={axisMin}
      axisMax={axisMax}
      needleClass="bg-[#5e9f8b]"
      labelClass="text-brand-dark"
      compact={compact}
    />
  )
}
