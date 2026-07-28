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
  const m = featureParsing?.metrics?.lips?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function formatMm(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)} mm`
}

function formatDeg(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)}°`
}

function classifyFullness(mouthMm, cvFullness) {
  const fromCv = textOrNull(cvFullness)
  if (fromCv === 'Thin') return 'thinNarrow'
  if (fromCv === 'Full') return 'fullPlush'
  if (fromCv === 'Balanced') return 'balanced'
  if (!Number.isFinite(mouthMm)) return toCvLabelKey(fromCv)
  if (mouthMm < 42) return 'thinNarrow'
  if (mouthMm > 55) return 'fullWide'
  return 'balanced'
}

function classifyWidth(mouthMm) {
  if (!Number.isFinite(mouthMm)) return null
  if (mouthMm < 42) return 'narrow'
  if (mouthMm > 55) return 'wide'
  return 'average'
}

function classifyProportions(cupidDeg) {
  if (!Number.isFinite(cupidDeg)) return null
  if (cupidDeg < 120) return 'peakedDefined'
  if (cupidDeg > 145) return 'flatSubtle'
  return 'moderateArch'
}

function buildLipMetrics(lips, featureParsing) {
  const mouthMm = parsingValue(featureParsing, 'mouth_width_mm')
  const philtrumMm = parsingValue(featureParsing, 'philtrum_length_mm')
  const cupidDeg = parsingValue(featureParsing, 'cupids_bow_angle_deg')

  return {
    mouthMm,
    philtrumMm,
    cupidDeg,
    fullnessLabel: classifyFullness(mouthMm, lips.fullness),
    widthLabel: classifyWidth(mouthMm) || toCvLabelKey(lips.fullness),
    proportionsLabel: classifyProportions(cupidDeg),
    healthLabel: 'N/A',
  }
}

function buildDetailSlides(metrics, t) {
  const landmark = t('common.landmarkBased')
  const slides = []

  if (metrics.mouthMm != null) {
    slides.push({
      id: 'mouth-width',
      titleLead: t('lips.slides.mouthWidth.titleLead'),
      titleAccent: t('lips.slides.mouthWidth.titleAccent'),
      body: t('lips.slides.mouthWidth.body'),
      meter: {
        metricLabel: t('lips.slides.mouthWidth.metricLabel'),
        sourceLabel: landmark,
        valueText: formatMm(metrics.mouthMm),
        valueNum: metrics.mouthMm,
        rangeMin: 35,
        rangeMax: 65,
        rangeMinLabel: '35 mm',
        rangeMaxLabel: '65 mm',
      },
    })
  }

  if (metrics.cupidDeg != null) {
    slides.push({
      id: 'cupid',
      titleLead: t('lips.slides.cupid.titleLead'),
      titleAccent: t('lips.slides.cupid.titleAccent'),
      body: t('lips.slides.cupid.body'),
      meter: {
        metricLabel: t('lips.slides.cupid.metricLabel'),
        sourceLabel: landmark,
        valueText: formatDeg(metrics.cupidDeg),
        valueNum: metrics.cupidDeg,
        rangeMin: 90,
        rangeMax: 140,
        rangeMinLabel: '90°',
        rangeMaxLabel: '140°',
      },
    })
  }

  if (metrics.philtrumMm != null) {
    slides.push({
      id: 'philtrum',
      titleLead: t('lips.slides.philtrum.titleLead'),
      titleAccent: t('lips.slides.philtrum.titleAccent'),
      body: t('lips.slides.philtrum.body'),
      meter: {
        metricLabel: t('lips.slides.philtrum.metricLabel'),
        sourceLabel: landmark,
        valueText: formatMm(metrics.philtrumMm),
        valueNum: metrics.philtrumMm,
        rangeMin: 10,
        rangeMax: 20,
        rangeMinLabel: '10 mm',
        rangeMaxLabel: '20 mm',
      },
    })
  }

  return slides
}

function buildAllMetricsRows(metrics, t) {
  const left = [
    { label: t('lips.metrics.mouthWidth'), value: formatMm(metrics.mouthMm) },
    { label: t('lips.metrics.cupidAngle'), value: formatDeg(metrics.cupidDeg) },
    { label: t('lips.metrics.widthClass'), value: metrics.widthLabel },
    { label: t('lips.health'), value: metrics.healthLabel },
  ]
  const right = [
    { label: t('lips.metrics.philtrumLength'), value: formatMm(metrics.philtrumMm) },
    { label: t('lips.metrics.fullnessClass'), value: metrics.fullnessLabel },
    { label: t('lips.proportions'), value: metrics.proportionsLabel },
  ]
  return { left, right }
}

export function LipsReportPanel({ lips, featureParsing = null }) {
  const t = useTranslations('Report')
  if (!lips) return null

  const heroImage = resolveFeatureHero('lips', lips, featureParsing) || lips.imageSrc
  const metrics = buildLipMetrics(lips, featureParsing)
  const slides = buildDetailSlides(metrics, t)
  const { left, right } = buildAllMetricsRows(metrics, t)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.lips').toLowerCase()}
        subtitle={t('lips.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('lips.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('lips.summaryTitle')}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label={t('lips.fullness')} value={metrics.fullnessLabel} />
            <SummaryLabelCard label={t('lips.width')} value={metrics.widthLabel} />
            <SummaryLabelCard label={t('lips.proportions')} value={metrics.proportionsLabel} />
            <SummaryLabelCard label={t('lips.health')} value={metrics.healthLabel} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('lips.allMetrics')}</p>
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
