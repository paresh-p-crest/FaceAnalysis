'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('Report')
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

  const landmark = t('common.landmarkBased')
  const slides = []
  if (metrics.upperArc != null) {
    slides.push({
      id: 'upper',
      titleLead: t('smile.slides.upper.titleLead'),
      titleAccent: t('smile.slides.upper.titleAccent'),
      body: t('smile.slides.upper.body'),
      meter: {
        metricLabel: t('smile.slides.upper.metricLabel'),
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
      titleLead: t('smile.slides.lower.titleLead'),
      titleAccent: t('smile.slides.lower.titleAccent'),
      body: t('smile.slides.lower.body'),
      meter: {
        metricLabel: t('smile.slides.lower.metricLabel'),
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
      titleLead: t('smile.slides.width.titleLead'),
      titleAccent: t('smile.slides.width.titleAccent'),
      body: t('smile.slides.width.body'),
      meter: {
        metricLabel: t('smile.slides.width.metricLabel'),
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
    { label: t('smile.mouthWidth'), value: metrics.mouthWidthClass },
    { label: t('smile.smileShape'), value: metrics.smileShapeClass },
    { label: t('smile.teethExposure'), value: metrics.teethExposureClass },
    { label: t('smile.teethColor'), value: metrics.teethColorClass },
  ]

  const left = [
    { label: t('smile.metrics.upperArc'), value: fmt(metrics.upperArc, 4) },
    { label: t('smile.metrics.lowerArc'), value: fmt(metrics.lowerArc, 4) },
    { label: t('smile.metrics.mouthWidthClass'), value: metrics.mouthWidthClass },
    { label: t('smile.teethExposure'), value: metrics.teethExposureClass },
  ]
  const right = [
    {
      label: t('smile.metrics.smileWidth'),
      value: metrics.smileWidthMm != null ? `${fmt(metrics.smileWidthMm)} mm` : null,
    },
    { label: t('smile.smileShape'), value: metrics.smileShapeClass },
    { label: t('smile.teethColor'), value: metrics.teethColorClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.smile').toLowerCase()}
        subtitle={t('smile.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('smile.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('smile.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('smile.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
