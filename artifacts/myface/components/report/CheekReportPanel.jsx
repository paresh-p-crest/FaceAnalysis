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

function classifyMalarWidth(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return null
  const r = Number(ratio)
  if (r < 0.72) return 'Narrow'
  if (r > 0.9) return 'Wide'
  return 'Average'
}

function classifyCheekPosition(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return null
  const r = Number(ratio)
  if (r < 0.38) return 'High'
  if (r > 0.52) return 'Low'
  return 'Average'
}

function classifyCheekFullness(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return null
  const r = Number(ratio)
  if (r < 0.72) return 'Lean'
  if (r > 0.9) return 'Full'
  return 'Average'
}

/**
 * Cheeks — Lips-matched UI. Image source / highlights / data unchanged.
 */
export function CheekReportPanel({
  cheeks,
  featureParsing,
  narrative: _narrative,
  photoOverlay = null,
  heroSlot = null,
}) {
  const c = cheeks || {}
  const heroImage = c.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.cheeks || {}
    const facialWidth = m.facial_width_mm?.value != null ? Number(m.facial_width_mm.value) : null
    const malarRatio =
      m.malar_width_ratio_powell?.value != null ? Number(m.malar_width_ratio_powell.value) : null
    const rightPos =
      m.right_cheekbone_vertical_position_ratio?.value != null
        ? Number(m.right_cheekbone_vertical_position_ratio.value)
        : null
    const leftPos =
      m.left_cheekbone_vertical_position_ratio?.value != null
        ? Number(m.left_cheekbone_vertical_position_ratio.value)
        : null
    const positionAvg =
      rightPos != null && leftPos != null
        ? (rightPos + leftPos) / 2
        : rightPos ?? leftPos ?? null

    return {
      facialWidth,
      malarRatio,
      rightPos,
      leftPos,
      positionAvg,
      widthClass: classifyMalarWidth(malarRatio),
      positionClass: classifyCheekPosition(positionAvg),
      fullnessClass: classifyCheekFullness(malarRatio),
      heightClass: 'N/A',
    }
  }, [featureParsing])

  const landmark = 'Landmark-based'
  const slides = []
  if (metrics.malarRatio != null) {
    slides.push({
      id: 'malar',
      titleLead: 'Malar Width',
      titleAccent: 'Ratio',
      body: 'Facial width / face height. Higher = broader, more angular face shape.',
      meter: {
        metricLabel: 'Malar Width Ratio',
        sourceLabel: landmark,
        valueText: fmt(metrics.malarRatio, 4),
        valueNum: metrics.malarRatio,
        rangeMin: 0.6,
        rangeMax: 1.0,
        rangeMinLabel: '0.60',
        rangeMaxLabel: '1.00',
      },
    })
  }
  if (metrics.positionAvg != null) {
    slides.push({
      id: 'position',
      titleLead: 'Cheekbone',
      titleAccent: 'Position',
      body: 'Vertical position of the cheekbone apex as a fraction of face height. Lower value = higher set cheekbones.',
      meter: {
        metricLabel: 'Cheekbone Position',
        sourceLabel: landmark,
        valueText: fmt(metrics.positionAvg, 4),
        valueNum: metrics.positionAvg,
        rangeMin: 0.3,
        rangeMax: 0.6,
        rangeMinLabel: '0.30 high',
        rangeMaxLabel: '0.60 low',
      },
    })
  }
  if (metrics.facialWidth != null) {
    slides.push({
      id: 'facial-width',
      titleLead: 'Facial Width',
      titleAccent: '(mm)',
      body: 'Bizygomatic width — distance between the outermost cheekbone points.',
      meter: {
        metricLabel: 'Facial Width',
        sourceLabel: landmark,
        valueText: metrics.facialWidth != null ? `${fmt(metrics.facialWidth)} mm` : null,
        valueNum: metrics.facialWidth,
        rangeMin: 120,
        rangeMax: 160,
        rangeMinLabel: '120 mm',
        rangeMaxLabel: '160 mm',
      },
    })
  }

  const cards = [
    { label: 'Cheek Width', value: metrics.widthClass },
    { label: 'Cheekbone Position', value: metrics.positionClass },
    { label: 'Cheek Fullness', value: metrics.fullnessClass },
    { label: 'Cheekbone Height', value: metrics.heightClass },
  ]

  const left = [
    {
      label: 'Facial Width',
      value: metrics.facialWidth != null ? `${fmt(metrics.facialWidth)} mm` : null,
    },
    { label: 'Malar Width Ratio', value: fmt(metrics.malarRatio, 4) },
    { label: 'Width Classification', value: metrics.widthClass },
    { label: 'Fullness Classification', value: metrics.fullnessClass },
  ]
  const right = [
    { label: 'Right Cheekbone Position', value: fmt(metrics.rightPos, 4) },
    { label: 'Left Cheekbone Position', value: fmt(metrics.leftPos, 4) },
    { label: 'Position Classification', value: metrics.positionClass },
    { label: 'Height Classification', value: metrics.heightClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title="Summary of your"
        accent="cheeks"
        subtitle={
          <>
            Cheekbones frame midface width and height and contribute to overall{' '}
            <strong className="text-ink font-semibold">harmony</strong>.
          </>
        }
      />

      {(heroSlot || heroImage) && (
        <FeatureHeroFrame>
          {heroSlot || (
            <div className="relative inline-block max-h-48">
              <img
                src={heroImage}
                alt="Cheeks"
                className="max-h-48 w-auto object-contain rounded-xl"
              />
              {photoOverlay ? (
                <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden">
                  {photoOverlay}
                </div>
              ) : null}
            </div>
          )}
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">Summary of your cheeks</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">All Cheek Metrics</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
