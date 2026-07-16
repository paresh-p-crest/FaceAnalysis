'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ReportSectionHeading } from './ReportSectionHeading'
import {
  DetailCarousel,
  FeatureHeroFrame,
  MetricsColumn,
  SummaryLabelCard,
} from './FeatureSummaryUi'
import { cropFeatureBefore } from '../../utils/aestheticProjection'

function textOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function parsingValue(featureParsing, key) {
  if (featureParsing?.status !== 'ready') return null
  const m = featureParsing?.metrics?.eyebrows?.[key]
  if (!m || m.value == null || Number.isNaN(Number(m.value))) return null
  return Number(m.value)
}

function avg(a, b) {
  if (a == null && b == null) return null
  if (a == null) return b
  if (b == null) return a
  return (a + b) / 2
}

function formatMm(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)} mm`
}

function formatRatio(n) {
  if (n == null || !Number.isFinite(n)) return null
  return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function formatDeg(n) {
  if (n == null || !Number.isFinite(n)) return null
  return `${n.toFixed(2)}°`
}

function buildDetailSlides(m, fp, t) {
  const rPeak = parsingValue(fp, 'right_brow_peak_height_mm')
  const lPeak = parsingValue(fp, 'left_brow_peak_height_mm')
  const avgPeak = avg(rPeak, lPeak)
  const cvPeak = m.peakHeight != null ? parseFloat(m.peakHeight) : null
  const peakValue = avgPeak ?? (Number.isFinite(cvPeak) ? cvPeak : null)
  const peakMin = m.peakMin != null ? parseFloat(m.peakMin) : null
  const peakMax = m.peakMax != null ? parseFloat(m.peakMax) : null

  const rElev = parsingValue(fp, 'right_brow_elevation_ratio')
  const lElev = parsingValue(fp, 'left_brow_elevation_ratio')
  const avgElev = avg(rElev, lElev)

  const rApex = parsingValue(fp, 'right_brow_apex_angle_deg')
  const lApex = parsingValue(fp, 'left_brow_apex_angle_deg')
  const avgApex = avg(rApex, lApex)

  const landmark = fp?.status === 'ready' ? t('common.landmarkBased') : null
  const slides = []

  if (peakValue != null) {
    slides.push({
      id: 'peak',
      titleLead: t('brow.slides.peak.titleLead'),
      titleAccent: t('brow.slides.peak.titleAccent'),
      body: t('brow.slides.peak.body'),
      meter: {
        metricLabel: t('brow.slides.peak.metricLabel'),
        sourceLabel: landmark,
        valueText: formatMm(peakValue),
        valueNum: peakValue,
        rangeMin: Number.isFinite(peakMin) ? peakMin : null,
        rangeMax: Number.isFinite(peakMax) ? peakMax : null,
        rangeMinLabel: Number.isFinite(peakMin) ? formatMm(peakMin) : undefined,
        rangeMaxLabel: Number.isFinite(peakMax) ? formatMm(peakMax) : undefined,
      },
    })
  }

  if (avgElev != null) {
    slides.push({
      id: 'elevation',
      titleLead: t('brow.slides.elevation.titleLead'),
      titleAccent: t('brow.slides.elevation.titleAccent'),
      body: t('brow.slides.elevation.body'),
      meter: {
        metricLabel: t('brow.slides.elevation.metricLabel'),
        sourceLabel: landmark,
        valueText: formatRatio(avgElev),
        valueNum: avgElev,
        rangeMin: null,
        rangeMax: null,
      },
    })
  }

  if (avgApex != null) {
    slides.push({
      id: 'apex',
      titleLead: t('brow.slides.apex.titleLead'),
      titleAccent: t('brow.slides.apex.titleAccent'),
      body: t('brow.slides.apex.body'),
      meter: {
        metricLabel: t('brow.slides.apex.metricLabel'),
        sourceLabel: landmark,
        valueText: formatDeg(avgApex),
        valueNum: avgApex,
        rangeMin: null,
        rangeMax: null,
      },
    })
  }

  return slides
}

function buildAllMetricsRows(m, fp, t) {
  const rPeak = parsingValue(fp, 'right_brow_peak_height_mm')
  const lPeak = parsingValue(fp, 'left_brow_peak_height_mm')
  const rElev = parsingValue(fp, 'right_brow_elevation_ratio')
  const lElev = parsingValue(fp, 'left_brow_elevation_ratio')
  const rApex = parsingValue(fp, 'right_brow_apex_angle_deg')
  const lApex = parsingValue(fp, 'left_brow_apex_angle_deg')
  const avgPeak = avg(rPeak, lPeak)
  const avgElev = avg(rElev, lElev)
  const avgApex = avg(rApex, lApex)
  const cvPeak = m.peakHeight != null ? parseFloat(m.peakHeight) : null

  const left = [
    { label: t('brow.metrics.rightPeakHeight'), value: formatMm(rPeak) },
    { label: t('brow.metrics.rightElevation'), value: formatRatio(rElev) },
    { label: t('brow.metrics.rightApex'), value: formatDeg(rApex) },
    { label: t('brow.metrics.avgPeakHeight'), value: formatMm(avgPeak ?? cvPeak) },
    { label: t('brow.metrics.avgApex'), value: formatDeg(avgApex) },
    { label: t('brow.metrics.tiltClass'), value: textOrNull(m.tilt) },
    { label: t('brow.metrics.virilityClass'), value: textOrNull(m.virility) },
  ]

  const right = [
    { label: t('brow.metrics.leftPeakHeight'), value: formatMm(lPeak) },
    { label: t('brow.metrics.leftElevation'), value: formatRatio(lElev) },
    { label: t('brow.metrics.leftApex'), value: formatDeg(lApex) },
    { label: t('brow.metrics.avgElevation'), value: formatRatio(avgElev) },
    { label: t('brow.metrics.positionClass'), value: textOrNull(m.position) },
    { label: t('brow.metrics.shapeClass'), value: textOrNull(m.shape) },
  ]

  return { left, right }
}

export function BrowReportPanel({
  eyebrows,
  featureParsing = null,
  narrative: _narrative = null,
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
        const src = await cropFeatureBefore(photo, landmarks, 'periorbital', 1.20)
        if (!cancelled) setPeriHero(src || null)
      } catch {
        if (!cancelled) setPeriHero(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [photo, landmarks])

  if (!eyebrows?.metrics) return null

  const m = eyebrows.metrics
  const heroImage = periHero
  const slides = buildDetailSlides(m, featureParsing, t)
  const { left, right } = buildAllMetricsRows(m, featureParsing, t)

  return (
    <div className="space-y-8">
      <ReportSectionHeading
        title={t('common.summaryOfYour')}
        accent={t('nav.eyebrows').toLowerCase()}
        subtitle={t('brow.subtitle')}
      />

      {heroImage && (
        <FeatureHeroFrame>
          <img
            src={heroImage}
            alt={t('brow.heroAlt')}
            className="max-h-48 w-auto object-contain rounded-xl"
          />
        </FeatureHeroFrame>
      )}

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('brow.summaryTitle')}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="grid grid-cols-2 gap-3">
            <SummaryLabelCard label={t('brow.position')} value={textOrNull(m.position)} />
            <SummaryLabelCard label={t('brow.tilt')} value={textOrNull(m.tilt)} />
            <SummaryLabelCard label={t('brow.virility')} value={textOrNull(m.virility)} />
            <SummaryLabelCard label={t('brow.shape')} value={textOrNull(m.shape)} />
          </div>
          <DetailCarousel slides={slides} />
        </div>
      </div>

      <div>
        <p className="font-display text-base font-bold text-ink mb-3">{t('brow.allMetrics')}</p>
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
