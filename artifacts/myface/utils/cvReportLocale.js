'use client'

import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { translateCvLabel, CV_LABEL } from './cvReport'

const CV_LABEL_VALUES = new Set(Object.values(CV_LABEL))

/** Symmetry region id → CvReport.labels key */
export const SYMMETRY_REGION_LABEL_KEY = {
  eyes: 'regionEyes',
  brows: 'regionBrows',
  mouth: 'regionMouth',
  jaw: 'regionJaw',
}

/** English display strings / aliases → CvReport.labels keys */
const ENGLISH_TO_KEY = {
  Narrow: 'narrow',
  Wide: 'wide',
  Average: 'average',
  Moderate: 'moderate',
  Balanced: 'balanced',
  Soft: 'soft',
  Defined: 'defined',
  Long: 'long',
  Short: 'short',
  Normal: 'normal',
  Oval: 'oval',
  Square: 'square',
  Round: 'round',
  Heart: 'heart',
  Oblong: 'oblong',
  Full: 'full',
  Thin: 'thin',
  Thick: 'thick',
  Low: 'low',
  High: 'high',
  Lean: 'lean',
  Harmonious: 'harmonious',
  Distinctive: 'distinctive',
  'Above Average': 'aboveAverage',
  'Below Average': 'belowAverage',
  'Highly Typical': 'highlyTypical',
  'Moderately Typical': 'moderatelyTypical',
  'Slightly Atypical': 'slightlyAtypical',
  'Highly Average': 'highlyAverage',
  'Very Masculine': 'veryMasculine',
  Masculine: 'masculine',
  'Very Feminine': 'veryFeminine',
  Feminine: 'feminine',
  'Hyper Feminine': 'hyperFeminine',
  'Hyper Masculine': 'hyperMasculine',
  'Highly Symmetric': 'highlySymmetric',
  'Quite Symmetric': 'quiteSymmetric',
  'Noticeable asymmetry': 'noticeableAsymmetry',
  Asymmetric: 'asymmetric',
  Symmetric: 'symmetric',
  'Well balanced': 'wellBalanced',
  'Good balance': 'goodBalance',
  'Narrow / Leptorrhine': 'narrowLeptorrhine',
  'Wide / Platyrrhine': 'widePlatyrrhine',
  'Average / Mesorrhine': 'averageMesorrhine',
  'Wide / Bulbous': 'wideBulbous',
  'Narrow / Refined': 'narrowRefined',
  'Thin / Narrow': 'thinNarrow',
  'Full / Plush': 'fullPlush',
  'Moderate Arch': 'moderateArch',
  'Soft / Rounded': 'softRounded',
  'Moderate / Defined': 'moderateDefined',
  'Angular / Defined': 'angularDefined',
  'Sharp V / U': 'sharpVU',
  'Soft Taper': 'softTaper',
  'Full coverage': 'fullCoverage',
  Prominent: 'prominent',
  Small: 'small',
  Protruding: 'protruding',
  'Close-set': 'closeSet',
  'Mid-set': 'midSet',
  'High-set': 'highSet',
  High: 'high',
  Neutral: 'neutral',
  Recessed: 'recessed',
  protruded: 'protruding',
  'Needs attention': 'needsAttention',
  'Need Attention': 'needsAttention',
  'Good condition': 'goodCondition',
  Clear: 'clear',
  Deviated: 'deviated',
  Pointed: 'pointed',
  Shallow: 'shallow',
  Deep: 'deep',
  'Peaked / Defined': 'peakedDefined',
  'Flat / Subtle': 'flatSubtle',
  'Full / Wide': 'fullWide',
  Angular: 'angular',
  'Angular / Defined': 'angularDefined',
  Eyes: 'regionEyes',
  Brows: 'regionBrows',
  Mouth: 'regionMouth',
  Jaw: 'regionJaw',
  'Ear > Nose': 'earGreaterNose',
  'Ear < Nose': 'earLessNose',
  'Ear ≈ Nose': 'earApproxNose',
  'Ear = Nose': 'earEqualNose',
  'Nose > Eye': 'noseGreaterEye',
  'Nose < Eye': 'noseLessEye',
  'Nose ≈ Eye': 'noseApproxEye',
  'Nose = Eye': 'idealNoseEye',
  'Mouth > Nose': 'mouthGreaterNose',
  'Mouth < Nose': 'mouthLessNose',
  'Mouth ≈ Nose': 'mouthApproxNose',
  'Spacing > Eye': 'spacingGreaterEye',
  'Spacing < Eye': 'spacingLessEye',
  'Spacing = Eye': 'spacingEqualEye',
  'Positive (upturned)': 'positiveUpturned',
  'Negative (downturned)': 'negativeDownturned',
  'Natural White': 'naturalWhite',
  'Slightly dull': 'slightlyDull',
  'Yellow-tinged': 'yellowTinged',
  Good: 'good',
  Shadowed: 'shadowed',
  Upturned: 'upturned',
  Downturned: 'downturned',
  Arched: 'arched',
  Straight: 'straight',
  'Soft arch': 'softArch',
  'Mid set': 'midSetSpaced',
  'High set': 'highSetSpaced',
  'Low set': 'lowSetSpaced',
  Uneven: 'uneven',
  'Slightly Uneven': 'slightlyUneven',
  Even: 'even',
  'Slightly Textured': 'slightlyTextured',
  Smooth: 'smooth',
  'Textured/Rough': 'texturedRough',
  Warm: 'warm',
  Cool: 'cool',
  'Neutral-Warm': 'neutralWarm',
  'Neutral-Cool': 'neutralCool',
  Mild: 'mild',
  Severe: 'severe',
  'Oily/Shiny': 'oilyShiny',
  'Normal/Combination': 'normalCombination',
  'Matte / Dry': 'matteDry',
  'Dark circles detected': 'darkCirclesDetected',
  'Not Prominent': 'notProminent',
  'Dark circles present': 'darkCirclesPresent',
  'Strongly Upturned': 'stronglyUpturned',
  'Mildly Upturned': 'mildlyUpturned',
  Slender: 'slender',
  'Mildly asymmetric': 'mildlyAsymmetric',
  Protruding: 'protruding',
}

export function toCvLabelKey(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (!s.length || s.toUpperCase() === 'N/A') return s
  return resolveCvLabelKey(s) ?? s
}

export function resolveCvLabelKey(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (ENGLISH_TO_KEY[s]) return ENGLISH_TO_KEY[s]
  const lower = s.toLowerCase()
  for (const [en, key] of Object.entries(ENGLISH_TO_KEY)) {
    if (en.toLowerCase() === lower) return key
  }
  if (CV_LABEL_VALUES.has(s)) return s
  if (s in CV_LABEL) return s
  return null
}

/** Mini-card metric row titles (English source → i18n key under Report.executiveSummary.miniCardMetrics). */
const MINI_CARD_METRIC_TO_KEY = {
  'Width–length': 'widthLength',
  'Width-length': 'widthLength',
  'Width': 'width',
  'Length': 'length',
  'Definition': 'definition',
  'Projection': 'projection',
  'Shape': 'shape',
  'Fullness': 'fullness',
  'Prominence': 'prominence',
  'Symmetry': 'symmetry',
  'Texture': 'texture',
  'Color': 'color',
  'Hairline': 'hairline',
  'Density': 'density',
  'Recession': 'recession',
  'Canthal tilt': 'canthalTilt',
  'Spacing': 'spacing',
  'Under-eye': 'underEye',
  'Tip': 'tip',
  'Hollowing': 'hollowing',
  'Ratio': 'ratio',
  'Cupid bow': 'cupidBow',
  'Profile': 'profile',
  'Laxity': 'laxity',
  'Contour': 'contour',
  'Blemishing': 'blemishing',
  'Evenness': 'evenness',
  'Skin': 'skin',
  'Ideal ratio': 'idealRatio',
}

function normalizeMetricTitle(title) {
  return String(title || '').replace(/\u2013/g, '-').trim()
}

export function formatLocaleDecimal(value, locale) {
  const s = String(value ?? '').trim()
  if (/^-?\d+\.\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) {
      return n.toLocaleString(locale === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 10 })
    }
  }
  return s
}

export function localizeMiniCardMetricTitle(title, tReport) {
  const norm = normalizeMetricTitle(title)
  const key = MINI_CARD_METRIC_TO_KEY[norm]
  if (key && tReport?.has?.(`executiveSummary.miniCardMetrics.${key}`)) {
    return tReport(`executiveSummary.miniCardMetrics.${key}`)
  }
  return title
}

export function localizeMiniCardDetail(detail, tCv, locale) {
  if (detail == null || detail === '') return detail
  const s = String(detail)
  if (s.includes(' · ')) {
    return s.split(' · ').map((part) => localizeMiniCardDetail(part.trim(), tCv, locale)).join(' · ')
  }
  const counted = s.match(/^(.+?)\s*\((\d+)\)\s*$/)
  if (counted) {
    return `${translateClassification(counted[1], tCv)} (${counted[2]})`
  }
  const localized = formatLocaleDecimal(s, locale)
  if (localized !== s) return localized
  return translateClassification(s, tCv)
}

export function localizeFeatureRowText(text, tReport, tCv, locale) {
  if (text == null || text === '') return null
  const s = String(text).trim()
  if (!s || s === '—') return null
  const ratio = s.match(/^Ratio\s+(.+)$/i)
  if (ratio) {
    const value = formatLocaleDecimal(ratio[1], locale)
    if (tReport?.has?.('executiveSummary.ratioValue')) {
      return tReport('executiveSummary.ratioValue', { value })
    }
    return `Ratio ${value}`
  }
  return localizeMiniCardDetail(s, tCv, locale)
}

export function localizeFeatureRow(row, { tReport, tCv, locale = 'en' }) {
  if (!row) return row
  const finding = localizeFeatureRowText(row.finding, tReport, tCv, locale)
  let ref = localizeFeatureRowText(row.ref, tReport, tCv, locale)
  if (!ref && row.zoneKey && tReport?.has?.(`executiveSummary.featureRows.${row.zoneKey}.ref`)) {
    ref = tReport(`executiveSummary.featureRows.${row.zoneKey}.ref`)
  }
  return { ...row, finding, ref }
}

export function localizePriorityMiniCard(card, { tReport, tCv, locale = 'en' }) {
  if (!card) return card
  const navTitle = tReport?.(`nav.${card.id}`)
  const miniTitle = tReport?.has?.(`executiveSummary.miniCards.${card.id}.title`)
    ? tReport(`executiveSummary.miniCards.${card.id}.title`)
    : navTitle
  return {
    ...card,
    title: miniTitle || card.title,
    scoreLabel: card.scoreLabel ? translateClassification(card.scoreLabel, tCv) : card.scoreLabel,
    findings: (card.findings || []).map((f) => ({
      ...f,
      title: localizeMiniCardMetricTitle(f.title, tReport),
      detail: localizeMiniCardDetail(f.detail, tCv, locale),
    })),
  }
}

export function translateClassification(value, tCv) {
  if (value == null || value === '') return value
  const key = resolveCvLabelKey(value)
  if (key && tCv?.has?.(`labels.${key}`)) {
    return translateCvLabel(key, tCv)
  }
  if (tCv?.has?.(`labels.${value}`)) {
    return translateCvLabel(value, tCv)
  }
  return value
}

export function useCvLabel() {
  const tCv = useTranslations('CvReport')
  return useCallback((value) => translateClassification(value, tCv), [tCv])
}

/** Prefer stored German explanation when locale is de. */
export function pickLocalizedCvText(obj, locale, field = 'explanation') {
  if (!obj || typeof obj !== 'object') return ''
  if (locale === 'de') {
    const de = obj[`${field}De`]
    if (typeof de === 'string' && de.trim()) return de
  }
  const en = obj[field]
  return typeof en === 'string' ? en : ''
}

/** Map stored ratio comparison English → i18n key under Report.proportions.ratioCompare */
const RATIO_COMPARE_TO_KEY = {
  'Ear > Nose': 'earGreaterNose',
  'Ear < Nose': 'earLessNose',
  'Ear ≈ Nose': 'earApproxNose',
  'Ear = Nose': 'earEqualNose',
  'Nose > Eye': 'noseGreaterEye',
  'Nose < Eye': 'noseLessEye',
  'Nose ≈ Eye': 'noseApproxEye',
  'Nose = Eye': 'noseEqualEye',
  'Mouth > Nose': 'mouthGreaterNose',
  'Mouth < Nose': 'mouthLessNose',
  'Mouth ≈ Nose': 'mouthApproxNose',
  'Spacing > Eye': 'spacingGreaterEye',
  'Spacing < Eye': 'spacingLessEye',
  'Spacing = Eye': 'spacingEqualEye',
}

export function translateRatioCompareLabel(value, tReport) {
  if (value == null || value === '') return value
  const key = RATIO_COMPARE_TO_KEY[String(value).trim()]
  if (key && tReport?.has?.(`proportions.ratioCompare.${key}`)) {
    return tReport(`proportions.ratioCompare.${key}`)
  }
  return value
}
