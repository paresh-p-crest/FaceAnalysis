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
  Deviated: 'deviated',
  Pointed: 'pointed',
  Shallow: 'shallow',
  Deep: 'deep',
  'Peaked / Defined': 'peakedDefined',
  'Flat / Subtle': 'flatSubtle',
  'Full / Wide': 'fullWide',
  Angular: 'angularDefined',
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
  if (CV_LABEL_VALUES.has(s)) return s
  if (s in CV_LABEL) return s
  return null
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
