'use client'

import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import {
  AllMetricsTable,
  FeatureHeroFrame,
  FeatureSummaryGrid,
} from './FeatureSummaryUi'
import { resolveFeatureHero } from '../../utils/featureParsing'

function fmt(v, digits = 2) {
  if (v == null || Number.isNaN(Number(v))) return null
  return Number(v).toFixed(digits)
}

function textOrDash(v) {
  if (v == null) return '—'
  const s = String(v).trim()
  return s.length ? s : '—'
}

function buildDetailSlides(s, t) {
  const slides = []
  const rough = s.roughnessRin != null ? Number(s.roughnessRin) : null
  const homo = s.homogeneityRin != null ? Number(s.homogeneityRin) : null
  const skew = s.oilinessSkew != null ? Number(s.oilinessSkew) : null
  const ueL = s.underEyeLuminance != null ? Number(s.underEyeLuminance) : null
  const faceL = s.faceLuminance != null ? Number(s.faceLuminance) : null

  if (Number.isFinite(rough)) {
    slides.push({
      id: 'roughness',
      titleLead: t('skin.slides.roughness.titleLead'),
      titleAccent: t('skin.slides.roughness.titleAccent'),
      body: t('skin.slides.roughness.body'),
      meter: {
        metricLabel: t('skin.slides.roughness.metricLabel'),
        sourceLabel: t('skin.slides.roughness.sourceLabel'),
        valueText: `${fmt(rough)} RIN`,
        valueNum: rough,
        rangeMin: 0.05,
        rangeMax: 0.3,
        rangeMinLabel: '0.05 RIN',
        rangeMaxLabel: '0.30 RIN',
      },
    })
  }

  if (Number.isFinite(homo)) {
    slides.push({
      id: 'homogeneity',
      titleLead: t('skin.slides.homogeneity.titleLead'),
      titleAccent: t('skin.slides.homogeneity.titleAccent'),
      body: t('skin.slides.homogeneity.body'),
      meter: {
        metricLabel: t('skin.slides.homogeneity.metricLabel'),
        sourceLabel: t('skin.slides.homogeneity.sourceLabel'),
        valueText: `${fmt(homo)} RIN`,
        valueNum: homo,
        rangeMin: 0.1,
        rangeMax: 0.45,
        rangeMinLabel: '0.10 RIN',
        rangeMaxLabel: '0.45 RIN',
      },
    })
  }

  if (Number.isFinite(skew)) {
    slides.push({
      id: 'oiliness',
      titleLead: t('skin.slides.oiliness.titleLead'),
      titleAccent: t('skin.slides.oiliness.titleAccent'),
      body: t('skin.slides.oiliness.body'),
      meter: {
        metricLabel: t('skin.slides.oiliness.metricLabel'),
        sourceLabel: t('skin.slides.oiliness.sourceLabel'),
        valueText: `${fmt(skew)} skew`,
        valueNum: skew,
        rangeMin: -1,
        rangeMax: 1,
        rangeMinLabel: '−1.0',
        rangeMaxLabel: '+1.0',
      },
    })
  }

  if (Number.isFinite(ueL) && Number.isFinite(faceL) && faceL > 0) {
    const ratio = Math.min(1.5, Math.max(0.5, ueL / faceL))
    slides.push({
      id: 'under-eye',
      titleLead: t('skin.slides.underEye.titleLead'),
      titleAccent: t('skin.slides.underEye.titleAccent'),
      body: t('skin.slides.underEye.body'),
      meter: {
        metricLabel: t('skin.slides.underEye.metricLabel'),
        sourceLabel: t('skin.slides.underEye.sourceLabel'),
        valueText: `${fmt(ueL, 1)} / ${fmt(faceL, 1)}`,
        valueNum: ratio,
        rangeMin: 0.5,
        rangeMax: 1.5,
        rangeMinLabel: t('skin.slides.underEye.darker'),
        rangeMaxLabel: t('skin.slides.underEye.brighter'),
      },
    })
  }

  return slides
}

export function SkinReportPanel({ skin, narrative: _narrative = null, featureParsing = null }) {
  const t = useTranslations('Report')
  if (!skin) return null

  const s = skin
  const heroImage = resolveFeatureHero('skin', s, featureParsing) || s.imageSrc
  const slides = buildDetailSlides(s, t)

  const cards = [
    { label: t('skin.undertone'), value: textOrDash(s.undertone) },
    { label: t('skin.blemishing'), value: textOrDash(s.blemishing) },
    { label: t('skin.evenness'), value: textOrDash(s.evenness) },
    { label: t('skin.texture'), value: textOrDash(s.texture) },
  ]

  const left = [
    { label: t('skin.undertone'), value: textOrDash(s.undertone) },
    { label: t('skin.blemishing'), value: textOrDash(s.blemishing) },
    { label: t('skin.evenness'), value: textOrDash(s.evenness) },
    { label: t('skin.texture'), value: textOrDash(s.texture) },
    { label: t('skin.oiliness'), value: textOrDash(s.oiliness) },
    { label: t('skin.darkCircles'), value: textOrDash(s.darkCircles) },
    {
      label: t('skin.roughnessRin'),
      value: s.roughnessRin != null ? `${fmt(Number(s.roughnessRin))} RIN` : '—',
    },
  ]
  const right = [
    {
      label: t('skin.homogeneityRin'),
      value: s.homogeneityRin != null ? `${fmt(Number(s.homogeneityRin))} RIN` : '—',
    },
    {
      label: t('skin.oilinessSkew'),
      value: s.oilinessSkew != null ? fmt(Number(s.oilinessSkew)) : '—',
    },
    {
      label: t('skin.blemishCount'),
      value: s.blemishCount != null ? String(s.blemishCount) : '—',
    },
    {
      label: t('skin.meanRednessA'),
      value: s.meanRednessA != null ? fmt(Number(s.meanRednessA), 1) : '—',
    },
    {
      label: t('skin.faceLuminance'),
      value: s.faceLuminance != null ? fmt(Number(s.faceLuminance), 1) : '—',
    },
    {
      label: t('skin.underEyeLuminance'),
      value: s.underEyeLuminance != null ? fmt(Number(s.underEyeLuminance), 1) : '—',
    },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.skin').toLowerCase()}
        subtitle={t('skin.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('skin.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('skin.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('skin.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
