import { FaceImageFrame } from './FaceImageFrame'

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

function BrightnessBar({ value, max = 200 }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full bg-surface-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #92400e, #d97706, #fbbf24, #fef3c7)',
            }}
          />
        </div>
        <span className="text-xs font-medium text-ink tabular-nums min-w-[3ch] text-right">{value}</span>
      </div>
    </div>
  )
}

export function CheekReportPanel({ cheeks }) {
  if (!cheeks) return null

  const c = cheeks

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-display text-lg font-semibold text-ink mb-1">An overview of your cheeks</h3>
        <p className="text-[10px] text-ink-muted font-sans mb-4">MediaPipe landmarks + Canvas pixel analysis · $0 API cost</p>
        {c.imageSrc && (
          <FaceImageFrame src={c.imageSrc} alt="Your cheeks" aspect="auto" maxW="380px" />
        )}
      </div>

      {/* ── Section 1: Cheekbone Structure ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Cheekbone Structure</p>
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-medium text-ink">{c.scoreLabel} structure</p>
          <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full border ${
            c.score >= 85
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : c.score >= 70
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}>
            {c.score}/100
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <MetricCard
            label="Cheekbone Height"
            value={c.cheekboneHeightClass}
            tooltip="Vertical position of cheekbones relative to nose tip. High cheekbones are a hallmark of facial aesthetics, associated with youth and elegance."
          />
          <MetricCard
            label="Prominence"
            value={c.prominence}
            tooltip="Forward projection of cheekbones (estimated from z-depth). Prominent cheekbones create shadow play and dimension."
          />
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Cheekbone height: {c.cheekboneHeight}% of face height ({c.cheekboneHeightClass}). Projection: {c.prominence}. {c.cheekboneHeightClass === 'High' ? 'High-set cheekbones create a lifted, youthful appearance.' : c.cheekboneHeightClass === 'Medium' ? 'Medium-set cheekbones provide balanced facial framing.' : 'Lower-set cheekbones contribute to a softer facial contour.'}
        </p>
      </div>

      {/* ── Section 2: Cheek Width & Volume ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Cheek Width & Volume</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <MetricCard
            label="Cheek Width"
            value={`${c.cheekWidthClass} (${c.cheekWidth}%)`}
            tooltip="Distance between left and right cheekbones as a percentage of face width. Moderate width creates balanced facial proportions."
          />
          <MetricCard
            label="Apple Volume"
            value={c.appleVolume}
            tooltip="Fullness of the cheek apple region. Full apples create a youthful, healthy appearance. Flat apples can appear hollow."
          />
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Cheek width spans {c.cheekWidth}% of face width ({c.cheekWidthClass}). Apple volume: {c.appleVolume}. {c.appleVolume === 'Full' ? 'Full cheek apples add a healthy, youthful roundness.' : c.appleVolume === 'Moderate' ? 'Moderate volume provides balanced facial contours.' : 'Flatter cheek apples may benefit from volumizing treatments.'}
        </p>
      </div>

      {/* ── Section 3: Midface & Transitions ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Midface & Transitions</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <MetricCard
            label="Midface Length"
            value={`${c.midfaceClass} (${c.midfaceLength}%)`}
            tooltip="Vertical distance from nose tip to cheekbone line, as a percentage of face height. A balanced midface contributes to harmonious proportions."
          />
          <MetricCard
            label="Jaw-to-Cheek"
            value={c.jawCheekTransition}
            tooltip="The transition angle from jawline to cheekbone. Smooth transitions create elegant contours, while angular transitions add definition."
          />
        </div>
        <p className="text-xs text-ink-secondary leading-relaxed">
          Midface length: {c.midfaceLength}% of face height ({c.midfaceClass}). Jaw-to-cheek transition: {c.jawCheekTransition} at {c.jawCheekAngle}°. {c.midfaceClass === 'Balanced' ? 'Midface proportions are harmonious with other facial thirds.' : c.midfaceClass === 'Long' ? 'A longer midface can create a more mature, elegant appearance.' : 'A shorter midface contributes to a compact, youthful look.'}
        </p>
      </div>

      {/* ── Section 4: Pixel Analysis ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Cheek Skin Quality</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <MetricCard label="Blush" value={c.blushLevel} tooltip="Natural redness detected in the apple region. Natural flush creates a healthy, vibrant appearance." />
          <MetricCard label="Texture" value={c.skinTexture} tooltip="Surface smoothness based on brightness analysis. Luminous skin reflects light evenly for a radiant look." />
          <MetricCard label="Contour Definition" value={c.contourDef} tooltip="Shadow definition under the cheekbone. Well-defined contours create facial dimension without makeup." />
          <MetricCard label="Evenness" value={c.evennessLabel} tooltip="Left-right brightness balance. Even cheeks indicate uniform skin tone and healthy circulation." />
        </div>

        {/* Blush intensity */}
        <div className="mb-4">
          <p className="text-[11px] text-ink-muted mb-2">Apple region redness index</p>
          <BrightnessBar value={Math.round(parseFloat(c.appleRedness || '0'))} max={25} />
          <p className="text-[10px] text-ink-faint mt-1">0 = no warmth · 15+ = natural flush</p>
        </div>

        {/* Evenness bar */}
        <div>
          <p className="text-[11px] text-ink-muted mb-2">Left-right evenness (diff: {c.evennessDiff})</p>
          <SymmetryBar left={parseFloat(c.leftCheekBrightness || '120')} right={parseFloat(c.rightCheekBrightness || '120')} leftLabel="L cheek" rightLabel="R cheek" />
        </div>
      </div>

      {/* ── Overall Explanation ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-2">Full Analysis Summary</p>
        <p className="text-sm text-ink-secondary leading-relaxed font-sans">{c.explanation}</p>
      </div>
    </div>
  )
}
