'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FaceImageFrame, ProportionFeatureOverlay, ProportionsOverlay } from './FaceImageFrame'
import { ReportSectionHeading } from './ReportSectionHeading'
import { AssessmentGridLayout } from './FeatureAnalysisPage'
import {
  bboxFullFace,
  proportionRatioOverlays,
  proportionLinesInImage,
  mouthCheilions,
  noseAlae,
} from '../../utils/faceCrop'
import { cropNormalized } from '../../utils/eyeAnalysis'

const RATIO_PARTS = {
  nasoAural: { primary: 'ear', secondary: 'nose' },
  orbitoNasal: { primary: 'nose', secondary: 'eye' },
  nasoOral: { primary: 'mouth', secondary: 'nose' },
  orbital: { primary: 'spacing', secondary: 'eye' },
}

const RATIO_TABS = [
  { id: 'nasoAural' },
  { id: 'orbitoNasal' },
  { id: 'nasoOral' },
  { id: 'orbital' },
]

const BAR_HEIGHT = 148

function parseThird(value, fallback = 0.33) {
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

function proportionalityBadge(score, t) {
  if (score >= 80) return { label: t('common.high'), className: 'bg-emerald-500/90 text-white' }
  if (score >= 70) return { label: t('common.good'), className: 'bg-brand/80 text-white' }
  return { label: t('common.fair'), className: 'bg-ink-muted text-white' }
}

function FacialThirdsBar({ upper, middle, lower, t }) {
  const u = parseThird(upper, 0.33)
  const m = parseThird(middle, 0.34)
  const l = parseThird(lower, 0.33)
  const total = Math.max(u + m + l, 1e-6)
  const segments = [
    { key: 'c', label: t('proportions.lowerThird'), value: l, pct: (l / total) * 100, color: 'bg-[#4a5d73]' },
    { key: 'b', label: t('proportions.middleThird'), value: m, pct: (m / total) * 100, color: 'bg-[#8a9aab]' },
    { key: 'a', label: t('proportions.upperThird'), value: u, pct: (u / total) * 100, color: 'bg-[#c5ced8]' },
  ]

  return (
    <div className="qoves-report-metric-card">
      <p className="qoves-report-mono-label mb-4">{t('proportions.facialThirds')}</p>
      <div className="grid grid-cols-3 gap-1 mb-2">
        {segments.map((s) => (
          <p key={s.key} className="text-[9px] uppercase tracking-wider text-ink-muted text-center leading-tight">
            {s.label}
          </p>
        ))}
      </div>
      <div className="flex h-3.5 w-full overflow-hidden rounded-sm">
        {segments.map((s) => (
          <div
            key={s.key}
            className={`${s.color} h-full`}
            style={{ width: `${Math.max(s.pct, 2)}%` }}
            title={`${s.label}: ${s.value.toFixed(2)}`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2">
        {segments.map((s) => (
          <p key={s.key} className="text-sm font-medium text-ink text-center tabular-nums">
            {s.value.toFixed(2)}
          </p>
        ))}
      </div>
    </div>
  )
}

/** Ratio bar: bottom = first feature (value), top = second feature (1.00). E.g. 1:1 → 50/50 split */
function RatioStackBar({ value }) {
  const ratio = Math.max(0, value)
  const primaryPct = (ratio / (ratio + 1)) * 100
  const secondaryPct = 100 - primaryPct

  return (
    <div
      className="relative w-5 rounded-sm overflow-hidden border border-slate-300/50"
      style={{ height: BAR_HEIGHT }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-[#3d5068]"
        style={{ height: `${primaryPct}%` }}
      />
      <div
        className="absolute left-0 right-0 bg-[#b8c5d4]"
        style={{ bottom: `${primaryPct}%`, height: `${secondaryPct}%` }}
      />
    </div>
  )
}

function RatioBar({ yourValue, idealValue, label1, label2, primaryFeature, secondaryFeature, t }) {
  return (
    <div className="w-full max-w-md mx-auto lg:mx-0">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">{t('proportions.yourProportion')}</p>
          <p className="text-sm font-semibold text-ink font-sans min-h-[40px] flex items-center justify-center">{label1}</p>
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1 mt-4">{t('common.value')}</p>
          <p className="text-base font-display font-bold text-ink">{yourValue.toFixed(2)} : 1.00</p>
        </div>

        <div className="flex flex-col items-center gap-3 px-2 pb-6">
          <div className="flex items-end justify-center gap-5">
            <RatioStackBar value={yourValue} />
            <RatioStackBar value={idealValue} />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-ink-muted font-sans">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#3d5068] inline-block" />
              {primaryFeature}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#b8c5d4] inline-block" />
              {secondaryFeature}
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">{t('proportions.idealProportion')}</p>
          <p className="text-sm font-semibold text-ink font-sans min-h-[40px] flex items-center justify-center">{label2}</p>
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1 mt-4">{t('common.value')}</p>
          <p className="text-base font-display font-bold text-ink">{idealValue.toFixed(2)} : 1.00</p>
        </div>
      </div>
    </div>
  )
}

function resolveOverlay(tabId, active, liveOverlays) {
  // Naso-aural: no overlay for now (profile mapping deferred).
  if (tabId === 'nasoAural') return null
  if (liveOverlays?.[tabId]) return liveOverlays[tabId]
  return active?.overlay || null
}

function nasoOralLabel(ratio, t) {
  if (ratio > 1.05) return t('proportions.nasoOralLabels.mouthGreater')
  if (ratio < 0.95) return t('proportions.nasoOralLabels.mouthLess')
  return t('proportions.nasoOralLabels.mouthEqual')
}

export function ProportionsSection({
  proportions,
  landmarks = null,
  photo = null,
  photos = null,
}) {
  const t = useTranslations('Report')
  const [activeTab, setActiveTab] = useState('nasoAural')

  const frontSrc = photos?.front || photo || null
  const [faceCropSrc, setFaceCropSrc] = useState(null)

  // Face-crop plate for frontal ratio tabs — must pair with crop-space overlays or spans look short.
  useEffect(() => {
    let cancelled = false
    async function run() {
      const src = frontSrc || (typeof proportions?.imageSrc === 'string' ? proportions.imageSrc : null)
      if (!src || !landmarks?.length) {
        if (!cancelled) setFaceCropSrc(null)
        return
      }
      try {
        const box = proportions?.faceBox || bboxFullFace(landmarks, 0.08)
        const cropped = await cropNormalized(src, box)
        if (!cancelled) setFaceCropSrc(cropped || null)
      } catch {
        if (!cancelled) setFaceCropSrc(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [frontSrc, landmarks, proportions?.faceBox, proportions?.imageSrc])

  const liveOverlays = useMemo(() => {
    if (!landmarks?.length) return null
    try {
      const faceBox = proportions?.faceBox || bboxFullFace(landmarks, 0.08)
      // Frontal feature tabs always use crop-space (matched to faceCropSrc).
      return proportionRatioOverlays(landmarks, faceBox)
    } catch {
      return null
    }
  }, [landmarks, proportions?.faceBox])

  const liveThirdLines = useMemo(() => {
    if (!landmarks?.length) return null
    try {
      return proportionLinesInImage(landmarks)
    } catch {
      return null
    }
  }, [landmarks])

  const liveNasoOral = useMemo(() => {
    if (!landmarks?.length) return null
    try {
      const [alL, alR] = noseAlae(landmarks)
      const [chL, chR] = mouthCheilions(landmarks)
      const noseW = Math.abs(alR.x - alL.x)
      const mouthW = Math.abs(chR.x - chL.x)
      if (noseW < 1e-6) return null
      const yourValue = mouthW / noseW
      return { yourValue, yourLabel: nasoOralLabel(yourValue, t) }
    } catch {
      return null
    }
  }, [landmarks, t])

  if (!proportions?.ratios) return null

  const ratios = proportions.ratios
  const active = ratios[activeTab]
  const useProfileEar =
    activeTab === 'nasoAural' && (
      (active?.photoSource && active.photoSource !== 'front') ||
      Boolean(photos?.rightProfile || photos?.leftProfile) ||
      (typeof active?.imageSrc === 'string' && /profile/i.test(active.imageSrc))
    )
  const activeImageSrc = useProfileEar
    ? (active?.imageSrc || photos?.rightProfile || photos?.leftProfile)
    : (faceCropSrc || active?.imageSrc || proportions.imageSrc)
  const overlay = resolveOverlay(
    activeTab,
    active,
    useProfileEar ? null : liveOverlays,
  )

  // Full front photo + image-% guides. Crop-relative lines on a front photo look "far apart".
  const overviewPhoto =
    photos?.front ||
    photo ||
    (typeof proportions.imageSrc === 'string' && proportions.overlaySpace === 'image'
      ? proportions.imageSrc
      : null) ||
    (typeof proportions.imageSrc === 'string' && /\/front(\.|$|\?)/.test(proportions.imageSrc)
      ? proportions.imageSrc
      : null) ||
    proportions.imageSrc

  const overviewLines =
    liveThirdLines ||
    (proportions.overlaySpace === 'image' ? proportions.proportionLines : null)

  const displayYourValue =
    activeTab === 'nasoOral' && liveNasoOral ? liveNasoOral.yourValue : active?.yourValue
  const displayYourLabel =
    activeTab === 'nasoOral' && liveNasoOral ? liveNasoOral.yourLabel : active?.yourLabel

  const score = proportions.score
  const badge = score != null ? proportionalityBadge(score, t) : null

  return (
    <div className="pr-2 space-y-6">
      <ReportSectionHeading
        title={t('proportions.title')}
        accent={t('proportions.accent')}
        subtitle={t('proportions.subtitle')}
      />

      {(overviewPhoto || score != null || proportions.explanation) && (
        <AssessmentGridLayout
          photo={overviewPhoto}
          photoFit="contain"
          photoOverlay={
            overviewLines ? (
              <ProportionsOverlay lines={overviewLines} />
            ) : null
          }
          rightCards={
            <>
              {score != null && (
                <div className="qoves-report-metric-card text-center py-6">
                  <p className="qoves-report-mono-label mb-4">{t('proportions.proportionality')}</p>
                  <p className="text-5xl font-display font-bold text-ink tabular-nums leading-none">{score}</p>
                  <div className="flex justify-between items-center border-t border-surface-border pt-3 mt-5">
                    {badge ? (
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm text-ink-muted">/100</span>
                  </div>
                </div>
              )}
              <FacialThirdsBar
                upper={proportions.upperThird}
                middle={proportions.middleThird}
                lower={proportions.lowerThird}
                t={t}
              />
              {proportions.explanation && (
                <div className="qoves-report-metric-card">
                  <p className="qoves-report-mono-label mb-2">{t('common.explanation')}</p>
                  <p className="text-sm text-ink-secondary leading-relaxed font-sans">{proportions.explanation}</p>
                </div>
              )}
            </>
          }
        />
      )}

      <ReportSectionHeading
        title={t('proportions.perFeatureTitle')}
        accent={t('proportions.perFeatureAccent')}
        subtitle={t('proportions.perFeatureSubtitle')}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {RATIO_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              activeTab === tab.id
                ? 'border-brand bg-brand-50 dark:bg-brand/10 shadow-sm'
                : 'border-surface-border bg-white dark:bg-surface-card hover:border-brand/30'
            }`}
          >
            <p className="qoves-report-mono-label mb-2 font-medium leading-tight">
              {t(`proportions.ratioTabs.${tab.id}.ratioLabel`)}
            </p>
            <p className={`text-base font-display font-semibold ${
              activeTab === tab.id ? 'text-brand' : 'text-ink'
            }`}>
              {t(`proportions.ratioTabs.${tab.id}.label`)}
            </p>
          </button>
        ))}
      </div>

      {active && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-3 font-medium">
            {active.ratioLabel}
          </p>
          <p className="text-sm text-ink font-sans mb-5 leading-relaxed">
            {active.expectation}
          </p>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {activeImageSrc && (
              <FaceImageFrame
                key={`${activeTab}-${activeImageSrc}`}
                src={activeImageSrc}
                alt={t('proportions.facialProportionsAlt')}
                aspect="4/5"
                maxW="280px"
                fit="contain"
                alignOverlay
                overlay={overlay ? <ProportionFeatureOverlay overlay={overlay} /> : null}
              />
            )}

            <RatioBar
              yourValue={displayYourValue}
              idealValue={active.idealValue}
              label1={displayYourLabel}
              label2={active.idealLabel}
              primaryFeature={t(`proportions.ratioParts.${RATIO_PARTS[activeTab]?.primary}`)}
              secondaryFeature={t(`proportions.ratioParts.${RATIO_PARTS[activeTab]?.secondary}`)}
              t={t}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">{t('common.explanation')}</p>
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">{active.explanation}</p>
          </div>
        </div>
      )}
    </div>
  )
}
