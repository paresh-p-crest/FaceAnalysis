'use client'

import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import {
  AllMetricsTable,
  FeatureHeroFrame,
  FeatureSummaryGrid,
} from './FeatureSummaryUi'
import { resolveFeatureHero } from '../../utils/featureParsing'

function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return null
  return s
}

function buildDetailSlides(e, t) {
  const slides = []

  if (e.earSize != null) {
    slides.push({
      id: 'ear-size',
      titleLead: t('ears.earSize'),
      titleAccent: '(IPD)',
      body: t('ears.earSizeTooltip'),
      meter: {
        metricLabel: t('ears.earSize'),
        valueText: `${e.earSize}× IPD`,
        valueNum: parseFloat(e.earSize),
        rangeMin: 0.6,
        rangeMax: 1.6,
        rangeMinLabel: '0.6×',
        rangeMaxLabel: '1.6×',
      },
    })
  }

  if (e.sizeDifference != null) {
    slides.push({
      id: 'size-diff',
      titleLead: t('ears.sizeDifference'),
      titleAccent: '(%)',
      body: t('ears.sizeDifferenceTooltip'),
      meter: {
        metricLabel: t('ears.sizeDifference'),
        valueText: `${e.sizeDifference}%`,
        valueNum: parseFloat(e.sizeDifference),
        rangeMin: 0,
        rangeMax: 20,
        rangeMinLabel: '0%',
        rangeMaxLabel: '20%',
      },
    })
  }

  return slides
}

export function EarReportPanel({
  ears,
  featureParsing = null,
  narrative: _narrative = null,
  imageSrc = null,
}) {
  const t = useTranslations('Report')
  if (!ears) return null

  const e = ears
  const heroImage = resolveFeatureHero('ears', e, featureParsing) || imageSrc || e.imageSrcLeft || e.imageSrc

  const slides = buildDetailSlides(e, t)

  const cards = [
    { label: t('ears.sizeClass'), value: textOrNull(e.earSizeClass) },
    { label: t('ears.symmetry'), value: textOrNull(e.earSymmetry) },
    { label: t('ears.protrusion'), value: textOrNull(e.protrusion) },
    { label: t('ears.verticalPosition'), value: textOrNull(e.earPosition) },
  ]

  const left = [
    { label: t('ears.earSize'), value: e.earSize != null ? `${e.earSize}× IPD` : null },
    { label: t('ears.sizeClass'), value: textOrNull(e.earSizeClass) },
    { label: t('ears.symmetry'), value: textOrNull(e.earSymmetry) },
    { label: t('ears.sizeDifference'), value: e.sizeDifference != null ? `${e.sizeDifference}%` : null },
  ]
  const right = [
    { label: t('ears.protrusion'), value: textOrNull(e.protrusion) },
    { label: t('ears.protrusionDepth'), value: e.earProtrusion != null ? `${e.earProtrusion}` : null },
    { label: t('ears.verticalPosition'), value: textOrNull(e.earPosition) },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.ears').toLowerCase()}
        subtitle={t('ears.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('ears.imageAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('ears.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('ears.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
