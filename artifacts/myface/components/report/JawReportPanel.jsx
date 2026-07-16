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

function classifyDefinition(riseMm, cvDef) {
  const fromCv = textOrNull(cvDef)
  if (fromCv === 'Soft') return 'Soft / Rounded'
  if (fromCv === 'Defined') return 'Moderate / Defined'
  if (fromCv === 'Angular') return 'Angular / Defined'
  if (!Number.isFinite(riseMm)) return fromCv
  if (riseMm < 18) return 'Soft / Rounded'
  if (riseMm > 32) return 'Angular / Defined'
  return 'Moderate / Defined'
}

function classifyWidth(widthMm, cvWidth) {
  const fromCv = textOrNull(cvWidth)
  if (fromCv) return fromCv
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 90) return 'Narrow'
  if (widthMm > 110) return 'Wide'
  return 'Balanced'
}

function classifyShape(avgAngle) {
  if (!Number.isFinite(avgAngle)) return null
  if (avgAngle < 55) return 'Sharp V / U'
  if (avgAngle < 75) return 'Soft Taper'
  return 'Square'
}

/**
 * Jaw — Lips-matched UI. Image source / data unchanged.
 */
export function JawReportPanel({ jaw, featureParsing, narrative: _narrative, imageSrc = null }) {
  const t = useTranslations('Report')
  const j = jaw || {}
  const heroImage = resolveFeatureHero('jaw', j, featureParsing) || imageSrc || j.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.jaw || {}
    const riseMm = m.frontal_jaw_rise_mm?.value != null ? Number(m.frontal_jaw_rise_mm.value) : null
    const widthMm = m.jaw_width_mm?.value != null ? Number(m.jaw_width_mm.value) : null
    const rightAngle =
      m.right_jaw_inclination_angle_deg?.value != null
        ? Number(m.right_jaw_inclination_angle_deg.value)
        : null
    const leftAngle =
      m.left_jaw_inclination_angle_deg?.value != null
        ? Number(m.left_jaw_inclination_angle_deg.value)
        : null
    const faceWidthMm = m.face_width_mm?.value != null ? Number(m.face_width_mm.value) : null
    const avgAngle =
      rightAngle != null && leftAngle != null
        ? (rightAngle + leftAngle) / 2
        : rightAngle ?? leftAngle ?? (j.jawAngle != null ? Number(j.jawAngle) : null)
    const avgNum = avgAngle != null && !Number.isNaN(Number(avgAngle)) ? Number(avgAngle) : null

    return {
      riseMm,
      widthMm,
      rightAngle,
      leftAngle,
      faceWidthMm,
      avgAngle: avgNum,
      definitionClass: classifyDefinition(riseMm, j.mandibularDefinition),
      widthClass: classifyWidth(widthMm, j.jawWidthClass),
      shapeClass: classifyShape(avgNum),
      angleClass: avgNum != null ? String(Math.round(avgNum)) : null,
    }
  }, [featureParsing, j.mandibularDefinition, j.jawWidthClass, j.jawAngle])

  const landmark = t('common.landmarkBased')
  const slides = []
  if (metrics.riseMm != null) {
    slides.push({
      id: 'rise',
      titleLead: t('jaw.slides.rise.titleLead'),
      titleAccent: t('jaw.slides.rise.titleAccent'),
      body: t('jaw.slides.rise.body'),
      meter: {
        metricLabel: t('jaw.slides.rise.metricLabel'),
        sourceLabel: landmark,
        valueText: `${fmt(metrics.riseMm)} mm`,
        valueNum: metrics.riseMm,
        rangeMin: 10,
        rangeMax: 40,
        rangeMinLabel: '10 mm',
        rangeMaxLabel: '40 mm',
      },
    })
  }
  if (metrics.widthMm != null) {
    slides.push({
      id: 'width',
      titleLead: t('jaw.slides.width.titleLead'),
      titleAccent: t('jaw.slides.width.titleAccent'),
      body: t('jaw.slides.width.body'),
      meter: {
        metricLabel: t('jaw.slides.width.metricLabel'),
        sourceLabel: landmark,
        valueText: `${fmt(metrics.widthMm)} mm`,
        valueNum: metrics.widthMm,
        rangeMin: 90,
        rangeMax: 140,
        rangeMinLabel: '90 mm',
        rangeMaxLabel: '140 mm',
      },
    })
  }
  if (metrics.avgAngle != null) {
    slides.push({
      id: 'angle',
      titleLead: t('jaw.slides.angle.titleLead'),
      titleAccent: t('jaw.slides.angle.titleAccent'),
      body: t('jaw.slides.angle.body'),
      meter: {
        metricLabel: t('jaw.slides.angle.metricLabel'),
        sourceLabel: landmark,
        valueText: `${fmt(metrics.avgAngle)}°`,
        valueNum: metrics.avgAngle,
        rangeMin: 30,
        rangeMax: 80,
        rangeMinLabel: '30°',
        rangeMaxLabel: '80°',
      },
    })
  }

  const cards = [
    { label: t('jaw.definition'), value: metrics.definitionClass },
    { label: t('jaw.width'), value: metrics.widthClass },
    { label: t('jaw.shape'), value: metrics.shapeClass },
    { label: t('jaw.angle'), value: metrics.angleClass },
  ]

  const left = [
    { label: t('jaw.width'), value: metrics.widthMm != null ? `${fmt(metrics.widthMm)} mm` : null },
    { label: t('jaw.metrics.frontalRise'), value: metrics.riseMm != null ? `${fmt(metrics.riseMm)} mm` : null },
    { label: t('jaw.metrics.rightInclination'), value: metrics.rightAngle != null ? `${fmt(metrics.rightAngle)}°` : null },
    { label: t('jaw.metrics.definitionClass'), value: metrics.definitionClass },
    { label: t('jaw.metrics.shapeClass'), value: metrics.shapeClass },
  ]
  const right = [
    { label: t('jaw.metrics.leftInclination'), value: metrics.leftAngle != null ? `${fmt(metrics.leftAngle)}°` : null },
    { label: t('jaw.metrics.faceWidth'), value: metrics.faceWidthMm != null ? `${fmt(metrics.faceWidthMm)} mm` : null },
    { label: t('jaw.metrics.widthClass'), value: metrics.widthClass },
    { label: t('jaw.metrics.avgAngleClass'), value: metrics.angleClass },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.jaw').toLowerCase()}
        subtitle={t('jaw.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('jaw.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('jaw.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('jaw.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>
    </div>
  )
}
