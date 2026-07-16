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
  const t = useTranslations('Report')
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

  const segmentation = t('common.segmentationBased')
  const computed = t('common.computed')
  const slides = []
  if (metrics.neckWidthMm != null) {
    slides.push({
      id: 'width',
      titleLead: t('neck.slides.width.titleLead'),
      titleAccent: t('neck.slides.width.titleAccent'),
      body: t('neck.slides.width.body'),
      meter: {
        metricLabel: t('neck.slides.width.metricLabel'),
        sourceLabel: segmentation,
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
      titleLead: t('neck.slides.ratio.titleLead'),
      titleAccent: t('neck.slides.ratio.titleAccent'),
      body: t('neck.slides.ratio.body'),
      meter: {
        metricLabel: t('neck.slides.ratio.metricLabel'),
        sourceLabel: computed,
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
    { label: t('neck.width'), value: metrics.widthClass },
    { label: t('neck.definition'), value: metrics.definitionClass },
    { label: t('neck.length'), value: metrics.lengthClass },
    { label: t('neck.aging'), value: metrics.agingClass },
  ]

  const left = [
    {
      label: t('neck.width'),
      value: metrics.neckWidthMm != null ? `${fmt(metrics.neckWidthMm)} mm` : null,
    },
    { label: t('neck.metrics.widthClass'), value: metrics.widthClass },
    { label: t('neck.metrics.definitionLabel'), value: metrics.definitionClass },
  ]
  const right = [
    { label: t('neck.metrics.neckJawRatio'), value: fmt(metrics.neckJawRatio) },
    { label: t('neck.metrics.lengthLabel'), value: metrics.lengthClass },
    { label: t('neck.metrics.agingLabel'), value: metrics.agingClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.neck').toLowerCase()}
        subtitle={t('neck.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('neck.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('neck.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('neck.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
