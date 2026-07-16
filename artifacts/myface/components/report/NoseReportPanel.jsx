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
  if (aspect < 0.6) return 'Narrow / Leptorrhine'
  if (aspect > 0.85) return 'Wide / Platyrrhine'
  return 'Average / Mesorrhine'
}

function classifyHeight(heightMm) {
  if (!Number.isFinite(heightMm)) return null
  if (heightMm < 45) return 'Short'
  if (heightMm > 55) return 'Long'
  return 'Average'
}

function classifyTip(nasoCanthal) {
  if (!Number.isFinite(nasoCanthal)) return null
  if (nasoCanthal > 1.05) return 'Wide / Bulbous'
  if (nasoCanthal < 0.95) return 'Narrow / Refined'
  return 'Balanced'
}

function classifyWidth(widthMm, cvWidth) {
  const fromCv = textOrNull(cvWidth)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 30) return 'Narrow'
  if (widthMm > 40) return 'Wide'
  return 'Average'
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
      titleLead: 'Nasal',
      titleAccent: 'Aspect Ratio',
      body: 'Width divided by height. <0.6 = narrow, 0.6–0.85 = average, >0.85 = wide.',
      meter: {
        metricLabel: 'Nasal Aspect Ratio (W/H)',
        sourceLabel: landmark,
        valueText: `${formatRatio(metrics.aspect)} ratio`,
        valueNum: metrics.aspect,
        rangeMin: 0.5,
        rangeMax: 1.1,
        rangeMinLabel: '0.5 narrow',
        rangeMaxLabel: '1.1 wide',
      },
    })
  }

  if (metrics.widthMm != null) {
    slides.push({
      id: 'width',
      titleLead: 'Nasal Width',
      titleAccent: '(mm)',
      body: 'Distance between the alae (outer nostrils) in millimetres. Reference IPD = 63.5 mm.',
      meter: {
        metricLabel: 'Nasal Ala Width',
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
      titleLead: 'Naso-Canthal',
      titleAccent: 'Ratio',
      body: 'Alar width / inter-canthal distance. Ideal ≈ 1.0 (nose width = inner eye distance).',
      meter: {
        metricLabel: 'Naso-Canthal Ratio',
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

function buildAllMetricsRows(metrics) {
  const left = [
    { label: 'Nasal Width', value: formatMm(metrics.widthMm) },
    { label: 'Nasal Aspect Ratio (W/H)', value: formatRatio(metrics.aspect) },
    { label: 'Pyramidal Width', value: formatMm(metrics.pyramidal) },
    { label: 'Height Classification', value: metrics.heightLabel },
    { label: 'Width Classification', value: metrics.widthLabel },
  ]
  const right = [
    { label: 'Nasal Height', value: formatMm(metrics.heightMm) },
    { label: 'Naso-Canthal Ratio', value: formatRatio(metrics.nasoCanthal) },
    { label: 'Shape Classification', value: metrics.shapeLabel },
    { label: 'Tip Classification', value: metrics.tipLabel },
  ]
  return { left, right }
}

export function NoseReportPanel({ nose, featureParsing = null, narrative: _narrative = null }) {
  const t = useTranslations('Report')
  if (!nose) return null

  const heroImage = resolveFeatureHero('nose', nose, featureParsing) || nose.imageSrc
  const metrics = buildNoseMetrics(nose, featureParsing)
  const slides = buildDetailSlides(metrics, t)
  const { left, right } = buildAllMetricsRows(metrics)

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
