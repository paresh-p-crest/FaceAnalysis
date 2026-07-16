'use client'

import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import { DetailCarousel, FeatureHeroFrame, MetricsColumn, SummaryLabelCard } from './FeatureSummaryUi'
import { resolveFeatureHero } from '../../utils/featureParsing'

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
  if (fromCv === 'Thin') return 'Thin / Narrow'
  if (fromCv === 'Full') return 'Full / Plush'
  if (fromCv === 'Balanced') return 'Balanced'
  if (!Number.isFinite(mouthMm)) return fromCv
  if (mouthMm < 42) return 'Thin / Narrow'
  if (mouthMm > 55) return 'Full / Wide'
  return 'Balanced'
}

function classifyWidth(mouthMm) {
  if (!Number.isFinite(mouthMm)) return null
  if (mouthMm < 42) return 'Narrow'
  if (mouthMm > 55) return 'Wide'
  return 'Average'
}

function classifyProportions(cupidDeg) {
  if (!Number.isFinite(cupidDeg)) return null
  if (cupidDeg < 120) return 'Peaked / Defined'
  if (cupidDeg > 145) return 'Flat / Subtle'
  return 'Moderate Arch'
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
    widthLabel: classifyWidth(mouthMm) || textOrNull(lips.fullness),
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
      titleLead: 'Mouth Width',
      titleAccent: '(mm)',
      body: 'Horizontal distance between the mouth corners. Typical range 40–60 mm.',
      meter: {
        metricLabel: 'Mouth Width',
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
      titleLead: "Cupid's Bow",
      titleAccent: 'Angle',
      body: "Angle at the Cupid's bow dip. Lower = more peaked/defined upper lip arch.",
      meter: {
        metricLabel: "Cupid's Bow Angle",
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
      titleLead: 'Philtrum',
      titleAccent: 'Length',
      body: "Distance from subnasale (base of nose) to the Cupid's bow dip. Typical range 10–20 mm.",
      meter: {
        metricLabel: 'Philtrum Length',
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

function buildAllMetricsRows(metrics) {
  const left = [
    { label: 'Mouth Width', value: formatMm(metrics.mouthMm) },
    { label: "Cupid's Bow Angle", value: formatDeg(metrics.cupidDeg) },
    { label: 'Width Classification', value: metrics.widthLabel },
    { label: 'Health', value: metrics.healthLabel },
  ]
  const right = [
    { label: 'Philtrum Length', value: formatMm(metrics.philtrumMm) },
    { label: 'Fullness Classification', value: metrics.fullnessLabel },
    { label: 'Proportions', value: metrics.proportionsLabel },
  ]
  return { left, right }
}

export function LipsReportPanel({ lips, featureParsing = null, narrative: _narrative = null }) {
  const t = useTranslations('Report')
  if (!lips) return null

  const heroImage = resolveFeatureHero('lips', lips, featureParsing) || lips.imageSrc
  const metrics = buildLipMetrics(lips, featureParsing)
  const slides = buildDetailSlides(metrics, t)
  const { left, right } = buildAllMetricsRows(metrics)

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
