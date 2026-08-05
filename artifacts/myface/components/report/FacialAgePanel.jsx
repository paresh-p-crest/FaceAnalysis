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
export function FacialAgePanel({ faceAge, ageRange = null, t, compact = false, hideLeft = false }) {
  const face = typeof faceAge === 'number' && Number.isFinite(faceAge) ? faceAge : null
  const displayValue = ageRange || (face != null ? String(face) : null)

  let numericAge = face
  let parts = null
  if (ageRange && typeof ageRange === 'string') {
    const parsed = ageRange.split('-').map(Number)
    if (parsed.length === 2 && !isNaN(parsed[0]) && !isNaN(parsed[1])) {
      parts = parsed
      numericAge = (parsed[0] + parsed[1]) / 2
    }
  }

  const axisMin = AXIS_MIN
  const axisMax = AXIS_MAX

  const pct = numericAge != null ? ((numericAge - axisMin) / (axisMax - axisMin)) * 100 : null
  const pctMin = parts ? ((parts[0] - axisMin) / (axisMax - axisMin)) * 100 : null
  const pctMax = parts ? ((parts[1] - axisMin) / (axisMax - axisMin)) * 100 : null

  const numberClass = compact ? 'text-xl' : 'text-3xl'
  const axisSize = compact ? 'text-[5px]' : 'text-[8px]'
  const needleLabel = compact ? 'text-[7px]' : 'text-[10px]'
  const trackH = compact ? 'h-1.5' : 'h-2.5'
  const needleH = compact ? 'h-8' : 'h-11'

  return (
    <div className={`flex items-start gap-3 ${compact ? 'gap-2 min-h-0' : 'min-h-[56px]'}`}>
      {!hideLeft && (
        <div className={`shrink-0 text-left leading-none w-[6rem] ${compact ? 'pt-[5px]' : 'pt-[6px]'}`}>
          <p className={`${numberClass} font-bold text-slate-800 tabular-nums whitespace-nowrap`}>
            {dashBlank(displayValue)}
          </p>
        </div>
      )}

      <div className={`relative flex-1 min-w-0 ${compact ? 'h-11' : 'h-14'}`}>
        <div className="absolute inset-x-0 top-[28%] flex items-center gap-1.5">
          <span className={`${axisSize} text-slate-400 font-mono tabular-nums shrink-0`}>
            {Math.round(axisMin)}
          </span>
          <div className={`relative flex-1 ${trackH} rounded-full bg-slate-200 dark:bg-slate-700 overflow-visible`}>
            {parts && pctMin != null && pctMax != null ? (
              <>
                {/* Highlighted range track with theme mist green fill */}
                <div
                  className="absolute top-0 bottom-0 bg-[#5e9f8b]/20"
                  style={{
                    left: `${Math.max(0, Math.min(100, pctMin))}%`,
                    width: `${Math.max(0, Math.min(100, pctMax - pctMin))}%`,
                  }}
                />
                {/* Lower bound tick */}
                <div
                  className="absolute top-1/2 w-[2.5px] bg-[#5e9f8b]"
                  style={{
                    left: `${Math.max(0, Math.min(100, pctMin))}%`,
                    height: compact ? '10px' : '14px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                {/* Upper bound tick */}
                <div
                  className="absolute top-1/2 w-[2.5px] bg-[#5e9f8b]"
                  style={{
                    left: `${Math.max(0, Math.min(100, pctMax))}%`,
                    height: compact ? '10px' : '14px',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                {/* Lower bound label */}
                <p
                  className={`absolute ${needleLabel} font-bold tabular-nums text-brand-dark leading-none whitespace-nowrap`}
                  style={{
                    left: `${Math.max(0, Math.min(100, pctMin))}%`,
                    top: '100%',
                    transform: 'translateX(-50%)',
                    marginTop: compact ? 3 : 5,
                  }}
                >
                  {parts[0]}
                </p>
                {/* Upper bound label */}
                <p
                  className={`absolute ${needleLabel} font-bold tabular-nums text-brand-dark leading-none whitespace-nowrap`}
                  style={{
                    left: `${Math.max(0, Math.min(100, pctMax))}%`,
                    top: '100%',
                    transform: 'translateX(-50%)',
                    marginTop: compact ? 3 : 5,
                  }}
                >
                  {parts[1]}
                </p>
              </>
            ) : pct != null ? (
              <div
                className="absolute top-1/2 flex flex-col items-center"
                style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className={`${needleH} bg-[#5e9f8b] rounded-full`}
                  style={{ width: compact ? 2 : 2.5 }}
                  title={String(displayValue)}
                />
                <p
                  className={`absolute ${needleLabel} font-bold tabular-nums text-brand-dark leading-none whitespace-nowrap`}
                  style={{ top: '100%', marginTop: compact ? 2 : 4 }}
                >
                  {displayValue}
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
