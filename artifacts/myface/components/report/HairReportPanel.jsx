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

function classifyTempleWidth(widthMm) {
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 100) return 'Narrow'
  if (widthMm > 112) return 'Wide'
  return 'Average'
}

/**
 * Hair — Lips-matched UI. Image source / data unchanged.
 */
export function HairReportPanel({
  hair,
  featureParsing,
  narrative: _narrative,
  imageSrc = null,
}) {
  const h = hair || {}
  const heroImage = resolveFeatureHero('hair', h, featureParsing) || imageSrc || h.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.hair || {}
    const widthNum =
      m.forehead_width_mm?.value != null ? Number(m.forehead_width_mm.value) : null
    const heightNum =
      m.forehead_height_mm_mesh_approx?.value != null
        ? Number(m.forehead_height_mm_mesh_approx.value)
        : null
    const rightNum =
      m.right_temple_inclination_angle_deg?.value != null
        ? Number(m.right_temple_inclination_angle_deg.value)
        : null
    const leftNum =
      m.left_temple_inclination_angle_deg?.value != null
        ? Number(m.left_temple_inclination_angle_deg.value)
        : null
    const avgTemple =
      rightNum != null && leftNum != null
        ? (rightNum + leftNum) / 2
        : rightNum ?? leftNum

    return {
      foreheadWidthMm: widthNum,
      foreheadHeightMm: heightNum,
      rightTempleDeg: rightNum,
      leftTempleDeg: leftNum,
      avgTempleDeg: avgTemple != null && !Number.isNaN(avgTemple) ? avgTemple : null,
      templeWidthClass: classifyTempleWidth(widthNum),
      densityClass: textOrNull(h.densityEstimate),
      hairlineClass: textOrNull(h.hairline),
      foreheadExposureClass: textOrNull(h.foreheadExposure),
      coverageClass: textOrNull(h.coverageEstimate),
      densityPct: h.densityPct != null ? Number(h.densityPct) : null,
    }
  }, [featureParsing, h.densityEstimate, h.hairline, h.foreheadExposure, h.coverageEstimate, h.densityPct])

  const landmark = 'Landmark-based'
  const slides = []
  if (metrics.foreheadWidthMm != null) {
    slides.push({
      id: 'fw',
      titleLead: 'Forehead Width',
      titleAccent: '(mm)',
      body: 'Distance between temple landmarks. Broader temples give more flexibility in choosing hairstyles.',
      meter: {
        metricLabel: 'Forehead Width',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.foreheadWidthMm)} mm`,
        valueNum: metrics.foreheadWidthMm,
        rangeMin: 100,
        rangeMax: 112,
        rangeMinLabel: '100 mm',
        rangeMaxLabel: '112 mm',
      },
    })
  }
  if (metrics.foreheadHeightMm != null) {
    slides.push({
      id: 'fh',
      titleLead: 'Forehead Height',
      titleAccent: '(mm)',
      body: 'Vertical distance from the mesh forehead top to the glabella. Typical range 50–75 mm.',
      meter: {
        metricLabel: 'Forehead Height',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.foreheadHeightMm)} mm`,
        valueNum: metrics.foreheadHeightMm,
        rangeMin: 50,
        rangeMax: 75,
        rangeMinLabel: '50 mm',
        rangeMaxLabel: '75 mm',
      },
    })
  }
  if (metrics.avgTempleDeg != null) {
    slides.push({
      id: 'temple',
      titleLead: 'Temple Inclination',
      titleAccent: 'Angle',
      body: 'Angle from vertical between temple and zygion landmarks. Reflects how much the temples flare outward.',
      meter: {
        metricLabel: 'Temple Inclination',
        sourceLabel: landmark,
        valueText: `${fmt(metrics.avgTempleDeg)}°`,
        valueNum: metrics.avgTempleDeg,
        rangeMin: 5,
        rangeMax: 25,
        rangeMinLabel: '5°',
        rangeMaxLabel: '25°',
      },
    })
  }

  const cards = [
    { label: 'Temple Width', value: metrics.templeWidthClass },
    { label: 'Hair Density', value: metrics.densityClass },
    { label: 'Hairline', value: metrics.hairlineClass },
    { label: 'Forehead Exposure', value: metrics.foreheadExposureClass },
  ]

  const left = [
    {
      label: 'Forehead Width',
      value: metrics.foreheadWidthMm != null ? `${fmt(metrics.foreheadWidthMm)} mm` : null,
    },
    {
      label: 'Forehead Height',
      value: metrics.foreheadHeightMm != null ? `${fmt(metrics.foreheadHeightMm)} mm` : null,
    },
    {
      label: 'Right Temple Inclination',
      value: metrics.rightTempleDeg != null ? `${fmt(metrics.rightTempleDeg)}°` : null,
    },
    { label: 'Temple Width Class', value: metrics.templeWidthClass },
    { label: 'Hairline', value: metrics.hairlineClass },
  ]
  const right = [
    {
      label: 'Left Temple Inclination',
      value: metrics.leftTempleDeg != null ? `${fmt(metrics.leftTempleDeg)}°` : null,
    },
    { label: 'Hair Density', value: metrics.densityClass },
    { label: 'Forehead Exposure', value: metrics.foreheadExposureClass },
    { label: 'Coverage', value: metrics.coverageClass },
    {
      label: 'Density %',
      value: metrics.densityPct != null ? `${fmt(metrics.densityPct, 0)}%` : null,
    },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="hair"
        subtitle={
          <>
            Hairline and forehead geometry frame the upper face and contribute to overall{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt="Hair"
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">Summary of your hair</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Hair Metrics</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
