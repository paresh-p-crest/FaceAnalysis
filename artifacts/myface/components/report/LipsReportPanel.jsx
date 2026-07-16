import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReportSectionHeading } from './ReportSectionHeading'
import { resolveFeatureHero } from '../../utils/featureParsing'

function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return null
  return s
}

function parsingValue(featureParsing, key) {
  if (featureParsing?.status !== 'ready') return null
  const m = featureParsing?.metrics?.lips?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function formatMm(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)} mm`
}

function formatDeg(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)}°`
}

function markerPct(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return 50
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

function classifyFullness(mouthMm, cvFullness) {
  const fromCv = textOrNull(cvFullness)
  if (fromCv === 'Thin') return 'Thin / Narrow'
  if (fromCv === 'Full') return 'Full / Plush'
  if (fromCv === 'Balanced') return 'Balanced'
  if (!Number.isFinite(mouthMm)) return fromCv
  if (mouthMm < 42) return 'Thin / Narrow'
  if (mouthMm > 55) return 'Full / Wide'
  return 'Balanced'
}

function classifyWidth(mouthMm) {
  if (!Number.isFinite(mouthMm)) return null
  if (mouthMm < 42) return 'Narrow'
  if (mouthMm > 55) return 'Wide'
  return 'Average'
}

function classifyProportions(cupidDeg) {
  if (!Number.isFinite(cupidDeg)) return null
  // Lower angle = more peaked; higher = flatter
  if (cupidDeg < 120) return 'Peaked / Defined'
  if (cupidDeg > 145) return 'Flat / Subtle'
  return 'Moderate Arch'
}

function SummaryLabelCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-4 sm:p-5 shadow-sm min-w-0">
      <p className="qoves-report-mono-label mb-2">{label}</p>
      <p className="text-base sm:text-lg font-display font-bold text-ink">{value ?? '—'}</p>
    </div>
  )
}

function RangeMeter({
  metricLabel,
  sourceLabel,
  valueText,
  valueNum,
  rangeMin,
  rangeMax,
  rangeMinLabel,
  rangeMaxLabel,
  formatRange,
}) {
  const hasRange =
    Number.isFinite(valueNum) && Number.isFinite(rangeMin) && Number.isFinite(rangeMax)
  const pct = hasRange ? markerPct(valueNum, rangeMin, rangeMax) : null
  const fmt = formatRange || ((n) => String(n))

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="qoves-report-mono-label">{metricLabel}</p>
        {sourceLabel && <p className="qoves-report-mono-label">{sourceLabel}</p>}
      </div>
      {valueText && (
        <p className="text-2xl sm:text-3xl font-display font-bold text-ink tabular-nums">{valueText}</p>
      )}
      {hasRange && (
        <>
          <div className="relative h-2 rounded-full bg-surface-border mt-2">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-ink border-2 border-white shadow-sm"
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-ink-muted font-sans tabular-nums">
            <span>{rangeMinLabel ?? fmt(rangeMin)}</span>
            <span>{rangeMaxLabel ?? fmt(rangeMax)}</span>
          </div>
        </>
      )}
    </div>
  )
}

function buildLipMetrics(lips, featureParsing) {
  const mouthMm = parsingValue(featureParsing, 'mouth_width_mm')
  const philtrumMm = parsingValue(featureParsing, 'philtrum_length_mm')
  const cupidDeg = parsingValue(featureParsing, 'cupids_bow_angle_deg')

  return {
    mouthMm,
    philtrumMm,
    cupidDeg,
    fullnessLabel: classifyFullness(mouthMm, lips.fullness),
    widthLabel: classifyWidth(mouthMm) || textOrNull(lips.fullness),
    proportionsLabel: classifyProportions(cupidDeg),
    healthLabel: 'N/A', // not measurable from geometry alone
  }
}

function buildDetailSlides(metrics) {
  const landmark = 'Landmark-based'
  const slides = []

  if (metrics.mouthMm != null) {
    slides.push({
      id: 'mouth-width',
      titleLead: 'Mouth Width',
      titleAccent: '(mm)',
      body: 'Horizontal distance between the mouth corners. Typical range 40–60 mm.',
      meter: {
        metricLabel: 'Mouth Width',
        sourceLabel: landmark,
        valueText: formatMm(metrics.mouthMm),
        valueNum: metrics.mouthMm,
        rangeMin: 35,
        rangeMax: 65,
        rangeMinLabel: '35 mm',
        rangeMaxLabel: '65 mm',
        formatRange: formatMm,
      },
    })
  }

  if (metrics.cupidDeg != null) {
    slides.push({
      id: 'cupid',
      titleLead: "Cupid's Bow",
      titleAccent: 'Angle',
      body: "Angle at the Cupid's bow dip. Lower = more peaked/defined upper lip arch.",
      meter: {
        metricLabel: "Cupid's Bow Angle",
        sourceLabel: landmark,
        valueText: formatDeg(metrics.cupidDeg),
        valueNum: metrics.cupidDeg,
        rangeMin: 90,
        rangeMax: 140,
        rangeMinLabel: '90°',
        rangeMaxLabel: '140°',
        formatRange: (n) => `${Math.round(n)}°`,
      },
    })
  }

  if (metrics.philtrumMm != null) {
    slides.push({
      id: 'philtrum',
      titleLead: 'Philtrum',
      titleAccent: 'Length',
      body: "Distance from subnasale (base of nose) to the Cupid's bow dip. Typical range 10–20 mm.",
      meter: {
        metricLabel: 'Philtrum Length',
        sourceLabel: landmark,
        valueText: formatMm(metrics.philtrumMm),
        valueNum: metrics.philtrumMm,
        rangeMin: 10,
        rangeMax: 20,
        rangeMinLabel: '10 mm',
        rangeMaxLabel: '20 mm',
        formatRange: formatMm,
      },
    })
  }

  return slides
}

function buildAllMetricsRows(metrics) {
  const left = [
    { label: 'Mouth Width', value: formatMm(metrics.mouthMm) },
    { label: "Cupid's Bow Angle", value: formatDeg(metrics.cupidDeg) },
    { label: 'Width Classification', value: metrics.widthLabel },
    { label: 'Health', value: metrics.healthLabel },
  ]
  const right = [
    { label: 'Philtrum Length', value: formatMm(metrics.philtrumMm) },
    { label: 'Fullness Classification', value: metrics.fullnessLabel },
    { label: 'Proportions', value: metrics.proportionsLabel },
  ]
  return { left, right }
}

function DetailCarousel({ slides }) {
  const [idx, setIdx] = useState(0)
  if (!slides.length) return null

  const active = slides[Math.min(idx, slides.length - 1)]
  const multi = slides.length > 1

  return (
    <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-4 sm:p-5 shadow-sm h-full min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-display text-base font-bold text-ink tracking-tight">
          {active.titleLead}{' '}
          <span className="text-ink-muted font-semibold">{active.titleAccent}</span>
        </h4>
        {multi && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Previous detail"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="p-1 rounded-lg border border-surface-border disabled:opacity-30 text-ink-muted hover:text-ink"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-1">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to ${s.titleLead} ${s.titleAccent}`}
                  onClick={() => setIdx(i)}
                  className={`rounded-full transition-all ${
                    i === idx
                      ? 'w-2 h-2 bg-ink'
                      : 'w-1.5 h-1.5 bg-surface-border hover:bg-ink-muted'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next detail"
              onClick={() => setIdx((i) => Math.min(slides.length - 1, i + 1))}
              disabled={idx >= slides.length - 1}
              className="p-1 rounded-lg border border-surface-border disabled:opacity-30 text-ink-muted hover:text-ink"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm text-ink-muted font-sans leading-relaxed">{active.body}</p>
      {active.meter && <RangeMeter {...active.meter} />}
    </div>
  )
}

function MetricsColumn({ rows }) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-brand font-medium">{row.label}</dt>
          <dd className="text-sm font-display font-bold text-ink tabular-nums text-right shrink-0">
            {row.value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function LipsReportPanel({ lips, featureParsing = null, narrative: _narrative = null }) {
  if (!lips) return null

  // Keep existing hero resolution — do not change image source.
  const heroImage = resolveFeatureHero('lips', lips, featureParsing) || lips.imageSrc
  const metrics = buildLipMetrics(lips, featureParsing)
  const slides = buildDetailSlides(metrics)
  const { left, right } = buildAllMetricsRows(metrics)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="lips"
        subtitle={
          <>
            The lips frame expression and proportion in the lower face and contribute to overall{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {heroImage && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6 sm:p-8 flex items-center justify-center shadow-sm">
          <img
            src={heroImage}
            alt="Lips"
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </div>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">
          Summary of your lips
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label="Lip Fullness" value={metrics.fullnessLabel} />
            <SummaryLabelCard label="Lip Width" value={metrics.widthLabel} />
            <SummaryLabelCard label="Lip Proportions" value={metrics.proportionsLabel} />
            <SummaryLabelCard label="Lip Health" value={metrics.healthLabel} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Lip Metrics</p>
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-5 sm:p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            <MetricsColumn rows={left} />
            <MetricsColumn rows={right} />
          </div>
        </div>
      </div>
    </div>
  )
}
