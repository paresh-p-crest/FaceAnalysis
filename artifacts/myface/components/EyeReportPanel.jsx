import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ReportSectionHeading } from './report/ReportSectionHeading'
import { cropFeatureBefore } from '../utils/aestheticProjection'

function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return null
  return s
}

function parsingValue(featureParsing, key) {
  if (featureParsing?.status !== 'ready') return null
  const m = featureParsing?.metrics?.eyes?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function avg(a, b) {
  if (a == null && b == null) return null
  if (a == null) return b
  if (b == null) return a
  return (a + b) / 2
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

function buildDetailSlides(m, fp) {
  const rEar = parsingValue(fp, 'right_eye_aspect_ratio')
  const lEar = parsingValue(fp, 'left_eye_aspect_ratio')
  const avgEar = avg(rEar, lEar)
  const spacing = parsingValue(fp, 'eye_spacing_ipd_over_face_width')
  const rCurv = parsingValue(fp, 'right_lower_eyelid_curvature')
  const lCurv = parsingValue(fp, 'left_lower_eyelid_curvature')
  const avgCurv = avg(rCurv, lCurv)
  const cvCurv = m.lowerLidCurvature != null ? parseFloat(m.lowerLidCurvature) : null
  const curvValue = avgCurv ?? (Number.isFinite(cvCurv) ? cvCurv : null)

  // Prefer parsing-scale ranges (sagitta/chord ~0–0.25). CV bending k uses different band.
  const useParsingCurv = avgCurv != null
  const curvMin = useParsingCurv ? 0 : (m.curvatureMin != null ? parseFloat(m.curvatureMin) : null)
  const curvMax = useParsingCurv ? 0.25 : (m.curvatureMax != null ? parseFloat(m.curvatureMax) : null)

  const landmark = fp?.status === 'ready' ? 'Landmark-based' : null
  const slides = []

  if (curvValue != null) {
    slides.push({
      id: 'curvature',
      titleLead: 'Lower Eyelid',
      titleAccent: 'Curvature',
      body: 'Sagitta/chord ratio measuring how curved the lower eyelid contour appears. Higher value = more rounded contour.',
      meter: {
        metricLabel: 'Lower Eyelid Curvature',
        sourceLabel: useParsingCurv ? 'Sagitta / Chord Ratio' : landmark,
        valueText: useParsingCurv
          ? `${formatRatio(curvValue)} ratio`
          : formatRatio(curvValue, 2),
        valueNum: curvValue,
        rangeMin: Number.isFinite(curvMin) ? curvMin : null,
        rangeMax: Number.isFinite(curvMax) ? curvMax : null,
        rangeMinLabel: useParsingCurv ? '0.0 flat' : undefined,
        rangeMaxLabel: useParsingCurv ? '0.25 curved' : undefined,
        formatRange: (n) => formatRatio(n, 2),
      },
    })
  }

  if (avgEar != null) {
    slides.push({
      id: 'ear',
      titleLead: 'Eye Aspect Ratio',
      titleAccent: '(Almondness)',
      body: 'EAR = vertical opening / horizontal width. Higher = more open, almond-shaped eye.',
      meter: {
        metricLabel: 'Eye Aspect Ratio (EAR)',
        sourceLabel: 'Both Eyes Average',
        valueText: formatRatio(avgEar),
        valueNum: avgEar,
        rangeMin: 0.25,
        rangeMax: 0.45,
        formatRange: (n) => formatRatio(n, 2),
      },
    })
  }

  if (spacing != null) {
    slides.push({
      id: 'spacing',
      titleLead: 'Eye Spacing',
      titleAccent: 'Ratio',
      body: 'Interpupillary distance divided by facial width. Closer to 0.5 = eyes spaced at half the face width (classic aesthetic ideal).',
      meter: {
        metricLabel: 'Eye Spacing Ratio (IPD / Face Width)',
        sourceLabel: landmark || 'Landmark-based',
        valueText: formatRatio(spacing),
        valueNum: spacing,
        rangeMin: 0.4,
        rangeMax: 0.5,
        formatRange: (n) => formatRatio(n, 2),
      },
    })
  }

  return slides
}

function buildAllMetricsRows(m, fp) {
  const rEar = parsingValue(fp, 'right_eye_aspect_ratio')
  const lEar = parsingValue(fp, 'left_eye_aspect_ratio')
  const avgEar = avg(rEar, lEar)
  const spacing = parsingValue(fp, 'eye_spacing_ipd_over_face_width')
  const rCurv = parsingValue(fp, 'right_lower_eyelid_curvature')
  const lCurv = parsingValue(fp, 'left_lower_eyelid_curvature')
  const avgCurv = avg(rCurv, lCurv)
  const cvCurv = m.lowerLidCurvature != null ? parseFloat(m.lowerLidCurvature) : null

  const left = [
    { label: 'Right Eye Aspect Ratio (EAR)', value: formatRatio(rEar) },
    { label: 'Avg EAR', value: formatRatio(avgEar) },
    { label: 'Right Lower Eyelid Curvature', value: formatRatio(rCurv) },
    { label: 'Avg Lower Eyelid Curvature', value: formatRatio(avgCurv ?? cvCurv) },
    { label: 'Eyelid Exposure Classification', value: textOrNull(m.eyelidExposure) },
  ]

  const right = [
    { label: 'Left Eye Aspect Ratio (EAR)', value: formatRatio(lEar) },
    { label: 'Eye Spacing Ratio (IPD/Width)', value: formatRatio(spacing) },
    { label: 'Left Lower Eyelid Curvature', value: formatRatio(lCurv) },
    { label: 'Eye Tilt Classification', value: textOrNull(m.eyeTilt) },
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

export function EyeReportPanel({
  eyeAnalysis,
  narrative: _narrative = null,
  featureParsing = null,
  photo = null,
  landmarks = null,
}) {
  const [periHero, setPeriHero] = useState(null)

  // Same zoomed periorbital hero as Eyebrows tab.
  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!photo || !landmarks?.length) {
        if (!cancelled) setPeriHero(null)
        return
      }
      try {
        const src = await cropFeatureBefore(photo, landmarks, 'periorbital', 1.2)
        if (!cancelled) setPeriHero(src || null)
      } catch {
        if (!cancelled) setPeriHero(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [photo, landmarks])

  const m = eyeAnalysis?.metrics
  if (!m) return null

  // Only the live zoomed periorbital crop — no eyesCrop fallback (avoids flash).
  const heroImage = periHero

  const slides = buildDetailSlides(m, featureParsing)
  const { left, right } = buildAllMetricsRows(m, featureParsing)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="eyes"
        subtitle={
          <>
            The eyes are a focal point of facial harmony and play a key role in expressing{' '}
            <strong className="text-ink font-semibold">emotion</strong>.
          </>
        }
      />

      {heroImage && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6 sm:p-8 flex items-center justify-center shadow-sm">
          <img
            src={heroImage}
            alt="Eyes"
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </div>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">
          Summary of your eyes
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label="Eye Tilt" value={textOrNull(m.eyeTilt)} />
            <SummaryLabelCard label="Eyelid Exposure" value={textOrNull(m.eyelidExposure)} />
            <SummaryLabelCard label="Sclera Color" value={textOrNull(m.scleraColor)} />
            <SummaryLabelCard label="Under Eye Health" value={textOrNull(m.underEyeHealth)} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Eye Metrics</p>
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
