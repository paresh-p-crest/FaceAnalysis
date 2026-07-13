import { SymmetryOverlay } from './FaceImageFrame'
import { FeatureAnalysisPage } from './FeatureAnalysisPage'
import { FeatureProseBlock } from './FeatureProseBlock'

function MetricCard({ label, value, tooltip }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-3 relative group">
      <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-lg bg-slate-800 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

function ColorScaleBar({ hex }) {
  // A gradient bar showing brow color range
  return (
    <div className="space-y-2">
      <div className="h-3 rounded-full" style={{
        background: 'linear-gradient(to right, #1a1008, #3a2a1a, #6b4c2a, #a07040, #c49860, #d4b88a)'
      }} />
      <div className="relative h-5">
        <div className="absolute top-0 w-3 h-5 rounded border-2 border-white shadow-md" style={{
          left: 'clamp(0%, 25%, 50%)',
          backgroundColor: hex,
        }} />
      </div>
      <div className="flex justify-between text-[10px] text-ink-faint font-sans">
        <span>Black</span>
        <span>Brown</span>
        <span>Blonde</span>
      </div>
    </div>
  )
}

function SymmetryDeviationChart({ data }) {
  if (!data?.length) return null
  const width = 320
  const height = 100
  const padding = { top: 10, right: 15, bottom: 20, left: 35 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Y range: center at 0, symmetric range
  const maxAbs = Math.max(...data.map(d => Math.abs(d.yDiff)), 1)
  const yRange = maxAbs * 1.3

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH / 2 - (d.yDiff / yRange) * (chartH / 2),
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const zeroY = padding.top + chartH / 2

  const labels = ['Inner', 'Inner-mid', 'Peak', 'Arch', 'Outer-arch', 'Mid-tail', 'Tail']

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Zero line */}
      <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY}
        stroke="currentColor" className="text-surface-border" strokeWidth="1" strokeDasharray="4 2" />

      {/* Curve */}
      <path d={pathD} fill="none" stroke="currentColor" className="text-brand" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="currentColor" className="text-brand" />
      ))}

      {/* Labels */}
      {points.map((p, i) => (
        <text key={`l${i}`} x={p.x} y={height - 2} textAnchor="middle" className="fill-current text-ink-faint" fontSize="7" fontFamily="sans-serif">
          {labels[i] || ''}
        </text>
      ))}

      {/* Y-axis labels */}
      <text x={padding.left - 5} y={zeroY + 3} textAnchor="end" className="fill-current text-ink-faint" fontSize="7" fontFamily="sans-serif">0</text>
      <text x={padding.left - 5} y={padding.top + 4} textAnchor="end" className="fill-current text-ink-faint" fontSize="7" fontFamily="sans-serif">+{yRange.toFixed(1)}</text>
      <text x={padding.left - 5} y={padding.top + chartH + 4} textAnchor="end" className="fill-current text-ink-faint" fontSize="7" fontFamily="sans-serif">-{yRange.toFixed(1)}</text>
    </svg>
  )
}

function DensityBar({ pct }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-4 rounded-full bg-surface-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-800 to-amber-600 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
          />
        </div>
        <span className="text-sm font-medium text-ink tabular-nums min-w-[3ch] text-right">{pct}%</span>
      </div>
      <div className="flex justify-between text-[10px] text-ink-faint font-sans">
        <span>Sparse</span>
        <span>Moderate</span>
        <span>Thick</span>
      </div>
    </div>
  )
}

export function BrowReportPanel({ eyebrows, narrative = null }) {
  if (!eyebrows?.metrics) return null

  const m = eyebrows.metrics
  const color = eyebrows.color
  const colorHex = eyebrows.colorHex
  const density = eyebrows.density
  const densityPct = eyebrows.densityPct
  const unibrow = eyebrows.unibrow
  const edgeSharpness = eyebrows.edgeSharpness
  const symmetryData = m.symmetryData || []

  return (
    <FeatureAnalysisPage
      featureName="eyebrows"
      subtitle="Facial landmark balance from your photos"
      heroImage={eyebrows.crop}
      summaryCards={[
        { label: 'Shape', value: m.shape },
        { label: 'Symmetry', value: `${m.symmetryScore}/100` },
        { label: 'Thickness', value: m.thickness },
        ...(density ? [{ label: 'Density', value: density }] : []),
      ]}
      details={[{
        title: 'Brow Shape & Impression',
        metricLabel: 'Peak Height',
        metricValue: `${m.peakHeight} mm`,
        markerPct: Math.min(100, Math.max(0, ((parseFloat(m.peakHeight) - parseFloat(m.peakMin)) / (parseFloat(m.peakMax) - parseFloat(m.peakMin))) * 100)),
        rangeMin: 20,
        rangeMax: 80,
      }]}
    >
    <div className="space-y-6">
      {color && colorHex && (
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Eyebrow Color</p>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full border-2 border-surface-border shadow-sm" style={{ backgroundColor: colorHex }} />
          <div>
            <p className="text-base font-medium text-ink">{color}</p>
            <p className="text-[11px] text-ink-muted">Average pixel color from both brows</p>
          </div>
        </div>
        <ColorScaleBar hex={colorHex} />
      </div>
      )}

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Eyebrow Symmetry</p>
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-medium text-ink">{m.symmetryLabel}</p>
          <span className={`text-sm font-medium px-2.5 py-0.5 rounded-full border ${
            m.symmetryScore >= 85
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : m.symmetryScore >= 70
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}>
            {m.symmetryScore}/100
          </span>
        </div>
        <p className="text-xs text-ink-muted mb-3">Y-axis deviation across 7 landmark pairs (as % of face height)</p>
        <SymmetryDeviationChart data={symmetryData} />
        <p className="text-xs text-ink-secondary mt-3 leading-relaxed">
          Maximum deviation: {m.symmetryMaxDev}% of face height.
        </p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Brow Shape & Impression</p>
        <p className="text-base font-medium text-ink mb-1">{m.shape} · {m.position}</p>
        <p className="text-xs text-ink-muted mb-4">Tilt: {m.tilt} · Virility: {m.virility}</p>

        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Brow Thickness"
            value={m.thickness}
            tooltip="Vertical height between upper and lower brow edges, measured near the peak. Thick brows are associated with youthfulness and assertiveness."
          />
          <MetricCard
            label="Brow Peak Height"
            value={`${m.peakHeight} mm`}
            tooltip="Vertical distance from brow baseline to peak. The ideal range is 18.23–23.87 mm. Higher peaks create a more arched, expressive look."
          />
          <MetricCard
            label="Inner Brow Angle"
            value={`${m.innerBrowAngleLabel} (${m.innerBrowAngle}°)`}
            tooltip="Angle formed at the inner brow start point. Parallel inner brows create a calm, composed appearance. Converging brows can convey intensity."
          />
          <MetricCard
            label="Brow Tail Angle"
            value={`${m.tailAngleLabel} (${m.tailAngle}°)`}
            tooltip="Angle at the outer tail of the brow. A gentle taper creates elegance, while a sharp taper adds definition and structure."
          />
        </div>

        <div className="mt-4 rounded-xl border border-surface-border bg-white/50 dark:bg-white/5 p-3">
          <p className="text-[11px] text-ink-muted mb-1">Peak vertical height</p>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-display font-bold text-brand">{m.peakHeight}</span>
            <span className="text-[10px] text-ink-muted">mm estimated</span>
            {m.inRange && (
              <span className="ml-auto text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Within range</span>
            )}
          </div>
          <div className="relative h-2 rounded-full bg-surface-border mb-1">
            <div className="absolute top-0 bottom-0 rounded-full bg-brand/20" style={{ left: '0%', width: '100%' }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand shadow-glow"
              style={{ left: `calc(${Math.min(100, Math.max(0, ((parseFloat(m.peakHeight) - parseFloat(m.peakMin)) / (parseFloat(m.peakMax) - parseFloat(m.peakMin))) * 100))}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-ink-faint font-sans">
            <span>{m.peakMin} mm</span>
            <span>typical range</span>
            <span>{m.peakMax} mm</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Other Visual Features</p>
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Unibrow"
            value={unibrow ?? '—'}
            tooltip="Hair density between the inner brow points (glabella region). None is the ideal aesthetic for separated, clean brow styling."
          />
          <MetricCard
            label="Tail Length"
            value={m.tailLengthLabel != null ? `${m.tailLengthLabel} (${m.tailLength}%)` : '—'}
            tooltip="Distance from brow peak to tail end, as a percentage of face width. Longer tails frame the eye area more dramatically."
          />
          <MetricCard
            label="Edge Sharpness"
            value={edgeSharpness ?? '—'}
            tooltip="Gradient magnitude analysis of brow edges. Defined edges create a polished look, while soft edges appear more natural."
          />
          <MetricCard
            label="Inner Brow Set"
            value={m.innerSetLabel != null ? `${m.innerSetLabel} (${m.innerSet})` : '—'}
            tooltip="Ratio of inner brow spacing to interpupillary distance. Parallel brows appear calm; wider-set brows create an open, relaxed expression."
          />
        </div>
      </div>

      {density != null && densityPct != null && (
      <div className="rounded-2xl border border-surface-border bg-surface-warm dark:bg-surface-raised p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted mb-3">Eyebrow Density</p>
        <p className="text-base font-medium text-ink mb-1">{density}</p>
        <p className="text-xs text-ink-muted mb-4">Dark pixel ratio in brow region: {densityPct}%</p>
        <DensityBar pct={densityPct} />
      </div>
      )}

      <FeatureProseBlock narrative={narrative} fallbackExplanation={m.explanation} />
    </div>
    </FeatureAnalysisPage>
  )
}
