import { safeDisplay } from '../../utils/safeFormat'

function MetricCard({ label, value, tooltip }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-3 relative group">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 rounded-lg bg-slate-800 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

function BrightnessBar({ value, max = 200 }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-surface-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #1e1b4b, #6366f1, #a5b4fc, #fef3c7)',
          }}
        />
      </div>
      <span className="text-xs font-medium text-ink tabular-nums min-w-[3ch] text-right">{value}</span>
    </div>
  )
}

function RednessBar({ value, max = 25 }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-surface-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #fef3c7, #fbbf24, #ef4444, #991b1b)',
          }}
        />
      </div>
      <span className="text-xs font-medium text-ink tabular-nums min-w-[3ch] text-right">{value}</span>
    </div>
  )
}

function RegionalBar({ regions }) {
  if (!regions?.length) return null
  const maxBright = Math.max(...regions.map(r => r.brightness), 1)
  return (
    <div className="space-y-2.5">
      {regions.map((r) => {
        const pct = (r.brightness / maxBright) * 100
        const redPct = Math.min(100, (r.redness / 20) * 100)
        return (
          <div key={r.name} className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-ink-muted">{r.name}</span>
              <span className="text-[11px] text-ink tabular-nums">{safeDisplay(r.brightness)} <span className="text-ink-faint">· R:{safeDisplay(r.redness)}</span></span>
            </div>
            <div className="flex gap-1">
              <div className="flex-1 h-2.5 rounded-full bg-surface-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, #92400e, #d97706, #fbbf24)',
                  }}
                />
              </div>
              <div className="w-12 h-2.5 rounded-full bg-surface-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${redPct}%`,
                    background: 'linear-gradient(90deg, #fecaca, #ef4444)',
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
      <div className="flex gap-1 text-[9px] text-ink-faint">
        <span className="flex-1">← Brightness</span>
        <span className="w-12 text-right">Redness →</span>
      </div>
    </div>
  )
}

function SymmetryBar({ left, right, leftLabel, rightLabel }) {
  const lPct = Math.min(100, Math.max(5, (left / (left + right || 1)) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] text-ink-muted font-sans">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="relative h-3 rounded-full bg-surface-border overflow-hidden flex">
        <div className="h-full bg-brand/60 rounded-l-full transition-all duration-500" style={{ width: `${lPct}%` }} />
        <div className="h-full bg-rose-400/60 rounded-r-full transition-all duration-500" style={{ width: `${100 - lPct}%` }} />
      </div>
    </div>
  )
}

export function SkinReportPanel({ skin }) {
  if (!skin) return null

  const s = skin
  const regions = s.regions || []

  // Find L/R cheek from regions for the symmetry bar
  const lCheek = regions.find(r => r.name === 'Left cheek')?.brightness || 120
  const rCheek = regions.find(r => r.name === 'Right cheek')?.brightness || 120

  // Skin tone color dot
  const toneColors = {
    'Fair': '#fde8cd', 'Light': '#f5d0a9', 'Medium': '#d4a574',
    'Olive': '#b8864e', 'Tan': '#8b6338', 'Deep': '#5a3620',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">An overview of your skin</h3>
        <p className="text-[10px] text-ink-muted font-sans mb-4">Canvas pixel analysis from 6 facial regions · $0 API cost</p>
        {s.imageSrc && (
          <FaceImageFrame src={s.imageSrc} alt="Your skin" aspect="auto" maxW="380px" />
        )}
      </div>

      {/* ── Section 1: Skin Tone & Type ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Skin Tone & Type</p>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full border-2 border-surface-border shadow-sm" style={{ backgroundColor: toneColors[s.skinTone] || '#d4a574' }} />
          <div>
            <p className="text-base font-medium text-ink">{s.skinTone} skin tone</p>
            <p className="text-[11px] text-ink-muted">Average brightness: {s.brightness} · {s.texture}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Tone Uniformity" value={s.tone} tooltip="Left-right cheek brightness balance. Even tone indicates uniform melanin distribution and healthy skin." />
          <MetricCard label="Texture" value={s.texture} tooltip="Brightness-based hydration estimate. Well-hydrated skin reflects light more evenly, appearing luminous." />
          <MetricCard label="Clarity" value={s.clarity} tooltip="Combination of redness, tone uniformity, and pigmentation. Good clarity means clear, even-toned skin." />
          <MetricCard label="Pigmentation" value={s.pigmentation} tooltip="Regional brightness variance across face. Even pigmentation indicates uniform melanin, while variation may suggest sun damage." />
        </div>
      </div>

      {/* ── Section 2: Redness & Sensitivity ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Redness & Sensitivity</p>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-ink">{s.redness}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              s.redness === 'Normal'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {s.redness === 'Normal' ? 'Healthy' : 'Review'}
            </span>
          </div>
          <p className="text-[11px] text-ink-muted mb-2">Average redness index across 4 primary zones</p>
          <RednessBar value={parseFloat(s.regionalVariance || '0')} max={50} />
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          {s.redness === 'Normal'
            ? 'No abnormal redness detected across facial regions. Skin appears calm with healthy circulation.'
            : `${s.redness} detected. Consider anti-inflammatory ingredients like niacinamide, centella asiatica, or azelaic acid to reduce sensitivity.`}
        </p>
      </div>

      {/* ── Section 3: Under-Eye Area ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Under-Eye Area</p>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">{s.underEyeHealth}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
            s.underEyeHealth === 'Bright' || s.underEyeHealth === 'Good'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : s.underEyeHealth === 'Shadowed'
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}>
            {s.underEyeBrightness}
          </span>
        </div>
        <div className="mb-3">
          <p className="text-[11px] text-ink-muted mb-2">Under-eye brightness level</p>
          <BrightnessBar value={parseInt(s.underEyeBrightness || '120')} max={200} />
          <div className="flex justify-between text-[10px] text-ink-faint font-sans mt-1">
            <span>Dark</span>
            <span>Bright</span>
          </div>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          {s.underEyeHealth === 'Dark circles present'
            ? 'Darker under-eye pigmentation detected. Could be caused by thin skin, poor sleep, dehydration, or genetic factors. Retinol eye creams and cold compresses may help.'
            : s.underEyeHealth === 'Shadowed'
            ? 'Mild shadowing under the eyes. Adequate sleep, hydration, and vitamin C serums can help brighten the periorbital area.'
            : `Under-eye area appears ${s.underEyeHealth.toLowerCase()}, indicating good skin thickness and circulation.`}
        </p>
      </div>

      {/* ── Section 4: T-Zone & Pore Analysis ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">T-Zone & Pore Analysis</p>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">{s.poreEstimate}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
            s.poreEstimate === 'Balanced T-zone'
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-amber-700 bg-amber-50 border-amber-200'
          }`}>
            {s.poreEstimate === 'Balanced T-zone' ? 'Balanced' : 'Attention'}
          </span>
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          {s.poreEstimate === 'Oily T-zone'
            ? 'The nose bridge shows higher brightness than the forehead, suggesting excess sebum production in the T-zone. Clay masks, salicylic acid, and oil-free moisturizers can help manage oiliness.'
            : s.poreEstimate === 'Dry T-zone'
            ? 'The T-zone shows lower brightness than surrounding areas, suggesting dryness. Consider hydrating serums with hyaluronic acid and a richer moisturizer in this area.'
            : 'T-zone brightness is balanced with the forehead, indicating well-regulated sebum production across the central face.'}
        </p>
      </div>

      {/* ── Section 5: Regional Analysis ── */}
      {regions.length > 0 && (
        <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Regional Brightness Map</p>
          <RegionalBar regions={regions} />

          {/* Left-right symmetry */}
          <div className="mt-4">
            <p className="text-[11px] text-ink-muted mb-2">Cheek brightness symmetry</p>
            <SymmetryBar left={lCheek} right={rCheek} leftLabel="L cheek" rightLabel="R cheek" />
            <p className="text-[10px] text-ink-faint mt-1.5">
              {s.tone === 'Even' ? 'Cheeks are well-balanced — uniform tone across both sides.' : `Tone difference of ~${Math.abs(lCheek - rCheek).toFixed(0)} brightness units. ${s.tone === 'Slightly uneven' ? 'Minor variation that is typically imperceptible.' : 'Consider even-toning treatments for the darker side.'}`}
            </p>
          </div>
        </div>
      )}

      {/* ── Overall Score ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-5">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">Overall Skin Score</p>
        <div className="flex items-end gap-3 mb-4">
          <span className="text-4xl font-display font-bold text-brand">{s.score}</span>
          <span className="text-sm text-ink-muted mb-1">/ 100</span>
          <span className="ml-auto text-sm font-medium text-brand bg-brand-50 px-3 py-1 rounded-full border border-brand/20">{s.scoreLabel}</span>
        </div>
        <div className="relative h-2 rounded-full bg-surface-border mb-2">
          <div className="absolute top-0 bottom-0 rounded-full bg-brand/20" style={{ left: '50%', width: '45%' }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-brand shadow-glow"
            style={{ left: `calc(${s.score}% - 7px)` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ink-faint font-sans mb-4">
          <span>Needs care</span>
          <span>Clear</span>
        </div>
      </div>

      {/* ── Full Explanation ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">Full Analysis Summary</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{safeDisplay(s.explanation)}</p>
      </div>
    </div>
  )
}
