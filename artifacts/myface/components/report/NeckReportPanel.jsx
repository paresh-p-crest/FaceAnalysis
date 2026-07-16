'use client'

import { useMemo } from 'react'
import { ReportSectionHeading } from './ReportSectionHeading'
import { resolveFeatureHero } from '../../utils/featureParsing'
import {
  AllMetricsTable,
  FeatureHeroFrame,
  FeatureSummaryGrid,
} from './FeatureSummaryUi'

function fmt(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return null
  return Number(v).toFixed(digits)
}

function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return null
  return s
}

function classifyNeckWidth(widthMm, cvClass) {
  const fromCv = textOrNull(cvClass)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 80) return 'Slender'
  if (widthMm > 100) return 'Wide'
  return 'Balanced'
}

/**
 * Neck — Lips-matched UI. Image source / data unchanged.
 */
export function NeckReportPanel({
  neck,
  featureParsing,
  narrative: _narrative,
  imageSrc = null,
}) {
  const n = neck || {}
  const heroImage = resolveFeatureHero('neck', n, featureParsing) || imageSrc || n.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.neck || {}
    const widthNum = m.neck_width_mm?.value != null ? Number(m.neck_width_mm.value) : null
    const ratioNum =
      m.neck_width_to_jaw_width_ratio?.value != null
        ? Number(m.neck_width_to_jaw_width_ratio.value)
        : null

    return {
      neckWidthMm: widthNum,
      neckJawRatio: ratioNum,
      widthClass: classifyNeckWidth(widthNum, n.neckWidthClass),
      definitionClass: 'N/A',
      lengthClass: 'N/A',
      agingClass: 'N/A',
    }
  }, [featureParsing, n.neckWidthClass])

  const landmark = 'Segmentation-based'
  const slides = []
  if (metrics.neckWidthMm != null) {
    slides.push({
      id: 'width',
      titleLead: 'Neck Width',
      titleAccent: '(mm)',
      body: 'Horizontal span of the neck region from the segmentation mask. Typical range 80–100 mm.',
      meter: {
        metricLabel: 'Neck Width',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.neckWidthMm)} mm`,
        valueNum: metrics.neckWidthMm,
        rangeMin: 80,
        rangeMax: 100,
        rangeMinLabel: '80 mm',
        rangeMaxLabel: '100 mm',
      },
    })
  }
  if (metrics.neckJawRatio != null) {
    slides.push({
      id: 'ratio',
      titleLead: 'Neck / Jaw Width',
      titleAccent: 'Ratio',
      body: 'Ratio of neck width to jaw width. Closer to 0.7–0.8 is typically considered proportionate.',
      meter: {
        metricLabel: 'Neck / Jaw Width Ratio',
        sourceLabel: 'Computed',
        valueText: fmt(metrics.neckJawRatio),
        valueNum: metrics.neckJawRatio,
        rangeMin: 0.5,
        rangeMax: 1.0,
        rangeMinLabel: '0.50',
        rangeMaxLabel: '1.00',
      },
    })
  }

  const cards = [
    { label: 'Neck Width', value: metrics.widthClass },
    { label: 'Neck Definition', value: metrics.definitionClass },
    { label: 'Neck Length', value: metrics.lengthClass },
    { label: 'Neck Aging', value: metrics.agingClass },
  ]

  const left = [
    {
      label: 'Neck Width',
      value: metrics.neckWidthMm != null ? `${fmt(metrics.neckWidthMm)} mm` : null,
    },
    { label: 'Width Classification', value: metrics.widthClass },
    { label: 'Definition', value: metrics.definitionClass },
  ]
  const right = [
    { label: 'Neck / Jaw Width Ratio', value: fmt(metrics.neckJawRatio) },
    { label: 'Length', value: metrics.lengthClass },
    { label: 'Aging', value: metrics.agingClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="neck"
        subtitle={
          <>
            Neck width and its proportion to the jaw support lower-face framing and overall{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt="Neck"
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">Summary of your neck</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Neck Metrics</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
