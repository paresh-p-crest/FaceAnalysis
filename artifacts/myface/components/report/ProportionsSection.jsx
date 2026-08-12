'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FaceImageFrame, ProportionFeatureOverlay, ProportionsOverlay } from './FaceImageFrame'
import { ReportSectionHeading } from './ReportSectionHeading'
import { AssessmentGridLayout } from './FeatureAnalysisPage'
import { pickLocalizedCvText, useCvLabel, translateRatioCompareLabel } from '../../utils/cvReportLocale'
import {
  bboxFullFace,
  proportionRatioOverlays,
  proportionLinesInImage,
  mouthCheilions,
  noseAlae,
} from '../../utils/faceCrop'
import { cropNormalized } from '../../utils/eyeAnalysis'
import { mediaUrl } from '../../utils/apiClient'
import {
  buildNasoAuralDrawSpec,
  guidesCrownPlausible,
  normPoint01,
  resolveNoseLevelGuidesForDraw,
  toImagePct,
} from './nasoAuralOverlay'

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
const BAR_FILL = 'bg-[#3d5068]'
const BAR_TRACK = 'bg-[#d8dee6]'

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
    <div className="report-view-metric-card">
      <p className="report-view-mono-label mb-4">{t('proportions.facialThirds')}</p>
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

/** One vertical track; fill height = relative feature size (max of pair = 100%). */
function FeatureHeightBar({ fillPct, muted = false }) {
  const pct = Math.max(0, Math.min(100, Number(fillPct) || 0))
  return (
    <div
      className={`relative w-5 rounded-sm overflow-hidden border border-slate-300/40 ${BAR_TRACK}`}
      style={{ height: BAR_HEIGHT }}
      aria-hidden
    >
      <div
        className={`absolute bottom-0 left-0 right-0 ${BAR_FILL}${muted ? ' opacity-55' : ''}`}
        style={{ height: `${pct}%` }}
      />
    </div>
  )
}

/**
 * Two side-by-side vertical bars (primary vs secondary), e.g. Ear | Nose.
 * yourValue is primary/secondary (secondary normalized to 1.00).
 */
function RatioBar({ yourValue, idealValue, label1, label2, primaryFeature, secondaryFeature, t }) {
  const primary = Math.max(0, Number(yourValue) || 0)
  const secondary = 1
  const maxRel = Math.max(primary, secondary, 1e-6)
  const primaryPct = (primary / maxRel) * 100
  const secondaryPct = (secondary / maxRel) * 100

  return (
    <div className="w-full max-w-md mx-auto lg:mx-0">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-end">
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">{t('proportions.yourProportion')}</p>
          <p className="text-sm font-semibold text-ink font-sans min-h-[40px] flex items-center justify-center">{label1}</p>
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1 mt-4">{t('common.value')}</p>
          <p className="text-base font-display font-bold text-ink tabular-nums">{primary.toFixed(2)} : 1.00</p>
        </div>

        <div className="flex flex-col items-center gap-3 px-2 pb-6">
          <div className="flex items-end justify-center gap-5">
            <FeatureHeightBar fillPct={primaryPct} />
            <FeatureHeightBar fillPct={secondaryPct} muted />
          </div>
          <div className="flex items-center gap-3 text-[10px] text-ink-muted font-sans">
            <span className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${BAR_FILL} inline-block`} />
              {primaryFeature}
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-sm ${BAR_FILL} inline-block opacity-55`} />
              {secondaryFeature}
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1.5 font-semibold">{t('proportions.idealProportion')}</p>
          <p className="text-sm font-semibold text-ink font-sans min-h-[40px] flex items-center justify-center">{label2}</p>
          <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1 mt-4">{t('common.value')}</p>
          <p className="text-base font-display font-bold text-ink tabular-nums">{Number(idealValue || 1).toFixed(2)} : 1.00</p>
        </div>
      </div>
    </div>
  )
}

function resolveOverlay(tabId, active, liveOverlays, useProfileEar, nasoOverlay) {
  if (tabId === 'nasoAural' && useProfileEar) {
    return nasoOverlay || null
  }
  if (liveOverlays?.[tabId]) return liveOverlays[tabId]
  return active?.overlay || null
}

/** Ready ear-landmarker side for the active profile pose (previous CV runs have none). */
function pickReadyEarSide(ears, poseHint) {
  if (ears?.earLandmarkSource !== 'ear_landmarker') return null
  const sides = ears?.sides || {}
  const ordered = []
  if (poseHint === 'leftProfile' && sides.left) ordered.push(sides.left)
  if (poseHint === 'rightProfile' && sides.right) ordered.push(sides.right)
  if (sides.right) ordered.push(sides.right)
  if (sides.left) ordered.push(sides.left)
  return ordered.find((s) => s?.status === 'ready' && Array.isArray(s.landmarks) && s.landmarks.length >= 20) || null
}

function extractEarSpan01FromOverlay(overlay) {
  const b = (overlay?.brackets || []).find((br) => br?.id === 'earVertical')
  if (!b) return null
  const y1 = toImagePct(b.y1)
  const y2 = toImagePct(b.y2)
  if (y1 == null || y2 == null || Math.abs(y2 - y1) < 0.5) return null
  return Math.abs(y2 - y1) / 100
}

function extractNoseSpan01(active) {
  const gg = normPoint01(active?.guideGlabella)
  const gnb = normPoint01(active?.guideNoseBottom)
  if (gg && gnb && guidesCrownPlausible(gg, gnb)) {
    return {
      top: gg,
      bottom: gnb,
      heightNorm: Math.abs(gnb.y - gg.y),
    }
  }

  const nt = active?.noseTop
  const nb = active?.noseBottom
  if (nt && nb) {
    const y1 = toImagePct(nt.y)
    const y2 = toImagePct(nb.y)
    const x1 = toImagePct(nt.x)
    const x2 = toImagePct(nb.x)
    if (
      y1 != null && y2 != null && x1 != null && x2 != null &&
      Math.abs(y2 - y1) >= 0.5
    ) {
      return {
        top: { x: Math.min(x1, x2) / 100, y: Math.min(y1, y2) / 100 },
        bottom: { x: Math.max(x1, x2) / 100, y: Math.max(y1, y2) / 100 },
        heightNorm: Math.abs(y2 - y1) / 100,
      }
    }
  }
  const ov = active?.overlay
  if (!ov) return null
  for (const b of ov.brackets || []) {
    if (b?.id === 'noseVertical' || b?.id === 'noseRangeOnEar') {
      const y1 = toImagePct(b.y1)
      const y2 = toImagePct(b.y2)
      if (y1 == null || y2 == null || Math.abs(y2 - y1) < 0.5) continue
      // Length only — direction is rebuilt by buildNasoAuralDrawSpec.
      return { heightNorm: Math.abs(y2 - y1) / 100 }
    }
  }
  const segs = ov.segments || []
  if (segs.length >= 2) {
    const s = segs[1]
    const y1 = toImagePct(s.y1)
    const y2 = toImagePct(s.y2)
    if (y1 == null || y2 == null || Math.abs(y2 - y1) < 0.5) return null
    return { heightNorm: Math.abs(y2 - y1) / 100 }
  }
  if (Number.isFinite(Number(active?.noseHeightNorm))) {
    return { heightNorm: Number(active.noseHeightNorm) }
  }
  return null
}

function buildQovesNasoOverlay(side, active) {
  const m = side.measurements || {}
  const ht = m.helixTop
  const sb = m.softBottom || m.lobeBottom
  if (!ht || !sb) return null

  const facingRight = (active?.photoSource || side.poseId || 'rightProfile') !== 'leftProfile'

  const spec = buildNasoAuralDrawSpec({
    helixTop: ht,
    softBottom: sb,
    xMinNorm: m.xMinNorm,
    xMaxNorm: m.xMaxNorm,
    verticalBracketXNorm: m.verticalBracketXNorm,
    facingRight,
  })
  if (!spec) return null

  // Sidecar guide* only — never fall back to cephalometric glabella/noseBottom
  // (those often sit at the hairline and were redrawing wrong dashed Ys).
  const guides = resolveNoseLevelGuidesForDraw({
    guideGlabella: active?.guideGlabella,
    guideNoseBottom: active?.guideNoseBottom,
    storedGuides: active?.overlay?.guides,
    verticalXPct: spec.brackets?.[0]?.x1,
  })
  if (!guides.length) return { ...spec, facingRight }

  return {
    ...spec,
    guides,
    nasoLayout: 'earPlusNoseGuides-v6',
    facingRight,
  }
}

/** Prefer ear-landmarker metrics; return null when model/side missing (legacy assessments). */
function resolveNasoAuralDisplay(active, ears, t) {
  const side = pickReadyEarSide(ears, active?.photoSource)
  if (!side) return null

  const overlay = buildQovesNasoOverlay(side, active)
  if (!overlay?.brackets?.some((b) => b.id === 'earVertical')) return null

  const earH = extractEarSpan01FromOverlay(overlay)
    ?? Number(side.measurements?.verticalHeightNorm ?? active?.earHeightNorm)
  const nose = extractNoseSpan01(active)
  const noseH = nose?.heightNorm ?? Number(active?.noseHeightNorm)
  let yourValue = Number(active?.yourValue)
  if (Number.isFinite(earH) && earH > 1e-6 && Number.isFinite(noseH) && noseH > 1e-6) {
    const nh = noseH > 1.5 ? noseH / 100 : noseH
    const eh = earH > 1.5 ? earH / 100 : earH
    if (nh > 1e-6) yourValue = Math.round((eh / nh) * 100) / 100
  }
  if (!(Number.isFinite(yourValue) && yourValue > 0)) return null

  let yourLabelKey = 'proportions.ratioCompare.earApproxNose'
  if (yourValue > 1.05) yourLabelKey = 'proportions.ratioCompare.earGreaterNose'
  else if (yourValue < 0.95) yourLabelKey = 'proportions.ratioCompare.earLessNose'

  return {
    yourValue,
    yourLabel: t(yourLabelKey),
    overlay,
    ready: true,
  }
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
  featureParsing = null,
  ears = null,
}) {
  const t = useTranslations('Report')
  const locale = useLocale()
  const cvLabel = useCvLabel()
  const ratioTabs = RATIO_TABS.filter((tab) => proportions?.ratios?.[tab.id])
  const [activeTab, setActiveTab] = useState(ratioTabs[0]?.id || 'nasoAural')

  const frontSrc = photos?.front || photo || null
  const [faceCropSrc, setFaceCropSrc] = useState(null)

  // Face-crop plate for frontal ratio tabs — must pair with crop-space overlays or spans look short.
  useEffect(() => {
    let cancelled = false
    async function run() {
      const src = frontSrc || (typeof proportions?.imageSrc === 'string' ? mediaUrl(proportions.imageSrc) : null)
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

  const parsingLines = featureParsing?.metrics?.facialThirds || null

  const liveThirdLines = useMemo(() => {
    if (!landmarks?.length && !parsingLines) return null
    try {
      return proportionLinesInImage(landmarks, parsingLines)
    } catch {
      return null
    }
  }, [landmarks, parsingLines])

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

  if (!proportions) return null

  const ratios = proportions?.ratios || {}
  const active = ratios[activeTab]
  const useProfileEar =
    activeTab === 'nasoAural' && (
      (active?.photoSource && active.photoSource !== 'front') ||
      Boolean(photos?.rightProfile || photos?.leftProfile) ||
      (typeof active?.imageSrc === 'string' && /profile/i.test(active.imageSrc))
    )
  const activeImageSrc = useProfileEar
    ? (active?.photoSource === 'leftProfile' ? photos?.leftProfile : (mediaUrl(active?.imageSrc) || photos?.rightProfile || photos?.leftProfile))
    : (faceCropSrc || mediaUrl(active?.imageSrc) || mediaUrl(proportions.imageSrc))
  const nasoLandmarker = activeTab === 'nasoAural' ? resolveNasoAuralDisplay(active, ears, t) : null
  const nasoReady = activeTab === 'nasoAural' ? Boolean(nasoLandmarker?.ready) : true

  const overlay = resolveOverlay(
    activeTab,
    active,
    useProfileEar ? null : liveOverlays,
    useProfileEar,
    nasoLandmarker?.overlay || null,
  )

  // Full front photo + image-% guides. Crop-relative lines on a front photo look "far apart".
  const overviewPhoto =
    photos?.front ||
    photo ||
    (typeof proportions.imageSrc === 'string' && proportions.overlaySpace === 'image'
      ? mediaUrl(proportions.imageSrc)
      : null) ||
    (typeof proportions.imageSrc === 'string' && /\/front(\.|$|\?)/.test(proportions.imageSrc)
      ? mediaUrl(proportions.imageSrc)
      : null) ||
    mediaUrl(proportions.imageSrc)

  const overviewLines =
    liveThirdLines ||
    (proportions.overlaySpace === 'image' ? proportions.proportionLines : null)

  const displayYourValue =
    activeTab === 'nasoAural'
      ? (nasoReady ? nasoLandmarker?.yourValue : null)
      : activeTab === 'nasoOral' && liveNasoOral
        ? liveNasoOral.yourValue
        : active?.yourValue
  const displayYourLabel =
    activeTab === 'nasoAural'
      ? (nasoReady
        ? (nasoLandmarker?.yourLabel
          || translateRatioCompareLabel(active?.yourLabel, t)
          || cvLabel(active?.yourLabel))
        : null)
      : activeTab === 'nasoOral' && liveNasoOral
        ? liveNasoOral.yourLabel
        : (translateRatioCompareLabel(active?.yourLabel, t) || cvLabel(active?.yourLabel))
  const displayIdealLabel =
    translateRatioCompareLabel(active?.idealLabel, t) || cvLabel(active?.idealLabel)

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
                <div className="report-view-metric-card text-center py-6">
                  <p className="report-view-mono-label mb-4">{t('proportions.proportionality')}</p>
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
                <div className="report-view-metric-card">
                  <p className="report-view-mono-label mb-2">{t('common.explanation')}</p>
                  <p className="text-sm text-ink-secondary leading-relaxed font-sans">
                    {pickLocalizedCvText(proportions, locale)}
                  </p>
                </div>
              )}
            </>
          }
        />
      )}

      {ratioTabs.length > 0 && (
        <>
          <ReportSectionHeading
            title={t('proportions.perFeatureTitle')}
            accent={t('proportions.perFeatureAccent')}
            subtitle={t('proportions.perFeatureSubtitle')}
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ratioTabs.map((tab) => (
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
                <p className="report-view-mono-label mb-2 font-medium leading-tight">
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
        </>
      )}

      {active && (
        <div className="rounded-2xl border border-surface-border bg-white dark:bg-surface-card p-6">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-3 font-medium">
            {t(`proportions.ratioTabs.${activeTab}.ratioLabel`)}
          </p>
          <p className="text-sm text-ink font-sans mb-5 leading-relaxed">
            {t(`proportions.ratioTabs.${activeTab}.expectation`)}
          </p>

          <div className="grid lg:grid-cols-2 gap-8 items-center">
            {activeImageSrc && (
              <FaceImageFrame
                key={`${activeTab}-${activeImageSrc}-${nasoLandmarker?.overlay?.nasoLayout || 'plain'}`}
                src={activeImageSrc}
                alt={t('proportions.facialProportionsAlt')}
                aspect="4/5"
                maxW="280px"
                fit="contain"
                alignOverlay
                overlay={overlay ? <ProportionFeatureOverlay overlay={overlay} /> : null}
              />
            )}

            {activeTab === 'nasoAural' && !nasoReady ? (
              <div className="rounded-xl border border-dashed border-surface-border bg-surface-warm/40 px-5 py-8 text-center">
                <p className="text-sm text-ink-secondary leading-relaxed font-sans">
                  {t('proportions.nasoAuralUnavailable')}
                </p>
              </div>
            ) : (
              <RatioBar
                yourValue={displayYourValue ?? 0}
                idealValue={active.idealValue}
                label1={displayYourLabel}
                label2={displayIdealLabel}
                primaryFeature={t(`proportions.ratioParts.${RATIO_PARTS[activeTab]?.primary}`)}
                secondaryFeature={t(`proportions.ratioParts.${RATIO_PARTS[activeTab]?.secondary}`)}
                t={t}
              />
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-surface-border">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted mb-2 font-medium">{t('common.explanation')}</p>
            <p className="text-sm text-ink-secondary leading-relaxed font-sans">
              {activeTab === 'nasoAural' && !nasoReady
                ? t('proportions.nasoAuralUnavailableDetail')
                : pickLocalizedCvText(active, locale)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
