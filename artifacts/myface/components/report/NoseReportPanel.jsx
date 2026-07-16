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
  const m = featureParsing?.metrics?.nose?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function formatMm(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)} mm`
}

function formatRatio(n, digits = 4) {
  if (n == null || !Number.isFinite(n)) return null
  return Number(n).toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

function markerPct(value, min, max) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return 50
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

/** Qualitative labels from live ratios / CV — match sample classification vocabulary. */
function classifyShape(aspect) {
  if (!Number.isFinite(aspect)) return null
  if (aspect < 0.6) return 'Narrow / Leptorrhine'
  if (aspect > 0.85) return 'Wide / Platyrrhine'
  return 'Average / Mesorrhine'
}

function classifyHeight(heightMm) {
  if (!Number.isFinite(heightMm)) return null
  if (heightMm < 45) return 'Short'
  if (heightMm > 55) return 'Long'
  return 'Average'
}

function classifyTip(nasoCanthal) {
  if (!Number.isFinite(nasoCanthal)) return null
  if (nasoCanthal > 1.05) return 'Wide / Bulbous'
  if (nasoCanthal < 0.95) return 'Narrow / Refined'
  return 'Balanced'
}

function classifyWidth(widthMm, cvWidth) {
  const fromCv = textOrNull(cvWidth)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 30) return 'Narrow'
  if (widthMm > 40) return 'Wide'
  return 'Average'
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
  const fmt = formatRange || ((n) => formatRatio(n))

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

function buildNoseMetrics(nose, featureParsing) {
  const widthMm = parsingValue(featureParsing, 'nasal_width_mm')
  const heightMm = parsingValue(featureParsing, 'nasal_height_mm')
  const aspect = parsingValue(featureParsing, 'nasal_aspect_ratio_width_over_height')
  const nasoCanthal = parsingValue(featureParsing, 'naso_canthal_ratio_nose_width_over_intercanthal')
  const pyramidal = parsingValue(featureParsing, 'pyramidal_width_mm')
  const cvAspect = nose.widthLengthRatio != null ? parseFloat(nose.widthLengthRatio) : null
  const aspectValue = aspect ?? (Number.isFinite(cvAspect) ? cvAspect : null)

  return {
    widthMm,
    heightMm,
    aspect: aspectValue,
    nasoCanthal,
    pyramidal,
    shapeLabel: classifyShape(aspectValue),
    heightLabel: classifyHeight(heightMm),
    tipLabel: classifyTip(nasoCanthal),
    widthLabel: classifyWidth(widthMm, nose.width),
  }
}

function buildDetailSlides(metrics) {
  const landmark = 'Landmark-based'
  const slides = []

  if (metrics.aspect != null) {
    slides.push({
      id: 'aspect',
      titleLead: 'Nasal',
      titleAccent: 'Aspect Ratio',
      body: 'Width divided by height. <0.6 = narrow, 0.6–0.85 = average, >0.85 = wide.',
      meter: {
        metricLabel: 'Nasal Aspect Ratio (W/H)',
        sourceLabel: landmark,
        valueText: `${formatRatio(metrics.aspect)} ratio`,
        valueNum: metrics.aspect,
        rangeMin: 0.5,
        rangeMax: 1.1,
        rangeMinLabel: '0.5 narrow',
        rangeMaxLabel: '1.1 wide',
        formatRange: (n) => formatRatio(n, 1),
      },
    })
  }

  if (metrics.widthMm != null) {
    slides.push({
      id: 'width',
      titleLead: 'Nasal Width',
      titleAccent: '(mm)',
      body: 'Distance between the alae (outer nostrils) in millimetres. Reference IPD = 63.5 mm.',
      meter: {
        metricLabel: 'Nasal Ala Width',
        sourceLabel: landmark,
        valueText: formatMm(metrics.widthMm),
        valueNum: metrics.widthMm,
        rangeMin: 25,
        rangeMax: 45,
        rangeMinLabel: '25 mm',
        rangeMaxLabel: '45 mm',
        formatRange: formatMm,
      },
    })
  }

  if (metrics.nasoCanthal != null) {
    slides.push({
      id: 'naso-canthal',
      titleLead: 'Naso-Canthal',
      titleAccent: 'Ratio',
      body: 'Alar width / inter-canthal distance. Ideal ≈ 1.0 (nose width = inner eye distance).',
      meter: {
        metricLabel: 'Naso-Canthal Ratio',
        sourceLabel: landmark,
        valueText: formatRatio(metrics.nasoCanthal),
        valueNum: metrics.nasoCanthal,
        rangeMin: 0.8,
        rangeMax: 1.2,
        formatRange: (n) => formatRatio(n, 1),
      },
    })
  }

  return slides
}

function buildAllMetricsRows(metrics) {
  const left = [
    { label: 'Nasal Width', value: formatMm(metrics.widthMm) },
    { label: 'Nasal Aspect Ratio (W/H)', value: formatRatio(metrics.aspect) },
    { label: 'Pyramidal Width', value: formatMm(metrics.pyramidal) },
    { label: 'Height Classification', value: metrics.heightLabel },
    { label: 'Width Classification', value: metrics.widthLabel },
  ]
  const right = [
    { label: 'Nasal Height', value: formatMm(metrics.heightMm) },
    { label: 'Naso-Canthal Ratio', value: formatRatio(metrics.nasoCanthal) },
    { label: 'Shape Classification', value: metrics.shapeLabel },
    { label: 'Tip Classification', value: metrics.tipLabel },
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

export function NoseReportPanel({ nose, featureParsing = null, narrative: _narrative = null }) {
  if (!nose) return null

  // Keep existing hero resolution — do not swap to a live periorbital-style crop.
  const heroImage = resolveFeatureHero('nose', nose, featureParsing) || nose.imageSrc
  const metrics = buildNoseMetrics(nose, featureParsing)
  const slides = buildDetailSlides(metrics)
  const { left, right } = buildAllMetricsRows(metrics)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="nose"
        subtitle={
          <>
            The nose is a central pillar of facial aesthetics and plays a key role in overall{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {heroImage && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6 sm:p-8 flex items-center justify-center shadow-sm">
          <img
            src={heroImage}
            alt="Nose"
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </div>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">
          Summary of your nose
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label="Nasal Shape" value={metrics.shapeLabel} />
            <SummaryLabelCard label="Nasal Height" value={metrics.heightLabel} />
            <SummaryLabelCard label="Nasal Tip" value={metrics.tipLabel} />
            <SummaryLabelCard label="Nasal Width" value={metrics.widthLabel} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Nose Metrics</p>
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
