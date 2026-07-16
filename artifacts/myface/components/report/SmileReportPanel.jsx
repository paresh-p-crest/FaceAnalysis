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

function classifyMouthWidth(widthMm, cvClass) {
  const fromCv = textOrNull(cvClass)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 40) return 'Narrow'
  if (widthMm > 60) return 'Wide'
  return 'Balanced'
}

function classifySmileShape(upperArc, cvCurvature) {
  if (Number.isFinite(upperArc)) {
    if (upperArc > 0.1) return 'Strongly Upturned'
    if (upperArc > 0.05) return 'Mildly Upturned'
    if (upperArc > 0) return 'Straight'
    return 'Downturned'
  }
  return textOrNull(cvCurvature)
}

/**
 * Smile — Lips-matched UI. Image source / metrics sources unchanged.
 */
export function SmileReportPanel({
  smile,
  featureParsing,
  narrative: _narrative,
  imageSrc = null,
}) {
  const s = smile || {}
  const heroImage = resolveFeatureHero('smile', s, featureParsing) || imageSrc || s.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.smile || {}
    const upperNum =
      m.upper_smile_arc_curvature?.value != null ? Number(m.upper_smile_arc_curvature.value) : null
    const lowerNum =
      m.lower_smile_arc_curvature?.value != null ? Number(m.lower_smile_arc_curvature.value) : null
    const widthNum = m.smile_width_mm?.value != null ? Number(m.smile_width_mm.value) : null

    return {
      upperArc: upperNum,
      lowerArc: lowerNum,
      smileWidthMm: widthNum,
      mouthWidthClass: classifyMouthWidth(widthNum, s.mouthWidthClass),
      smileShapeClass: classifySmileShape(upperNum, s.curvature),
      teethExposureClass: 'N/A',
      teethColorClass: 'N/A',
    }
  }, [featureParsing, s.mouthWidthClass, s.curvature])

  const landmark = 'Landmark-based'
  const slides = []
  if (metrics.upperArc != null) {
    slides.push({
      id: 'upper',
      titleLead: 'Upper Smile Arc',
      titleAccent: 'Curvature',
      body: 'Sagitta / chord ratio of the upper smile arc. Higher = more upturned upper lip smile curve.',
      meter: {
        metricLabel: 'Upper Smile Arc',
        sourceLabel: landmark,
        valueText: fmt(metrics.upperArc, 4),
        valueNum: metrics.upperArc,
        rangeMin: -4.66,
        rangeMax: 42.74,
        rangeMinLabel: '-4.66',
        rangeMaxLabel: '42.74',
      },
    })
  }
  if (metrics.lowerArc != null) {
    slides.push({
      id: 'lower',
      titleLead: 'Lower Smile Arc',
      titleAccent: 'Curvature',
      body: 'Sagitta / chord ratio for the lower smile arc (lower lip). Indicates how curved the lower smile appears.',
      meter: {
        metricLabel: 'Lower Smile Arc',
        sourceLabel: landmark,
        valueText: fmt(metrics.lowerArc, 4),
        valueNum: metrics.lowerArc,
        rangeMin: -10,
        rangeMax: 50,
        rangeMinLabel: '-10',
        rangeMaxLabel: '50',
      },
    })
  }
  if (metrics.smileWidthMm != null) {
    slides.push({
      id: 'width',
      titleLead: 'Smile Width',
      titleAccent: '(mm)',
      body: 'Mouth corner-to-corner width at rest. Typical range 40–60 mm.',
      meter: {
        metricLabel: 'Smile Width',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.smileWidthMm)} mm`,
        valueNum: metrics.smileWidthMm,
        rangeMin: 40,
        rangeMax: 60,
        rangeMinLabel: '40 mm',
        rangeMaxLabel: '60 mm',
      },
    })
  }

  const cards = [
    { label: 'Mouth Width (Smiling)', value: metrics.mouthWidthClass },
    { label: 'Smile Shape', value: metrics.smileShapeClass },
    { label: 'Teeth Exposure', value: metrics.teethExposureClass },
    { label: 'Teeth Color', value: metrics.teethColorClass },
  ]

  const left = [
    { label: 'Upper Smile Arc Curvature', value: fmt(metrics.upperArc, 4) },
    { label: 'Lower Smile Arc Curvature', value: fmt(metrics.lowerArc, 4) },
    { label: 'Mouth Width Class', value: metrics.mouthWidthClass },
    { label: 'Teeth Exposure', value: metrics.teethExposureClass },
  ]
  const right = [
    {
      label: 'Smile Width',
      value: metrics.smileWidthMm != null ? `${fmt(metrics.smileWidthMm)} mm` : null,
    },
    { label: 'Smile Shape', value: metrics.smileShapeClass },
    { label: 'Teeth Color', value: metrics.teethColorClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="smile"
        subtitle={
          <>
            Mouth width and smile-arc curvature shape expression and lower-face{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt="Smile"
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">Summary of your smile</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Smile Metrics</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
