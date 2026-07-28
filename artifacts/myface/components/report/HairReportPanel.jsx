'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import { resolveFeatureHero } from '../../utils/featureParsing'
import { toCvLabelKey } from '../../utils/cvReportLocale'
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

function classifyTempleWidth(widthMm) {
  if (!Number.isFinite(widthMm)) return null
  if (widthMm < 100) return 'narrow'
  if (widthMm > 112) return 'wide'
  return 'average'
}

/**
 * Hair — Lips-matched UI. Image source / data unchanged.
 */
export function HairReportPanel({
  hair,
  featureParsing,
  imageSrc = null,
}) {
  const t = useTranslations('Report')
  const h = hair || {}
  const heroImage = resolveFeatureHero('hair', h, featureParsing) || imageSrc || h.imageSrc

  const metrics = useMemo(() => {
    const m = featureParsing?.metrics?.hair || {}
    const widthNum =
      m.forehead_width_mm?.value != null ? Number(m.forehead_width_mm.value) : null
    const heightNum =
      m.forehead_height_mm_mesh_approx?.value != null
        ? Number(m.forehead_height_mm_mesh_approx.value)
        : null
    const rightNum =
      m.right_temple_inclination_angle_deg?.value != null
        ? Number(m.right_temple_inclination_angle_deg.value)
        : null
    const leftNum =
      m.left_temple_inclination_angle_deg?.value != null
        ? Number(m.left_temple_inclination_angle_deg.value)
        : null
    const avgTemple =
      rightNum != null && leftNum != null
        ? (rightNum + leftNum) / 2
        : rightNum ?? leftNum

    return {
      foreheadWidthMm: widthNum,
      foreheadHeightMm: heightNum,
      rightTempleDeg: rightNum,
      leftTempleDeg: leftNum,
      avgTempleDeg: avgTemple != null && !Number.isNaN(avgTemple) ? avgTemple : null,
      templeWidthClass: classifyTempleWidth(widthNum),
      densityClass: toCvLabelKey(h.densityEstimate) || textOrNull(h.densityEstimate),
      hairlineClass: toCvLabelKey(h.hairline) || textOrNull(h.hairline),
      foreheadExposureClass: toCvLabelKey(h.foreheadExposure) || textOrNull(h.foreheadExposure),
      coverageClass: toCvLabelKey(h.coverageEstimate) || textOrNull(h.coverageEstimate),
      densityPct: h.densityPct != null ? Number(h.densityPct) : null,
    }
  }, [featureParsing, h.densityEstimate, h.hairline, h.foreheadExposure, h.coverageEstimate, h.densityPct])

  const landmark = t('common.landmarkBased')
  const slides = []
  if (metrics.foreheadWidthMm != null) {
    slides.push({
      id: 'fw',
      titleLead: t('hair.slides.foreheadWidth.titleLead'),
      titleAccent: t('hair.slides.foreheadWidth.titleAccent'),
      body: t('hair.slides.foreheadWidth.body'),
      meter: {
        metricLabel: t('hair.slides.foreheadWidth.metricLabel'),
        sourceLabel: landmark,
        valueText: `${fmt(metrics.foreheadWidthMm)} mm`,
        valueNum: metrics.foreheadWidthMm,
        rangeMin: 100,
        rangeMax: 112,
        rangeMinLabel: '100 mm',
        rangeMaxLabel: '112 mm',
      },
    })
  }
  if (metrics.foreheadHeightMm != null) {
    slides.push({
      id: 'fh',
      titleLead: t('hair.slides.foreheadHeight.titleLead'),
      titleAccent: t('hair.slides.foreheadHeight.titleAccent'),
      body: t('hair.slides.foreheadHeight.body'),
      meter: {
        metricLabel: t('hair.slides.foreheadHeight.metricLabel'),
        sourceLabel: landmark,
        valueText: `${fmt(metrics.foreheadHeightMm)} mm`,
        valueNum: metrics.foreheadHeightMm,
        rangeMin: 50,
        rangeMax: 75,
        rangeMinLabel: '50 mm',
        rangeMaxLabel: '75 mm',
      },
    })
  }
  if (metrics.avgTempleDeg != null) {
    slides.push({
      id: 'temple',
      titleLead: t('hair.slides.temple.titleLead'),
      titleAccent: t('hair.slides.temple.titleAccent'),
      body: t('hair.slides.temple.body'),
      meter: {
        metricLabel: t('hair.slides.temple.metricLabel'),
        sourceLabel: landmark,
        valueText: `${fmt(metrics.avgTempleDeg)}°`,
        valueNum: metrics.avgTempleDeg,
        rangeMin: 5,
        rangeMax: 25,
        rangeMinLabel: '5°',
        rangeMaxLabel: '25°',
      },
    })
  }

  const cards = [
    { label: t('hair.templeWidth'), value: metrics.templeWidthClass },
    { label: t('hair.density'), value: metrics.densityClass },
    { label: t('hair.hairline'), value: metrics.hairlineClass },
    { label: t('hair.foreheadExposure'), value: metrics.foreheadExposureClass },
  ]

  const left = [
    {
      label: t('hair.metrics.foreheadWidth'),
      value: metrics.foreheadWidthMm != null ? `${fmt(metrics.foreheadWidthMm)} mm` : null,
    },
    {
      label: t('hair.metrics.foreheadHeight'),
      value: metrics.foreheadHeightMm != null ? `${fmt(metrics.foreheadHeightMm)} mm` : null,
    },
    {
      label: t('hair.metrics.rightTemple'),
      value: metrics.rightTempleDeg != null ? `${fmt(metrics.rightTempleDeg)}°` : null,
    },
    { label: t('hair.metrics.templeWidthClass'), value: metrics.templeWidthClass },
    { label: t('hair.hairline'), value: metrics.hairlineClass },
  ]
  const right = [
    {
      label: t('hair.metrics.leftTemple'),
      value: metrics.leftTempleDeg != null ? `${fmt(metrics.leftTempleDeg)}°` : null,
    },
    { label: t('hair.density'), value: metrics.densityClass },
    { label: t('hair.foreheadExposure'), value: metrics.foreheadExposureClass },
    { label: t('hair.metrics.coverage'), value: metrics.coverageClass },
    {
      label: t('hair.metrics.densityPct'),
      value: metrics.densityPct != null ? `${fmt(metrics.densityPct, 0)}%` : null,
    },
  ]

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.hair').toLowerCase()}
        subtitle={t('hair.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('hair.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('hair.summaryTitle')}</p>
        <FeatureSummaryGrid cards={cards} slides={slides} />
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('hair.allMetrics')}</p>
        <AllMetricsTable left={left} right={right} />
      </div>

    </div>
  )
}
