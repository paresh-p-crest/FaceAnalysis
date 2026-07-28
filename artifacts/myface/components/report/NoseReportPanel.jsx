'use client'

import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import { DetailCarousel, FeatureHeroFrame, MetricsColumn, SummaryLabelCard } from './FeatureSummaryUi'
import { resolveFeatureHero } from '../../utils/featureParsing'
import { toCvLabelKey } from '../../utils/cvReportLocale'
function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return null
  return s
}

function parsingValue(featureParsing, key) {
  if (featureParsing?.status !== 'ready') return null
  const m = featureParsing?.metrics?.nose?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function formatMm(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)} mm`
}

function formatRatio(n, digits = 4) {
  if (n == null || !Number.isFinite(n)) return null
  return Number(n).toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

function classifyShape(aspect) {
  if (!Number.isFinite(aspect)) return null
  if (aspect < 0.6) return 'narrowLeptorrhine'
  if (aspect > 0.85) return 'widePlatyrrhine'
  return 'averageMesorrhine'
}

function classifyHeight(heightMm) {
  if (!Number.isFinite(heightMm)) return null
  if (heightMm < 45) return 'short'
  if (heightMm > 55) return 'long'
  return 'average'
}

function classifyTip(nasoCanthal) {
  if (!Number.isFinite(nasoCanthal)) return null
  if (nasoCanthal > 1.05) return 'wideBulbous'
  if (nasoCanthal < 0.95) return 'narrowRefined'
  return 'balanced'
}

function classifyWidth(widthMm, cvWidth) {
  const fromCv = toCvLabelKey(cvWidth)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 30) return 'narrow'
  if (widthMm > 40) return 'wide'
  return 'average'
}

function buildNoseMetrics(nose, featureParsing) {
  const widthMm = parsingValue(featureParsing, 'nasal_width_mm')
  const heightMm = parsingValue(featureParsing, 'nasal_height_mm')
  const aspect = parsingValue(featureParsing, 'nasal_aspect_ratio_width_over_height')
  const nasoCanthal = parsingValue(featureParsing, 'naso_canthal_ratio_nose_width_over_intercanthal')
  const pyramidal = parsingValue(featureParsing, 'pyramidal_width_mm')
  const cvAspect = nose.widthLengthRatio != null ? parseFloat(nose.widthLengthRatio) : null
  const aspectValue = aspect ?? (Number.isFinite(cvAspect) ? cvAspect : null)

  return {
    widthMm,
    heightMm,
    aspect: aspectValue,
    nasoCanthal,
    pyramidal,
    shapeLabel: classifyShape(aspectValue),
    heightLabel: classifyHeight(heightMm),
    tipLabel: classifyTip(nasoCanthal),
    widthLabel: classifyWidth(widthMm, nose.width),
  }
}

function buildDetailSlides(metrics, t) {
  const landmark = t('common.landmarkBased')
  const slides = []

  if (metrics.aspect != null) {
    slides.push({
      id: 'aspect',
      titleLead: t('nose.slides.aspect.titleLead'),
      titleAccent: t('nose.slides.aspect.titleAccent'),
      body: t('nose.slides.aspect.body'),
      meter: {
        metricLabel: t('nose.slides.aspect.metricLabel'),
        sourceLabel: landmark,
        valueText: `${formatRatio(metrics.aspect)} ratio`,
        valueNum: metrics.aspect,
        rangeMin: 0.5,
        rangeMax: 1.1,
        rangeMinLabel: t('nose.slides.aspect.rangeMinLabel'),
        rangeMaxLabel: t('nose.slides.aspect.rangeMaxLabel'),
      },
    })
  }

  if (metrics.widthMm != null) {
    slides.push({
      id: 'width',
      titleLead: t('nose.slides.width.titleLead'),
      titleAccent: t('nose.slides.width.titleAccent'),
      body: t('nose.slides.width.body'),
      meter: {
        metricLabel: t('nose.slides.width.metricLabel'),
        sourceLabel: landmark,
        valueText: formatMm(metrics.widthMm),
        valueNum: metrics.widthMm,
        rangeMin: 25,
        rangeMax: 45,
        rangeMinLabel: '25 mm',
        rangeMaxLabel: '45 mm',
      },
    })
  }

  if (metrics.nasoCanthal != null) {
    slides.push({
      id: 'naso-canthal',
      titleLead: t('nose.slides.nasoCanthal.titleLead'),
      titleAccent: t('nose.slides.nasoCanthal.titleAccent'),
      body: t('nose.slides.nasoCanthal.body'),
      meter: {
        metricLabel: t('nose.slides.nasoCanthal.metricLabel'),
        sourceLabel: landmark,
        valueText: formatRatio(metrics.nasoCanthal),
        valueNum: metrics.nasoCanthal,
        rangeMin: 0.8,
        rangeMax: 1.2,
        rangeMinLabel: formatRatio(0.8, 1),
        rangeMaxLabel: formatRatio(1.2, 1),
      },
    })
  }

  return slides
}

function buildAllMetricsRows(metrics, t) {
  const left = [
    { label: t('nose.metrics.nasalWidth'), value: formatMm(metrics.widthMm) },
    { label: t('nose.metrics.nasalAspectRatio'), value: formatRatio(metrics.aspect) },
    { label: t('nose.metrics.pyramidalWidth'), value: formatMm(metrics.pyramidal) },
    { label: t('nose.metrics.heightClass'), value: metrics.heightLabel },
    { label: t('nose.metrics.widthClass'), value: metrics.widthLabel },
  ]
  const right = [
    { label: t('nose.metrics.nasalHeight'), value: formatMm(metrics.heightMm) },
    { label: t('nose.metrics.nasoCanthalRatio'), value: formatRatio(metrics.nasoCanthal) },
    { label: t('nose.metrics.shapeClass'), value: metrics.shapeLabel },
    { label: t('nose.metrics.tipClass'), value: metrics.tipLabel },
  ]
  return { left, right }
}

export function NoseReportPanel({ nose, featureParsing = null }) {
  const t = useTranslations('Report')
  if (!nose) return null

  const heroImage = resolveFeatureHero('nose', nose, featureParsing) || nose.imageSrc
  const metrics = buildNoseMetrics(nose, featureParsing)
  const slides = buildDetailSlides(metrics, t)
  const { left, right } = buildAllMetricsRows(metrics, t)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.nose').toLowerCase()}
        subtitle={t('nose.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('nose.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('nose.summaryTitle')}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label={t('nose.shape')} value={metrics.shapeLabel} />
            <SummaryLabelCard label={t('nose.height')} value={metrics.heightLabel} />
            <SummaryLabelCard label={t('nose.tip')} value={metrics.tipLabel} />
            <SummaryLabelCard label={t('nose.width')} value={metrics.widthLabel} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('nose.allMetrics')}</p>
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
