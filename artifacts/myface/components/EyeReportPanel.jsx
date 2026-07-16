'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './report/ReportSectionHeading'
import {
  DetailCarousel,
  FeatureHeroFrame,
  MetricsColumn,
  SummaryLabelCard,
} from './report/FeatureSummaryUi'
import { cropFeatureBefore } from '../utils/aestheticProjection'

function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return null
  return s
}

function parsingValue(featureParsing, key) {
  if (featureParsing?.status !== 'ready') return null
  const m = featureParsing?.metrics?.eyes?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function avg(a, b) {
  if (a == null && b == null) return null
  if (a == null) return b
  if (b == null) return a
  return (a + b) / 2
}

function formatRatio(n, digits = 4) {
  if (n == null || !Number.isFinite(n)) return null
  return Number(n).toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

function buildDetailSlides(m, fp, t) {
  const rEar = parsingValue(fp, 'right_eye_aspect_ratio')
  const lEar = parsingValue(fp, 'left_eye_aspect_ratio')
  const avgEar = avg(rEar, lEar)
  const spacing = parsingValue(fp, 'eye_spacing_ipd_over_face_width')
  const rCurv = parsingValue(fp, 'right_lower_eyelid_curvature')
  const lCurv = parsingValue(fp, 'left_lower_eyelid_curvature')
  const avgCurv = avg(rCurv, lCurv)
  const cvCurv = m.lowerLidCurvature != null ? parseFloat(m.lowerLidCurvature) : null
  const curvValue = avgCurv ?? (Number.isFinite(cvCurv) ? cvCurv : null)

  const useParsingCurv = avgCurv != null
  const curvMin = useParsingCurv ? 0 : (m.curvatureMin != null ? parseFloat(m.curvatureMin) : null)
  const curvMax = useParsingCurv ? 0.25 : (m.curvatureMax != null ? parseFloat(m.curvatureMax) : null)

  const landmark = fp?.status === 'ready' ? t('common.landmarkBased') : null
  const slides = []

  if (curvValue != null) {
    slides.push({
      id: 'curvature',
      titleLead: t('eye.slides.curvature.titleLead'),
      titleAccent: t('eye.slides.curvature.titleAccent'),
      body: t('eye.slides.curvature.body'),
      meter: {
        metricLabel: t('eye.slides.curvature.metricLabel'),
        sourceLabel: useParsingCurv ? t('eye.slides.curvature.sourceSagitta') : landmark,
        valueText: useParsingCurv
          ? `${formatRatio(curvValue)} ${t('eye.slides.curvature.ratioSuffix')}`
          : formatRatio(curvValue, 2),
        valueNum: curvValue,
        rangeMin: Number.isFinite(curvMin) ? curvMin : null,
        rangeMax: Number.isFinite(curvMax) ? curvMax : null,
        rangeMinLabel: useParsingCurv ? t('eye.slides.curvature.flat') : undefined,
        rangeMaxLabel: useParsingCurv ? t('eye.slides.curvature.curved') : undefined,
      },
    })
  }

  if (avgEar != null) {
    slides.push({
      id: 'ear',
      titleLead: t('eye.slides.ear.titleLead'),
      titleAccent: t('eye.slides.ear.titleAccent'),
      body: t('eye.slides.ear.body'),
      meter: {
        metricLabel: t('eye.slides.ear.metricLabel'),
        sourceLabel: t('eye.slides.ear.sourceBoth'),
        valueText: formatRatio(avgEar),
        valueNum: avgEar,
        rangeMin: 0.25,
        rangeMax: 0.45,
        rangeMinLabel: formatRatio(0.25, 2),
        rangeMaxLabel: formatRatio(0.45, 2),
      },
    })
  }

  if (spacing != null) {
    slides.push({
      id: 'spacing',
      titleLead: t('eye.slides.spacing.titleLead'),
      titleAccent: t('eye.slides.spacing.titleAccent'),
      body: t('eye.slides.spacing.body'),
      meter: {
        metricLabel: t('eye.slides.spacing.metricLabel'),
        sourceLabel: landmark || t('common.landmarkBased'),
        valueText: formatRatio(spacing),
        valueNum: spacing,
        rangeMin: 0.4,
        rangeMax: 0.5,
        rangeMinLabel: formatRatio(0.4, 2),
        rangeMaxLabel: formatRatio(0.5, 2),
      },
    })
  }

  return slides
}

function buildAllMetricsRows(m, fp, t) {
  const rEar = parsingValue(fp, 'right_eye_aspect_ratio')
  const lEar = parsingValue(fp, 'left_eye_aspect_ratio')
  const avgEar = avg(rEar, lEar)
  const spacing = parsingValue(fp, 'eye_spacing_ipd_over_face_width')
  const rCurv = parsingValue(fp, 'right_lower_eyelid_curvature')
  const lCurv = parsingValue(fp, 'left_lower_eyelid_curvature')
  const avgCurv = avg(rCurv, lCurv)
  const cvCurv = m.lowerLidCurvature != null ? parseFloat(m.lowerLidCurvature) : null

  const left = [
    { label: t('eye.metrics.rightEar'), value: formatRatio(rEar) },
    { label: t('eye.metrics.avgEar'), value: formatRatio(avgEar) },
    { label: t('eye.metrics.rightCurvature'), value: formatRatio(rCurv) },
    { label: t('eye.metrics.avgCurvature'), value: formatRatio(avgCurv ?? cvCurv) },
    { label: t('eye.metrics.eyelidExposureClass'), value: textOrNull(m.eyelidExposure) },
  ]

  const right = [
    { label: t('eye.metrics.leftEar'), value: formatRatio(lEar) },
    { label: t('eye.metrics.spacingRatio'), value: formatRatio(spacing) },
    { label: t('eye.metrics.leftCurvature'), value: formatRatio(lCurv) },
    { label: t('eye.metrics.tiltClass'), value: textOrNull(m.eyeTilt) },
  ]

  return { left, right }
}

export function EyeReportPanel({
  eyeAnalysis,
  narrative: _narrative = null,
  featureParsing = null,
  photo = null,
  landmarks = null,
}) {
  const t = useTranslations('Report')
  const [periHero, setPeriHero] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!photo || !landmarks?.length) {
        if (!cancelled) setPeriHero(null)
        return
      }
      try {
        const src = await cropFeatureBefore(photo, landmarks, 'periorbital', 1.2)
        if (!cancelled) setPeriHero(src || null)
      } catch {
        if (!cancelled) setPeriHero(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [photo, landmarks])

  const m = eyeAnalysis?.metrics
  if (!m) return null

  const heroImage = periHero
  const slides = buildDetailSlides(m, featureParsing, t)
  const { left, right } = buildAllMetricsRows(m, featureParsing, t)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.eyes').toLowerCase()}
        subtitle={t('eye.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('eye.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('eye.summaryTitle')}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label={t('eye.tilt')} value={textOrNull(m.eyeTilt)} />
            <SummaryLabelCard label={t('eye.eyelidExposure')} value={textOrNull(m.eyelidExposure)} />
            <SummaryLabelCard label={t('eye.scleraColor')} value={textOrNull(m.scleraColor)} />
            <SummaryLabelCard label={t('eye.underEyeHealth')} value={textOrNull(m.underEyeHealth)} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('eye.allMetrics')}</p>
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
