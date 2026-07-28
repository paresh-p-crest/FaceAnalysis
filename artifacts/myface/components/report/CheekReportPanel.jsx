'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  if (r < 0.72) return 'narrow'
  if (r > 0.9) return 'wide'
  return 'average'
}

function classifyCheekPosition(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return null
  const r = Number(ratio)
  if (r < 0.38) return 'high'
  if (r > 0.52) return 'low'
  return 'average'
}

function classifyCheekFullness(ratio) {
  if (ratio == null || Number.isNaN(Number(ratio))) return null
  const r = Number(ratio)
  if (r < 0.72) return 'lean'
  if (r > 0.9) return 'full'
  return 'average'
}

/**
 * Cheeks — Lips-matched UI. Image source / highlights / data unchanged.
 */
export function CheekReportPanel({
  cheeks,
  featureParsing,
  photoOverlay = null,
  heroSlot = null,
}) {
  const t = useTranslations('Report')
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

  const landmark = t('common.landmarkBased')
  const slides = []
  if (metrics.malarRatio != null) {
    slides.push({
      id: 'malar',
      titleLead: t('cheek.slides.malar.titleLead'),
      titleAccent: t('cheek.slides.malar.titleAccent'),
      body: t('cheek.slides.malar.body'),
      meter: {
        metricLabel: t('cheek.slides.malar.metricLabel'),
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
      titleLead: t('cheek.slides.position.titleLead'),
      titleAccent: t('cheek.slides.position.titleAccent'),
      body: t('cheek.slides.position.body'),
      meter: {
        metricLabel: t('cheek.slides.position.metricLabel'),
        sourceLabel: landmark,
        valueText: fmt(metrics.positionAvg, 4),
        valueNum: metrics.positionAvg,
        rangeMin: 0.3,
        rangeMax: 0.6,
        rangeMinLabel: t('cheek.slides.position.rangeMinLabel'),
        rangeMaxLabel: t('cheek.slides.position.rangeMaxLabel'),
      },
    })
  }
  if (metrics.facialWidth != null) {
    slides.push({
      id: 'facial-width',
      titleLead: t('cheek.slides.facialWidth.titleLead'),
      titleAccent: t('cheek.slides.facialWidth.titleAccent'),
      body: t('cheek.slides.facialWidth.body'),
      meter: {
        metricLabel: t('cheek.slides.facialWidth.metricLabel'),
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
    { label: t('cheek.width'), value: metrics.widthClass },
    { label: t('cheek.position'), value: metrics.positionClass },
    { label: t('cheek.fullness'), value: metrics.fullnessClass },
    { label: t('cheek.height'), value: metrics.heightClass },
  ]

  const left = [
    {
      label: t('cheek.metrics.facialWidth'),
      value: metrics.facialWidth != null ? `${fmt(metrics.facialWidth)} mm` : null,
    },
    { label: t('cheek.metrics.malarRatio'), value: fmt(metrics.malarRatio, 4) },
    { label: t('cheek.metrics.widthClass'), value: metrics.widthClass },
    { label: t('cheek.metrics.fullnessClass'), value: metrics.fullnessClass },
  ]
  const right = [
    { label: t('cheek.metrics.rightPosition'), value: fmt(metrics.rightPos, 4) },
    { label: t('cheek.metrics.leftPosition'), value: fmt(metrics.leftPos, 4) },
    { label: t('cheek.metrics.positionClass'), value: metrics.positionClass },
    { label: t('cheek.metrics.heightClass'), value: metrics.heightClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.cheeks').toLowerCase()}
        subtitle={t('cheek.subtitle')}
      />

      {(heroSlot || heroImage) && (
        <FeatureHeroFrame>
          {heroSlot || (
            <div className="relative inline-block max-h-48">
              <img
                src={heroImage}
                alt={t('cheek.heroAlt')}
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
        <p className="font-display text-base font-bold text-ink mb-3">{t('cheek.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('cheek.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>

    </div>
  )
}
