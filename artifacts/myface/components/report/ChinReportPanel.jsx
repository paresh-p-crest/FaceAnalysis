'use client'

import { useMemo } from 'react'
import { ReportSectionHeading } from './ReportSectionHeading'
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

function classifyWidth(widthMm, cvWidth) {
  const fromCv = textOrNull(cvWidth)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 37) return 'Narrow'
  if (widthMm > 47) return 'Wide'
  return 'Balanced'
}

function classifyProjection(devMm, cvProj) {
  const fromCv = textOrNull(cvProj)
  if (fromCv === 'Balanced') return 'Neutral'
  if (fromCv === 'Prominent') return 'Prominent'
  if (fromCv === 'Recessed') return 'Recessed'
  if (!Number.isFinite(devMm)) return fromCv
  if (Math.abs(devMm) < 2.5) return 'Neutral'
  return 'Deviated'
}

function classifyShape(widthMm, heightMm, cvShape) {
  const fromCv = textOrNull(cvShape)
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || heightMm <= 0) {
    return fromCv
  }
  const ratio = widthMm / heightMm
  if (ratio < 1.8) return 'Pointed'
  if (ratio < 2.4) return 'Oval'
  return fromCv === 'Round' ? 'Round' : 'Square'
}

function classifyDepth(heightMm, cvHeight) {
  const fromCv = textOrNull(cvHeight)
  if (fromCv === 'Short') return 'Shallow'
  if (fromCv === 'Long') return 'Deep'
  if (fromCv === 'Balanced') return 'Moderate'
  if (!Number.isFinite(heightMm)) return fromCv
  if (heightMm < 14) return 'Shallow'
  if (heightMm > 20) return 'Deep'
  return 'Moderate'
}

/**
 * Chin — Lips-matched UI. Image source / highlights / data unchanged.
 */
export function ChinReportPanel({
  chin,
  featureParsing,
  narrative: _narrative,
  heroSlot = null,
  imageSrc = null,
}) {
  const c = chin || {}
  const heroImage = imageSrc || c.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.chin || {}
    const widthNum = m.chin_width_mm?.value != null ? Number(m.chin_width_mm.value) : null
    const heightNum =
      m.chin_vertical_height_mm?.value != null ? Number(m.chin_vertical_height_mm.value) : null
    const devNum =
      m.chin_midline_deviation_mm?.value != null ? Number(m.chin_midline_deviation_mm.value) : null

    return {
      widthMm: widthNum,
      heightMm: heightNum,
      devMm: devNum,
      widthClass: classifyWidth(widthNum, c.chinWidthClass),
      projectionClass: classifyProjection(devNum, c.projection),
      shapeClass: classifyShape(widthNum, heightNum, c.chinShape),
      depthClass: classifyDepth(heightNum, c.chinHeightClass),
    }
  }, [featureParsing, c.chinWidthClass, c.projection, c.chinShape, c.chinHeightClass])

  const landmark = 'Landmark-based'
  const slides = []
  if (metrics.widthMm != null) {
    slides.push({
      id: 'width',
      titleLead: 'Chin Width',
      titleAccent: '(mm)',
      body: 'Horizontal distance between lateral chin points. Typical range 37–47 mm.',
      meter: {
        metricLabel: 'Chin Width',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.widthMm)} mm`,
        valueNum: metrics.widthMm,
        rangeMin: 37,
        rangeMax: 47,
        rangeMinLabel: '37 mm',
        rangeMaxLabel: '47 mm',
      },
    })
  }
  if (metrics.heightMm != null) {
    slides.push({
      id: 'height',
      titleLead: 'Chin Vertical',
      titleAccent: 'Height',
      body: 'Distance from the lower lip base to the chin tip. Typical range 12–22 mm.',
      meter: {
        metricLabel: 'Chin Vertical Height',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.heightMm)} mm`,
        valueNum: metrics.heightMm,
        rangeMin: 12,
        rangeMax: 22,
        rangeMinLabel: '12 mm',
        rangeMaxLabel: '22 mm',
      },
    })
  }
  if (metrics.devMm != null) {
    slides.push({
      id: 'dev',
      titleLead: 'Midline',
      titleAccent: 'Deviation',
      body: 'How far the chin tip deviates from the nasion–nose-tip vertical axis. Ideal ≈ 0 mm.',
      meter: {
        metricLabel: 'Midline Deviation',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.devMm)} mm`,
        valueNum: metrics.devMm,
        rangeMin: 0,
        rangeMax: 10,
        rangeMinLabel: '0 mm',
        rangeMaxLabel: '10 mm',
      },
    })
  }

  const cards = [
    { label: 'Chin Width', value: metrics.widthClass },
    { label: 'Chin Projection', value: metrics.projectionClass },
    { label: 'Chin Shape', value: metrics.shapeClass },
    { label: 'Chin Depth', value: metrics.depthClass },
  ]

  const left = [
    { label: 'Chin Width', value: metrics.widthMm != null ? `${fmt(metrics.widthMm)} mm` : null },
    {
      label: 'Chin Vertical Height',
      value: metrics.heightMm != null ? `${fmt(metrics.heightMm)} mm` : null,
    },
    { label: 'Width Classification', value: metrics.widthClass },
    { label: 'Shape Classification', value: metrics.shapeClass },
  ]
  const right = [
    {
      label: 'Midline Deviation',
      value: metrics.devMm != null ? `${fmt(metrics.devMm)} mm` : null,
    },
    { label: 'Projection Classification', value: metrics.projectionClass },
    { label: 'Depth Classification', value: metrics.depthClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="chin"
        subtitle={
          <>
            Chin width, projection, and depth balance the lower face and support overall{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {(heroSlot || heroImage) && (
        <FeatureHeroFrame>
          {heroSlot || (
            <img
              src={heroImage}
              alt="Chin"
              className="max-h-48 w-auto object-contain rounded-xl"
            />
          )}
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">Summary of your chin</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Chin Metrics</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
