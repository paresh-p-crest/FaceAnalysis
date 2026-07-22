'use client'

import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import {
  AllMetricsTable,
  FeatureHeroFrame,
  FeatureSummaryGrid,
} from './FeatureSummaryUi'
import { resolveFeatureHero } from '../../utils/featureParsing'

function buildDetailSlides(s, t) {
  const slides = []

  if (s.score != null) {
    slides.push({
      id: 'score',
      titleLead: t('skin.overallSkinScore'),
      titleAccent: '',
      body: `${t('skin.skinToneLabel', { tone: s.skinTone })}. ${t('skin.avgBrightness', { brightness: s.brightness, texture: s.texture })}.`,
      meter: {
        metricLabel: t('common.overallScore'),
        valueText: `${s.score}/100`,
        valueNum: s.score,
        rangeMin: 0,
        rangeMax: 100,
        rangeMinLabel: t('common.needsCare'),
        rangeMaxLabel: t('common.clear'),
      },
    })
  }

  if (s.redness) {
    slides.push({
      id: 'redness',
      titleLead: t('skin.rednessSensitivity'),
      titleAccent: '',
      body: s.redness === 'Normal' ? t('skin.rednessNormal') : t('skin.rednessReview', { level: s.redness }),
      meter: {
        metricLabel: t('skin.avgRednessIndex'),
        valueText: s.redness,
        valueNum: parseFloat(s.regionalVariance || '0'),
        rangeMin: 0,
        rangeMax: 50,
        rangeMinLabel: '0',
        rangeMaxLabel: '50',
      },
    })
  }

  if (s.underEyeHealth) {
    slides.push({
      id: 'under-eye',
      titleLead: t('skin.underEye'),
      titleAccent: '',
      body: s.underEyeHealth === 'Dark circles present'
        ? t('skin.underEyeDark')
        : s.underEyeHealth === 'Shadowed'
          ? t('skin.underEyeShadowed')
          : t('skin.underEyeHealthy', { health: s.underEyeHealth.toLowerCase() }),
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
    { label: t('skin.skinTone'), value: s.skinTone },
    { label: t('skin.texture'), value: s.texture },
    { label: t('skin.clarity'), value: s.clarity },
    { label: t('common.overallScore'), value: `${s.score}/100` },
  ]

  const left = [
    { label: t('skin.skinTone'), value: s.skinTone },
    { label: t('skin.toneUniformity'), value: s.tone },
    { label: t('skin.texture'), value: s.texture },
    { label: t('skin.clarity'), value: s.clarity },
    { label: t('skin.pigmentation'), value: s.pigmentation },
  ]
  const right = [
    { label: t('skin.rednessSensitivity'), value: s.redness },
    { label: t('skin.underEye'), value: s.underEyeHealth },
    { label: t('skin.underEyeBrightness'), value: s.underEyeBrightness },
    { label: t('skin.tZone'), value: s.poreEstimate },
    ...(s.hydration ? [{ label: t('skin.hydration'), value: s.hydration }] : []),
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
            alt={t('nav.skin')}
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
