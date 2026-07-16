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
  const t = useTranslations('Report')
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

  const landmark = t('common.landmarkBased')
  const slides = []
  if (metrics.widthMm != null) {
    slides.push({
      id: 'width',
      titleLead: t('chin.slides.width.titleLead'),
      titleAccent: t('chin.slides.width.titleAccent'),
      body: t('chin.slides.width.body'),
      meter: {
        metricLabel: t('chin.slides.width.metricLabel'),
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
      titleLead: t('chin.slides.height.titleLead'),
      titleAccent: t('chin.slides.height.titleAccent'),
      body: t('chin.slides.height.body'),
      meter: {
        metricLabel: t('chin.slides.height.metricLabel'),
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
      titleLead: t('chin.slides.dev.titleLead'),
      titleAccent: t('chin.slides.dev.titleAccent'),
      body: t('chin.slides.dev.body'),
      meter: {
        metricLabel: t('chin.slides.dev.metricLabel'),
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
    { label: t('chin.width'), value: metrics.widthClass },
    { label: t('chin.projection'), value: metrics.projectionClass },
    { label: t('chin.shape'), value: metrics.shapeClass },
    { label: t('chin.depth'), value: metrics.depthClass },
  ]

  const left = [
    { label: t('chin.width'), value: metrics.widthMm != null ? `${fmt(metrics.widthMm)} mm` : null },
    {
      label: t('chin.metrics.verticalHeight'),
      value: metrics.heightMm != null ? `${fmt(metrics.heightMm)} mm` : null,
    },
    { label: t('chin.metrics.widthClass'), value: metrics.widthClass },
    { label: t('chin.metrics.shapeClass'), value: metrics.shapeClass },
  ]
  const right = [
    {
      label: t('chin.metrics.midlineDeviation'),
      value: metrics.devMm != null ? `${fmt(metrics.devMm)} mm` : null,
    },
    { label: t('chin.metrics.projectionClass'), value: metrics.projectionClass },
    { label: t('chin.metrics.depthClass'), value: metrics.depthClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.chin').toLowerCase()}
        subtitle={t('chin.subtitle')}
      />

      {(heroSlot || heroImage) && (
        <FeatureHeroFrame>
          {heroSlot || (
            <img
              src={heroImage}
              alt={t('chin.heroAlt')}
              className="max-h-48 w-auto object-contain rounded-xl"
            />
          )}
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('chin.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('chin.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
