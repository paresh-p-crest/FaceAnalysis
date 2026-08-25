import { defaultPdfT, createPdfTranslator, createReportTranslator, createCvReportTranslator } from './pdfI18n'
import { jsPDF } from 'jspdf'
import { normalizeToJpegDataUrl } from './aestheticProjection'
import {
  buildChinProfileGuides,
  buildChinProjectionGuides,
  createProfileSilhouetteSampler,
  generateAnnotatedChinProfileImage,
  mapNormThroughCover,
  orientProfileForChinShow,
  overlayFromProfileLandmarks,
  resolveChinProjectionOverlay,
} from './chinProfileGuides'
import { analyzeWithMediaPipe } from './mediapipeAnalysis'
import { resolveAllFeatureAfterImages, resolveAllFeatureImages } from './protocolFeatureImages'
import { resolveAfterCvPayload, resolveAfterLandmarks, resolveProjectedAfterUrl } from './projectedAfter'
import { alignAfterToBefore } from './alignAfterToBefore'
import {
  analysisTimeDaysParts,
  buildClosingColumns,
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  buildProtocolDashboardData,
  formatAnalysisTimeDays,
  formatProtocolId,
  formatProtocolMonth,
  getClientName,
  getFeatureComparisonData,
  INTRODUCTION_PARAGRAPH_KEYS,
  DISCLAIMER_PARAGRAPH_KEYS,
  PRIVACY_PARAGRAPH_KEYS,
  LIMITATIONS_PARAGRAPH_KEY,
  localizedFeaturePrimary,
  localizedSubsectionTitle,
  PRIVACY_POLICY_URL,
  resolveTreatmentPhases,
  resolveFeaturePreviewCallouts,
  mapCoverTopCenter,
  UNDERSTANDING_RESULTS_KEYS,
} from './reportProtocolModel'
import { localizeFeatureRow, localizePriorityMiniCard } from './cvReportLocale'

// MyFace theme tokens (docs/design/theme.md)
const BRAND = { r: 94, g: 159, b: 139 }
const MINT_BG = { r: 232, g: 243, b: 240 }
/** Page-1 dashboard canvas — light grey like interactive overview chrome (#F8F9FA). */
const PAGE1_BG = { r: 248, g: 249, b: 250 }
const SLATE = { r: 55, g: 65, b: 81 }
const FACE_MAP_BG = { r: 139, g: 154, b: 163 }
const INK = { r: 17, g: 24, b: 39 }
const MUTED = { r: 107, g: 114, b: 128 }
const SURFACE_WARM = { r: 250, g: 251, b: 253 }
const SUMMARY_BG = { r: 219, g: 238, b: 232 } // brand-100 mint (#dbeee8) — feature summary cards/bars

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2
const COL_GAP = 20
const COL_W = (CONTENT_W - COL_GAP) / 2
/** Shared nose/jaw PROFILE plate (full column width × tall). */
const PROFILE_FRAME_H = 300
/** Chin guide profiles — same column width as nose/jaw, shorter so two + B/A fit one page. */
const CHIN_PROFILE_FRAME_H = 200
const SECTION_GAP = 22
/** Space after an image frame / before-after pair before following text. */
const IMAGE_TEXT_GAP = 22
/** Standard minimum height for column summary cards. */
const SUMMARY_CARD_MIN_H = 110
const PAGE_BOTTOM = PAGE_H - 56

const EVIDENCE_TIER_LABELS = {
  lifestyle: 'evidenceLifestyle',
  otc: 'evidenceOtc',
  refer_clinician: 'evidenceReferClinician',
}

// ponytail: one PDF build's translators; avoid threading through every draw*FeaturePage. Reset in finally.
let activePdfT = defaultPdfT
let activeReportT = createReportTranslator()

function pm(key, params) {
  return activeReportT(`protocolModel.${key}`, params)
}

function featureSplit(featureId) {
  return [localizedFeaturePrimary(featureId, activeReportT), pm('recommendations')]
}

function subLabel(enTitle) {
  return localizedSubsectionTitle(enTitle, activeReportT)
}

function tagBefore() {
  return pm('tagBefore')
}
function tagAfter() {
  return pm('tagAfter')
}
function tagProfile() {
  return pm('tagProfile')
}
function tagAnalysis() {
  return pm('tagAnalysis')
}
function tagEyes() {
  return pm('tagEyes')
}
function tagLips() {
  return pm('tagLips')
}

function evidenceTierLabel(tier, pdfT) {
  const key = EVIDENCE_TIER_LABELS[tier]
  return key ? pdfT(key) : tier
}

function wrapSubsectionText(doc, sub, x, y, maxW, lineH = 11.5, pdfT = activePdfT) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text(subLabel(sub.title), x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  let nextY = wrapText(doc, sub.body, x, y + 18, maxW, lineH)
  if (sub.evidenceTier && EVIDENCE_TIER_LABELS[sub.evidenceTier]) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    setMuted(doc)
    doc.text(`${pdfT('recommendationTier')}: ${evidenceTierLabel(sub.evidenceTier, pdfT)}`, x, nextY + 4)
    nextY += 12
  }
  return nextY
}
const IMG_QUALITY = 'SLOW'
function setBrand(doc) {
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
}

function setInk(doc) {
  doc.setTextColor(INK.r, INK.g, INK.b)
}

function setMuted(doc) {
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
}

function setWhite(doc) {
  doc.setTextColor(255, 255, 255)
}

function drawBrandBar(doc) {
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
}

function drawHeader(doc, pageNum, pdfT = defaultPdfT) {
  drawBrandBar(doc)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text(pdfT('brandHeader'), MARGIN, 40)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text(pdfT('pagePrefix'), PAGE_W - MARGIN - 18, 40, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  setInk(doc)
  doc.text(String(pageNum).padStart(2, '0'), PAGE_W - MARGIN, 40, { align: 'right' })

  // Divider line under the header at y=52
  doc.setDrawColor(236, 236, 236) // #ECECEC
  doc.setLineWidth(0.75)
  doc.line(MARGIN, 52, PAGE_W - MARGIN, 52)
}

/**
 * Helvetica (jsPDF built-in) only covers WinAnsi. LLM closing copy often
 * includes soft hyphens, en/em dashes, and curly quotes that map to control
 * glyphs, break splitTextToSize widths, and overflow columns.
 * German letters are kept: umlauts + ß via Latin-1; capital ẞ folds to ß
 * because WinAnsi has no U+1E9E glyph.
 */
function sanitizePdfText(text, { trim = true } = {}) {
  if (typeof text !== 'string' || !text) return ''
  let out = text.normalize('NFKC')
  // Soft / non-breaking / fancy hyphens and dashes → ASCII hyphen
  out = out.replace(/[\u00AD\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D]/g, '-')
  out = out.replace(/[\u2018\u2019\u201A\u2032\u0060\u00B4]/g, "'")
  out = out.replace(/[\u201C\u201D\u201E\u2033]/g, '"')
  out = out.replace(/[\u2022\u2023\u25E6\u00B7]/g, '-')
  out = out.replace(/\u2026/g, '...')
  out = out.replace(/[\u00A0\u202F\u2007\u2009\u200A\u2008]/g, ' ')
  out = out.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
  // Capital sharp S is outside Latin-1; Helvetica can draw ß, not ẞ
  out = out.replace(/\u1E9E/g, '\u00DF')
  // Drop remaining non-printable; keep WinAnsi/Latin-1 (ä ö ü ß, etc.)
  out = out.replace(/[^\t\n\r\x20-\x7E\u00A0-\u00FF]/g, '')
  out = out.replace(/(\w)\s+-\s+(\w)/g, '$1-$2')
  out = out.replace(/[ \t]+\n/g, '\n')
  out = out.replace(/[ \t]{2,}/g, ' ')
  return trim ? out.trim() : out
}

/** Route all jsPDF string metrics/draws through sanitizePdfText once at the doc level. */
function wrapJsPdfTextSanitizer(doc) {
  const origText = doc.text.bind(doc)
  const origSplit = doc.splitTextToSize.bind(doc)
  const origWidth = doc.getTextWidth.bind(doc)

  // Keep trailing spaces: trim would collapse prefix/link gaps (privacy line overlap).
  const safe = (text) => (typeof text === 'string' ? sanitizePdfText(text, { trim: false }) : text)

  doc.text = function (text, ...args) {
    if (Array.isArray(text)) {
      return origText(text.map((line) => safe(line)), ...args)
    }
    return origText(safe(text), ...args)
  }
  doc.splitTextToSize = function (text, ...args) {
    return origSplit(safe(text), ...args)
  }
  doc.getTextWidth = function (text, ...args) {
    return origWidth(safe(text), ...args)
  }
}

function wrapText(doc, text, x, y, maxWidth, lineHeight = 13) {
  const safe = sanitizePdfText(text || '')
  if (!safe) return y
  const lines = doc.splitTextToSize(safe, maxWidth)
  lines.forEach((line, i) => {
    // Guard against any residual non-WinAnsi before draw
    doc.text(sanitizePdfText(line), x, y + i * lineHeight)
  })
  return y + lines.length * lineHeight
}

function drawLinkSegment(doc, text, x, y, url) {
  if (!text) return
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(94, 159, 139)
  doc.text(text, x, y)
  const w = doc.getTextWidth(text)
  doc.setDrawColor(94, 159, 139)
  doc.setLineWidth(0.5)
  doc.line(x, y + 1.5, x + w, y + 1.5)
  doc.link(x, y - 7, w, 9, { url })
}

/** Prefix (muted) + link (brand, underlined, clickable) wrapped within maxWidth. */
function drawWrappedPrivacyLink(doc, x, y, maxWidth, prefix, linkText, url, lineHeight = 11.5) {
  const safePrefix = sanitizePdfText(prefix || '')
  const safeLink = sanitizePdfText(linkText || '')
  const joiner = safePrefix && safeLink ? ' ' : ''
  const full = safePrefix + joiner + safeLink
  if (!full) return y

  const prefixEnd = safePrefix.length + joiner.length
  const lines = doc.splitTextToSize(full, maxWidth)
  let charOffset = 0

  lines.forEach((line) => {
    const lineStart = charOffset
    const lineEnd = charOffset + line.length
    charOffset = lineEnd
    if (charOffset < full.length && full[charOffset] === ' ') charOffset += 1

    if (lineEnd <= prefixEnd) {
      doc.setFont('helvetica', 'normal')
      setMuted(doc)
      doc.text(line, x, y)
    } else if (lineStart >= prefixEnd) {
      drawLinkSegment(doc, line, x, y, url)
    } else {
      const splitAt = prefixEnd - lineStart
      const prefixPart = line.slice(0, splitAt)
      const linkPart = line.slice(splitAt)
      doc.setFont('helvetica', 'normal')
      setMuted(doc)
      doc.text(prefixPart, x, y)
      drawLinkSegment(doc, linkPart, x + doc.getTextWidth(prefixPart), y, url)
    }
    y += lineHeight
  })

  return y
}

function wrapTextMaxLines(doc, text, x, y, maxWidth, lineHeight = 8.5, maxLines = 6) {
  const safe = sanitizePdfText(text || '')
  if (!safe) return y
  const lines = doc.splitTextToSize(safe, maxWidth)
  const shown = lines.slice(0, maxLines)
  shown.forEach((line, i) => {
    let out = sanitizePdfText(line)
    if (i === maxLines - 1 && lines.length > maxLines) {
      out = out.length > 3 ? `${out.slice(0, Math.max(0, out.length - 1))}…` : `${out}…`
    }
    doc.text(out, x, y + i * lineHeight)
  })
  return y + shown.length * lineHeight
}

/** Split to size with a hard max line count; ellipsis only on the last shown line if clipped. */
function splitTextMaxLines(doc, text, maxWidth, maxLines) {
  const safe = sanitizePdfText(text || '')
  if (!safe) return []
  const lines = doc.splitTextToSize(safe, maxWidth)
  const shown = lines.slice(0, Math.max(1, maxLines))
  if (lines.length > maxLines && shown.length) {
    let last = sanitizePdfText(shown[shown.length - 1])
    last = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 1))}…` : `${last}…`
    shown[shown.length - 1] = last
  }
  return shown.map((line) => sanitizePdfText(line))
}

const PHASE_CARD_LAYOUT = {
  titleLineH: 9,
  bodyLineH: 7.5,
  padTop: 10,
  padBottom: 6,
  labelToTitle: 10,
  titleToDurationGap: 2,
  durationToDivider: 4,
  dividerToItems: 8,
}

function phaseCardHeight(titleLines, durationLines, itemLineGroups, opts = PHASE_CARD_LAYOUT) {
  const titleH = titleLines.length * opts.titleLineH
  const durationH = durationLines.length * opts.bodyLineH
  const itemsH = itemLineGroups.reduce((sum, lines) => sum + lines.length * opts.bodyLineH, 0)
  const headerH = opts.padTop + opts.labelToTitle + titleH + opts.titleToDurationGap + durationH + opts.durationToDivider
  return headerH + opts.dividerToItems + itemsH + opts.padBottom
}

function buildPhaseItemLine(item) {
  if (!item) return '· —'
  const detail = finalizePhaseDetailText(item.detail)
  return `· ${item.name}${detail ? `: ${detail}` : ''}`
}

/** Drop hard-clamped mid-word tails (e.g. detail max 280) so PDF never shows "unde" / "while ma". */
function finalizePhaseDetailText(detail) {
  const t = sanitizePdfText(detail || '').trim()
  if (!t) return ''
  if (/[.!?]$/.test(t)) return t
  const sentence = t.match(/^[\s\S]*[.!?]/)
  if (sentence && sentence[0].trim().length >= 24) return sentence[0].trim()
  const sp = t.lastIndexOf(' ')
  if (sp > 12) return t.slice(0, sp).trim()
  return t
}

function wrapPhaseItemLines(doc, item, textW) {
  const line = buildPhaseItemLine(item)
  return doc.splitTextToSize(sanitizePdfText(line), textW).map((l) => sanitizePdfText(l))
}

/** Wrap to maxLines without mid-word ellipsis — shrinks at word boundary until it fits. */
function splitTextWordBoundary(doc, text, maxW, maxLines) {
  const safe = sanitizePdfText(text || '')
  if (!safe || maxLines < 1) return []
  const full = doc.splitTextToSize(safe, maxW)
  if (full.length <= maxLines) return full.map((l) => sanitizePdfText(l))

  let lo = 0
  let hi = safe.length
  let best = ''
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    let candidate = safe.slice(0, mid).trimEnd()
    const sp = candidate.lastIndexOf(' ')
    if (sp > 0) candidate = candidate.slice(0, sp).trimEnd()
    if (!candidate) {
      hi = mid - 1
      continue
    }
    const wrapped = doc.splitTextToSize(candidate, maxW)
    if (wrapped.length <= maxLines) {
      best = candidate
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (!best) return []
  return doc.splitTextToSize(best, maxW).map((l) => sanitizePdfText(l))
}

/** Header strip height (through divider gap) + padBottom — item heights added separately. */
function measurePhaseHeader(doc, phase, textW, opts = PHASE_CARD_LAYOUT) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const titleLines = doc
    .splitTextToSize(sanitizePdfText(phase?.title || '—'), textW)
    .map((line) => sanitizePdfText(line))

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  const durationLines = doc
    .splitTextToSize(sanitizePdfText(phase?.duration || '—'), textW)
    .map((line) => sanitizePdfText(line))

  const headerBase =
    opts.padTop
    + opts.labelToTitle
    + titleLines.length * opts.titleLineH
    + opts.titleToDurationGap
    + durationLines.length * opts.bodyLineH
    + opts.durationToDivider
    + opts.dividerToItems
    + opts.padBottom

  return { titleLines, durationLines, headerBase }
}

function buildPhaseCardLayout(doc, phase, phaseKey, textW, opts = PHASE_CARD_LAYOUT, keptMetas = null) {
  const { titleLines, durationLines } = measurePhaseHeader(doc, phase, textW, opts)
  const sourceItems = (phase?.items || []).slice(0, 3)

  let itemLineGroups
  if (keptMetas) {
    itemLineGroups = keptMetas.map((meta) => meta.lines)
  } else if (sourceItems.length) {
    itemLineGroups = sourceItems.map((item) => wrapPhaseItemLines(doc, item, textW))
  } else {
    itemLineGroups = [wrapPhaseItemLines(doc, null, textW)]
  }

  return {
    phase,
    phaseKey,
    titleLines,
    durationLines,
    itemLineGroups,
    height: phaseCardHeight(titleLines, durationLines, itemLineGroups, opts),
  }
}

function layoutsColumnHeight(layouts, phaseGap) {
  return layouts.reduce(
    (sum, layout, i) => sum + layout.height + (i < layouts.length - 1 ? phaseGap : 0),
    0,
  )
}

function buildLayoutsFromKept(doc, measured, kept, textW, opts) {
  return measured.map((m) => {
    const selected = kept[m.phaseKey] || []
    if (!selected.length && !(m.phase?.items || []).length) {
      return buildPhaseCardLayout(doc, m.phase, m.phaseKey, textW, opts, null)
    }
    return buildPhaseCardLayout(doc, m.phase, m.phaseKey, textW, opts, selected)
  })
}

/** Drop one trailing complete bullet; never remove phase03's last remaining item. */
function dropTrailingBullet(kept) {
  if (kept.phase01?.length) {
    kept.phase01.pop()
    return true
  }
  if (kept.phase02?.length > 1) {
    kept.phase02.pop()
    return true
  }
  if (kept.phase03?.length > 1) {
    kept.phase03.pop()
    return true
  }
  if (kept.phase02?.length === 1) {
    kept.phase02.pop()
    return true
  }
  return false
}

/**
 * Fit treatment phase cards to columnBudget by dropping whole bullets (full text only).
 * phase01 filled first after reserving ≥1 complete bullet for phase03 (and phase02 when present);
 * leftover shared round-robin across phase02/phase03.
 * Final reconcile drops bullets until measured card stack ≤ budget (prevents mid-line page clip).
 */
function layoutTreatmentPhaseCards(doc, { phaseKeys, phases, textW, columnBudget, phaseGap = 5 }) {
  const opts = PHASE_CARD_LAYOUT
  // Small slack so descenders / rounding never push past the column floor.
  const budget = Math.max(0, columnBudget - 6)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)

  const measured = phaseKeys.map((phaseKey) => {
    const phase = phases?.[phaseKey]
    const header = measurePhaseHeader(doc, phase, textW, opts)
    const items = (phase?.items || []).slice(0, 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    const itemMetas = items.map((item) => {
      const lines = wrapPhaseItemLines(doc, item, textW)
      return { item, lines, height: lines.length * opts.bodyLineH }
    }).filter((meta) => meta.lines.length > 0)
    return { phaseKey, phase, header, itemMetas }
  })

  const gaps = Math.max(0, measured.length - 1) * phaseGap
  const byKey = Object.fromEntries(measured.map((m) => [m.phaseKey, m]))
  const kept = Object.fromEntries(phaseKeys.map((k) => [k, []]))

  // Start from full item lists, then drop until fit (same priority rules as pack).
  for (const m of measured) {
    kept[m.phaseKey] = m.itemMetas.slice()
  }

  let layouts = buildLayoutsFromKept(doc, measured, kept, textW, opts)
  if (layoutsColumnHeight(layouts, phaseGap) <= budget) return layouts

  // Rebuild with priority pack, then reconcile.
  for (const k of phaseKeys) kept[k] = []

  let remaining = budget - gaps - measured.reduce((sum, m) => sum + m.header.headerBase, 0)

  const p3 = byKey.phase03
  const p2 = byKey.phase02
  const p1 = byKey.phase01

  if (p3?.itemMetas.length) {
    kept.phase03.push(p3.itemMetas[0])
    remaining -= p3.itemMetas[0].height
    if (remaining < 0) remaining = 0
  }

  const reserveP2 = p2?.itemMetas.length ? p2.itemMetas[0].height : 0

  if (p1?.itemMetas.length) {
    for (const meta of p1.itemMetas) {
      if (meta.height <= remaining - reserveP2) {
        kept.phase01.push(meta)
        remaining -= meta.height
      } else {
        break
      }
    }
  }

  if (p2?.itemMetas.length && p2.itemMetas[0].height <= remaining) {
    kept.phase02.push(p2.itemMetas[0])
    remaining -= p2.itemMetas[0].height
  }

  let i2 = kept.phase02?.length || 0
  let i3 = kept.phase03?.length || 0
  for (;;) {
    let progressed = false
    if (p2 && i2 < p2.itemMetas.length && p2.itemMetas[i2].height <= remaining) {
      kept.phase02.push(p2.itemMetas[i2])
      remaining -= p2.itemMetas[i2].height
      i2 += 1
      progressed = true
    }
    if (p3 && i3 < p3.itemMetas.length && p3.itemMetas[i3].height <= remaining) {
      kept.phase03.push(p3.itemMetas[i3])
      remaining -= p3.itemMetas[i3].height
      i3 += 1
      progressed = true
    }
    if (!progressed) break
  }

  layouts = buildLayoutsFromKept(doc, measured, kept, textW, opts)
  while (layoutsColumnHeight(layouts, phaseGap) > budget) {
    if (!dropTrailingBullet(kept)) break
    layouts = buildLayoutsFromKept(doc, measured, kept, textW, opts)
  }
  return layouts
}

function drawSplitTitle(doc, x, y, primary, secondary, size = 26) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  setInk(doc)
  doc.text(primary, x, y)
  if (secondary) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(181, 199, 211) // hex #B5C7D3 light slate/grey
    doc.text(secondary, x, y + size * 0.9)
    setInk(doc) // Reset to standard ink color
    return y + size * 1.8
  }
  return y + size * 0.5
}

function fitImage(w, h, maxW, maxH) {
  const ratio = Math.min(maxW / w, maxH / h)
  return { w: w * ratio, h: h * ratio }
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * True object-fit:cover without jsPDF clip: center-crop on canvas to the frame
 * size, then draw that JPEG exactly into the box (no overflow, no blanking).
 */
function createCoverCropSession() {
  const imgByUrl = new Map()
  const cropByKey = new Map()
  const cropOffsets = new Map()

  return {
    async warm(urls) {
      const unique = [...new Set(
        (urls || []).filter((url) => typeof url === 'string' && url.trim()),
      )]
      await Promise.all(
        unique.map(async (url) => {
          if (imgByUrl.has(url)) return
          try {
            imgByUrl.set(url, await loadHtmlImage(url))
          } catch {
            /* leave missing; addPdfImage falls back to stretch */
          }
        }),
      )
    },
    getImage(dataUrl) {
      return dataUrl ? imgByUrl.get(dataUrl) || null : null
    },
    setCropOffset(dataUrl, sx) {
      if (dataUrl && typeof sx === 'number') cropOffsets.set(dataUrl, sx)
    },
    getCropOffset(dataUrl) {
      return dataUrl ? cropOffsets.get(dataUrl) ?? null : null
    },
    /** Register an already-decoded (or freshly rotated) image under a data URL key. */
    putImage(dataUrl, img) {
      if (dataUrl && img) imgByUrl.set(dataUrl, img)
    },
    crop(dataUrl, maxW, maxH, poseId = null) {
      if (!dataUrl || maxW <= 0 || maxH <= 0) return null
      const key = `${maxW.toFixed(1)}x${maxH.toFixed(1)}:${poseId || 'none'}:${dataUrl.length}:${dataUrl.slice(-48)}`
      if (cropByKey.has(key)) return cropByKey.get(key)
      const img = imgByUrl.get(dataUrl)
      if (!img || !img.width || !img.height) return null

      const pxW = Math.max(1, Math.round(maxW * 2))
      const pxH = Math.max(1, Math.round(maxH * 2))
      const scale = Math.max(pxW / img.width, pxH / img.height)
      const sw = pxW / scale
      const sh = pxH / scale
      let sx = (img.width - sw) / 2
      const sy = (img.height - sh) / 2

      const customSx = cropOffsets.get(dataUrl)
      if (customSx !== undefined && customSx !== null) {
        sx = customSx
      } else if (poseId === 'rightProfile') {
        sx = (img.width - sw) * 0.85
      } else if (poseId === 'leftProfile') {
        sx = (img.width - sw) * 0.15
      }

      const canvas = document.createElement('canvas')
      canvas.width = pxW
      canvas.height = pxH
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pxW, pxH)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, pxW, pxH)
      const cropped = canvas.toDataURL('image/jpeg', 0.92)
      cropByKey.set(key, cropped)
      return cropped
    },
    /**
     * Left half = before; right half = after when present, else blank pending panel.
     * Requires warmed HTMLImages. Returns JPEG data URL or null.
     */
    composeSplit(beforeSrc, afterSrc, maxW, maxH) {
      if (!beforeSrc || maxW <= 0 || maxH <= 0) return null
      const beforeImg = imgByUrl.get(beforeSrc)
      if (!beforeImg) return null
      const key = `split:${afterSrc ? '1' : '0'}:${maxW.toFixed(1)}x${maxH.toFixed(1)}:${beforeSrc.length}:${afterSrc?.length || 0}`
      if (cropByKey.has(key)) return cropByKey.get(key)

      const pxW = Math.max(1, Math.round(maxW * 2))
      const pxH = Math.max(1, Math.round(maxH * 2))
      const half = Math.floor(pxW / 2)

      const canvas = document.createElement('canvas')
      canvas.width = pxW
      canvas.height = pxH
      const ctx = canvas.getContext('2d')

      const drawCover = (img) => {
        const scale = Math.max(pxW / img.width, pxH / img.height)
        const sw = pxW / scale
        const sh = pxH / scale
        const sx = (img.width - sw) / 2
        const sy = (img.height - sh) / 2
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, pxW, pxH)
      }

      drawCover(beforeImg)

      if (afterSrc && imgByUrl.get(afterSrc)) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(half, 0, pxW - half, pxH)
        ctx.clip()
        drawCover(imgByUrl.get(afterSrc))
        ctx.restore()
      } else {
        ctx.fillStyle = `rgb(${SURFACE_WARM.r},${SURFACE_WARM.g},${SURFACE_WARM.b})`
        ctx.fillRect(half, 0, pxW - half, pxH)
      }

      const out = canvas.toDataURL('image/jpeg', 0.92)
      cropByKey.set(key, out)
      return out
    },
  }
}

/** Active only while generating a PDF (set in downloadMyFacePdf). */
let coverCropSession = null

function addPdfImage(doc, dataUrl, x, y, maxW, maxH, cover = false, poseId = null) {
  if (!dataUrl) return { w: 0, h: 0 }
  if (cover) {
    const fitted = coverCropSession?.crop(dataUrl, maxW, maxH, poseId) || null
    if (fitted) {
      doc.addImage(fitted, 'JPEG', x, y, maxW, maxH, undefined, IMG_QUALITY)
      return { w: maxW, h: maxH, ox: x, oy: y }
    }
    // Never stretch into the frame — contain + letterbox (avoids horizontal squeeze)
  }
  const props = doc.getImageProperties(dataUrl)
  const ratio = Math.min(maxW / props.width, maxH / props.height)
  const w = props.width * ratio
  const h = props.height * ratio
  const ox = x + (maxW - w) / 2
  const oy = y + (maxH - h) / 2
  doc.addImage(dataUrl, 'JPEG', ox, oy, w, h, undefined, IMG_QUALITY)
  return { w, h, ox, oy }
}

function drawImageFrame(doc, x, y, w, h, dataUrl, tag, { cover = false, gap = IMAGE_TEXT_GAP, pdfT = activePdfT, poseId = null } = {}) {
  doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
  doc.roundedRect(x, y, w, h, 6, 6, 'F')
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 6, 6, 'S')

  if (dataUrl) {
    const pad = 4
    addPdfImage(doc, dataUrl, x + pad, y + pad, w - pad * 2, h - pad * 2, cover, poseId)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setMuted(doc)
    doc.text(pdfT('projectedImagePending'), x + w / 2, y + h / 2, { align: 'center' })
  }

  if (tag) {
    doc.setFillColor(80, 80, 80)
    const tagW = Math.min(72, tag.length * 5.5 + 14)
    doc.roundedRect(x + 6, y + 6, tagW, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setWhite(doc)
    doc.text(tag, x + 10, y + 16)
  }
  return y + h + gap
}

/**
 * Before | After split frame. Right side shows after when available; otherwise "Projected image pending"
 * (never falls back to the before photo on the right).
 */
function drawSplitComparisonFrame(doc, x, y, w, h, beforeSrc, afterSrc, { gap = IMAGE_TEXT_GAP } = {}) {
  doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
  doc.roundedRect(x, y, w, h, 6, 6, 'F')

  const pad = 2
  const innerW = w - pad * 2
  const innerH = h - pad * 2
  const composed = coverCropSession?.composeSplit(beforeSrc, afterSrc || null, innerW, innerH)

  if (composed) {
    doc.addImage(composed, 'JPEG', x + pad, y + pad, innerW, innerH, undefined, IMG_QUALITY)
  } else if (beforeSrc) {
    // Fallback: left half before only (no right-side before mirror)
    addPdfImage(doc, beforeSrc, x + pad, y + pad, innerW / 2 - 1, innerH, true)
  }

  if (!afterSrc) {
    const rx = x + w / 2
    doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
    doc.rect(rx, y + pad, w / 2 - pad, innerH, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setMuted(doc)
    doc.text(activePdfT('projectedImagePending'), rx + (w / 2 - pad) / 2, y + h / 2, { align: 'center' })
  }

  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 6, 6, 'S')

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  doc.setLineDashPattern([3, 3], 0)
  doc.line(x + w / 2, y + 4, x + w / 2, y + h - 4)
  doc.setLineDashPattern([], 0)

  return y + h + gap
}

/** Labeled body block; returns Y after the last text line. EN title → localized display. */
function drawLabeledBody(doc, x, y, title, body, maxW, lineH = 11.5, opts = {}) {
  const { maxBottom = null } = opts
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text(subLabel(title), x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  const bodyTop = y + 22
  let text = body || ''
  if (maxBottom != null) {
    const maxBodyHeight = Math.max(lineH, maxBottom - bodyTop)
    text = truncateAtSentences(doc, text, maxW, maxBodyHeight, lineH)
  }
  return wrapText(doc, text, x, bodyTop, maxW, lineH)
}

/**
 * Summary card. Short copy keeps today’s compact size.
 * stickToBottom (hair/jaw/eyes default): pin card bottom to maxBottom; long copy
 * grows upward into leftover (never above caller y / topFloor).
 * Grow-from-top (!stickToBottom): long copy grows down from y to PAGE_H - 1.
 * Whole sentences that fit are kept; the tail is dropped.
 */
function drawSummaryCard(
  doc,
  x,
  y,
  w,
  title,
  summary,
  { minH = SUMMARY_CARD_MIN_H, pad = 12, lineH = 11.5, maxBottom = PAGE_BOTTOM, stickToBottom = true } = {},
) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const textW = w - pad * 2
  const lines = doc.splitTextToSize(summary || '', textW)
  const titleBlock = 30
  const neededH = Math.max(minH, titleBlock + Math.max(lines.length, 1) * lineH + pad)
  const topFloor = Math.max(80, y)
  const growCap = PAGE_H - 1
  const bottomEdge = stickToBottom ? Math.min(maxBottom, growCap) : growCap
  const leftover = Math.max(0, bottomEdge - topFloor)
  const compactH = Math.min(minH, leftover || minH)
  const wantsGrow = neededH > minH + 0.5

  let cardY
  let cardH
  if (wantsGrow) {
    cardH = Math.max(36, leftover)
    cardY = stickToBottom ? bottomEdge - cardH : topFloor
    if (cardY < topFloor) {
      cardY = topFloor
      cardH = Math.max(36, leftover)
    }
  } else {
    cardH = Math.max(36, compactH)
    if (stickToBottom) {
      cardY = bottomEdge - cardH
      if (cardY < topFloor) {
        cardY = topFloor
        cardH = Math.max(36, Math.min(cardH, leftover))
      }
    } else {
      cardY = topFloor
    }
  }
  if (cardY + cardH > bottomEdge) {
    cardH = Math.max(36, bottomEdge - cardY)
  }

  const maxLines = Math.max(1, Math.floor((cardH - titleBlock - pad) / lineH))
  const visible = splitTextAtSentences(doc, summary, textW, maxLines, lineH)
  if (wantsGrow) {
    cardH = Math.min(
      leftover,
      Math.max(compactH, titleBlock + Math.max(visible.length, 1) * lineH + pad),
    )
    if (stickToBottom) {
      cardY = bottomEdge - cardH
      if (cardY < topFloor) {
        cardY = topFloor
        cardH = Math.max(36, bottomEdge - cardY)
      }
    }
  }

  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(x, cardY, w, cardH, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text(title, x + pad, cardY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  visible.forEach((line, i) => {
    doc.text(line, x + pad, cardY + titleBlock + 6 + i * lineH)
  })
  return { cardY, cardH, bottom: cardY + cardH }
}

/**
 * Keep full sentences that fit in maxBodyHeight; drop the rest.
 * If even the first sentence is too long, keep that first sentence intact
 * (no mid-word line clip — DE often glues sentences as "wollen.Ein").
 */
function truncateAtSentences(doc, text, maxW, maxBodyHeight, lineH = 11.5) {
  const safe = sanitizePdfText(text || '')
  if (!safe) return ''
  const maxLines = Math.max(1, Math.floor(maxBodyHeight / lineH))
  if (doc.splitTextToSize(safe, maxW).length <= maxLines) return safe

  // Space missing after period (common in DE): "wollen.Ein" → "wollen. Ein"
  const spaced = safe.replace(/([.!?])([A-ZÄÖÜÀ-ÖØ-Þ])/g, '$1 $2')
  const sentences = spaced.match(/.+?[.!?](?:\s+|$)|.+$/g) || [spaced]
  let kept = ''
  for (const sentence of sentences) {
    const piece = sentence.trim()
    if (!piece) continue
    const candidate = kept ? `${kept} ${piece}` : piece
    if (doc.splitTextToSize(candidate, maxW).length > maxLines) break
    kept = candidate
  }
  if (kept) return kept

  // First sentence alone exceeds the budget — still keep it whole (no "können" mid-cut).
  return (sentences[0] || spaced).trim()
}

/** Wrap text to lines, truncating at the last full sentence that fits. */
function splitTextAtSentences(doc, text, maxW, maxLines, lineH) {
  const truncated = truncateAtSentences(doc, text, maxW, maxLines * lineH, lineH)
  if (!truncated) return []
  return doc.splitTextToSize(sanitizePdfText(truncated), maxW).map((line) => sanitizePdfText(line))
}

/**
 * Bottom-row layout for Hair Health / Further Enhancement:
 * summary card stays bottom-anchored; left title aligns to card title, then
 * moves up independently (or sentence-truncates at topFloor) when body overflows.
 */
function layoutBottomAnchoredLeftColumn(
  doc,
  sub,
  summaryTitle,
  summaryText,
  topFloor,
  rightX,
  colW,
  { bodyOffset = 18, drawTier = false, lineH = 11.5, pdfT = activePdfT } = {},
) {
  const card = drawSummaryCard(doc, rightX, topFloor, colW, summaryTitle, summaryText, {
    stickToBottom: true,
    maxBottom: PAGE_BOTTOM,
  })
  if (!sub) return card

  const showTier =
    drawTier && sub.evidenceTier && EVIDENCE_TIER_LABELS[sub.evidenceTier]
  const tierH = showTier ? 12 : 0
  const growCap = PAGE_H - 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  // Align title with summary card title when room allows; otherwise start at topFloor.
  let titleY = Math.max(topFloor, card.cardY + 16)
  let maxBodyHeight = growCap - titleY - bodyOffset - tierH
  if (maxBodyHeight < lineH * 2) {
    titleY = topFloor
    maxBodyHeight = growCap - titleY - bodyOffset - tierH
  }
  maxBodyHeight = Math.max(lineH, maxBodyHeight)
  const body = truncateAtSentences(doc, sub.body || '', colW, maxBodyHeight, lineH)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text(subLabel(sub.title), MARGIN, titleY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  let nextY = wrapText(doc, body, MARGIN, titleY + bodyOffset, colW, lineH)
  if (showTier) {
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    setMuted(doc)
    doc.text(
      `${pdfT('recommendationTier')}: ${evidenceTierLabel(sub.evidenceTier, pdfT)}`,
      MARGIN,
      nextY + 4,
    )
  }
  return card
}

function drawCheekMeasurementOverlay(
  doc,
  frameX,
  frameY,
  frameW,
  frameH,
  points = [],
  segments = [],
  analysisSrc = null
) {
  const pad = 6
  const box = { x: frameX + pad, y: frameY + pad, w: frameW - pad * 2, h: frameH - pad * 2 }
  const img = analysisSrc ? coverCropSession?.getImage?.(analysisSrc) : null
  const map = (nx, ny) => {
    if (img?.width && img?.height) {
      return mapNormThroughCover(nx, ny, img.width, img.height, box.x, box.y, box.w, box.h)
    }
    return { x: box.x + nx * box.w, y: box.y + ny * box.h }
  }

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.85)
  doc.setLineDashPattern([], 0)
  doc.setFillColor(255, 255, 255)

  // Preferred: notebook-style segments from DB MediaPipe landmarks
  if (segments.length) {
    for (const s of segments) {
      const a = map(s.x1, s.y1)
      const b = map(s.x2, s.y2)
      doc.line(a.x, a.y, b.x, b.y)
    }
    return
  }

  if (!points.length) return
  const left = points.filter((p) => p.x < 0.48).sort((a, b) => a.y - b.y)
  const right = points.filter((p) => p.x >= 0.52).sort((a, b) => a.y - b.y)
  const midY = points.reduce((sum, p) => sum + p.y, 0) / points.length

  if (left.length >= 2) {
    const top = left[0]
    const bottom = left[left.length - 1]
    const a = map(top.x, top.y)
    const b = map(bottom.x, bottom.y)
    doc.line(a.x, a.y, b.x, b.y)
    doc.circle(a.x, a.y, 1.6, 'F')
    doc.circle(b.x, b.y, 1.6, 'F')
  }
  if (right.length >= 2) {
    const top = right[0]
    const bottom = right[right.length - 1]
    const a = map(top.x, top.y)
    const b = map(bottom.x, bottom.y)
    doc.line(a.x, a.y, b.x, b.y)
    doc.circle(a.x, a.y, 1.6, 'F')
    doc.circle(b.x, b.y, 1.6, 'F')
  }

  const m0 = map(0.18, midY)
  const m1 = map(0.82, midY)
  doc.line(m0.x, m0.y, m1.x, m1.y)
  doc.circle(m0.x, m0.y, 1.6, 'F')
  doc.circle(m1.x, m1.y, 1.6, 'F')
}

function drawBeforeAfterPair(doc, x, y, w, beforeSrc, afterSrc = null, imgH = 100, horizontal = true, cover = true) {
  const gap = 8
  const frameW = horizontal ? (w - gap) / 2 : w
  const frameH = horizontal ? imgH : (imgH - gap) / 2

  if (horizontal) {
    drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, tagBefore(), { cover })
    drawImageFrame(doc, x + frameW + gap, y, frameW, frameH, afterSrc, tagAfter(), { cover })
    return y + frameH + IMAGE_TEXT_GAP
  }

  drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, tagBefore(), { cover })
  drawImageFrame(doc, x, y + frameH + gap, frameW, frameH, afterSrc, tagAfter(), { cover })
  return y + frameH * 2 + gap + IMAGE_TEXT_GAP
}

function drawSummaryBar(doc, y, title, summary, opts = {}) {
  const {
    splitLines = splitTextAtSentences,
    maxBottom = PAGE_BOTTOM,
  } = opts
  const pad = 12
  const gap = 10
  const lineH = 12
  const bodyTop = 16
  const bottomPad = pad

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  const measuredTitleW = doc.getTextWidth(title || '')
  // Match HTML summary bar: fixed title column, but wide enough for DE labels like "Zusammenfassung Wangenregion"
  const titleColW = Math.min(Math.max(112, measuredTitleW + pad), CONTENT_W * 0.42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const bodyX = MARGIN + titleColW + gap
  const bodyW = Math.max(120, CONTENT_W - titleColW - gap - pad)
  const barHeight = (n) => Math.max(44, bodyTop + Math.max(n, 1) * lineH + bottomPad)
  const linesThatFit = (h) => Math.max(1, Math.floor((h - bodyTop - bottomPad) / lineH))

  let barY = y
  let barH
  let summaryLines

  // Same flow for all bars (incl. chin): compact ≤4 lines; longer → grow to PAGE_H-1, keep whole sentences.
  const fullLines = doc.splitTextToSize(summary || '', bodyW)
  const leftover = Math.max(0, (PAGE_H - 1) - barY)
  if (fullLines.length <= 4) {
    barH = barHeight(Math.min(fullLines.length, 4))
    if (barY + barH > maxBottom) {
      barY = Math.max(y, maxBottom - barH)
      barH = Math.min(barH, Math.max(28, maxBottom - barY))
    }
    summaryLines = splitLines(doc, summary, bodyW, linesThatFit(barH), lineH)
    barH = Math.min(barHeight(summaryLines.length), maxBottom - barY)
    summaryLines = splitLines(doc, summary, bodyW, linesThatFit(barH), lineH)
  } else {
    barY = y
    const growH = leftover
    summaryLines = splitLines(doc, summary, bodyW, linesThatFit(growH), lineH)
    barH = Math.min(barHeight(summaryLines.length), growH)
    summaryLines = splitLines(doc, summary, bodyW, linesThatFit(barH), lineH)
  }

  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, barY, CONTENT_W, barH, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text(title, MARGIN + pad, barY + bodyTop)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  summaryLines.forEach((line, i) => {
    doc.text(line, bodyX, barY + bodyTop + i * lineH)
  })
  return barY + barH + 8
}

function drawDumbbellChart(doc, x, y, w, h, items) {
  const rowH = h / items.length
  const trackX = x + 72
  const trackW = w - 88

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text('Projected potential', x, y - 6)

  items.forEach((item, i) => {
    const rowY = y + i * rowH + rowH / 2
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setInk(doc)
  doc.text(sanitizePdfText(item.label), x, rowY + 2)

    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)
    doc.line(trackX, rowY, trackX + trackW, rowY)

    const cx = trackX + (item.score / 100) * trackW
    const px = trackX + (item.projected / 100) * trackW

    doc.setDrawColor(SLATE.r, SLATE.g, SLATE.b)
    doc.setLineWidth(1.5)
    doc.line(Math.min(cx, px), rowY, Math.max(cx, px), rowY)

    doc.setFillColor(SLATE.r, SLATE.g, SLATE.b)
    doc.circle(cx, rowY, 3, 'F')
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
    doc.circle(px, rowY, 3, 'F')
  })

  const legendY = y + h + 12
  doc.setFillColor(SLATE.r, SLATE.g, SLATE.b)
  doc.circle(x + 4, legendY, 3, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  doc.text(sanitizePdfText(pm('chartClientValues')), x + 12, legendY + 2)
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.circle(x + 88, legendY, 3, 'F')
  doc.text(sanitizePdfText(pm('chartProjectedPotential')), x + 96, legendY + 2)

  return legendY + 14
}

function drawFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal = false) {
  drawHeader(doc, pageNum, activePdfT)

  const [primary, secondary] = featureSplit(section.id)
  let titleY = drawSplitTitle(doc, MARGIN, 68, primary, secondary, 20)

  const rightX = MARGIN + COL_W + COL_GAP
  const imgColW = COL_W
  let textY = titleY + 4
  const textMaxW = COL_W - 4

  section.subsections.forEach((sub) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(doc)
    doc.text(subLabel(sub.title), MARGIN, textY)
    textY += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setInk(doc)
    textY = wrapText(doc, sub.body, MARGIN, textY, textMaxW, 11) + 8
  })

  let imgY = titleY + 4
  if (section.layoutHints?.profileImage && profileJpeg && profileIsReal) {
    imgY = drawImageFrame(doc, rightX, imgY, imgColW, 120, profileJpeg, tagProfile())
  }

  const pairH = section.layoutHints?.stackedImages ? 180 : 100
  const vertical = section.layoutHints?.stackedImages
  imgY = drawBeforeAfterPair(doc, rightX, imgY, imgColW, beforeJpeg, section.afterJpeg || null, pairH, !vertical)

  const summaryTitle = pm('featureSummary', { name: primary })
  drawSummaryBar(doc, Math.max(textY, imgY) + SECTION_GAP, summaryTitle, section.summary)
}

function drawRadarChart(doc, cx, cy, rMax, items) {
  const numAxes = items.length
  if (!numAxes) return

  const axisScore = (item) => {
    const n = Number(item?.score)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
  }
  const axisProjected = (item) => {
    const n = Number(item?.projected)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : axisScore(item)
  }
  
  // 1. Draw concentric background polygons (gridlines at 20%, 40%, 60%, 80%, 100%)
  doc.setLineWidth(0.5)
  doc.setDrawColor(229, 231, 235) // very light grey
  const scales = [0.2, 0.4, 0.6, 0.8, 1.0]
  scales.forEach((scale) => {
    const pts = []
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
      const x = cx + rMax * scale * Math.cos(angle)
      const y = cy + rMax * scale * Math.sin(angle)
      pts.push([x, y])
    }
    // Draw polygon
    for (let i = 0; i < numAxes; i++) {
      const p1 = pts[i]
      const p2 = pts[(i + 1) % numAxes]
      doc.line(p1[0], p1[1], p2[0], p2[1])
    }
  })

  // 2. Draw axis lines and labels
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  items.forEach((item, i) => {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
    const xLine = cx + rMax * Math.cos(angle)
    const yLine = cy + rMax * Math.sin(angle)
    
    // Draw axis line
    doc.setDrawColor(243, 244, 246)
    doc.line(cx, cy, xLine, yLine)

    // Draw axis label
    const cosVal = Math.cos(angle)
    const sinVal = Math.sin(angle)
    const labelDist = rMax + 12
    const xLabel = cx + labelDist * cosVal
    const yLabel = cy + labelDist * sinVal + 2

    let align = 'center'
    let textX = xLabel
    if (cosVal > 0.1) {
      align = 'left'
    } else if (cosVal < -0.1) {
      align = 'right'
    }

    setMuted(doc)
    doc.text(sanitizePdfText(item.label), textX, yLabel, { align })
  })

  // 3. Draw client values polygon (slate)
  const clientPts = []
  items.forEach((item, i) => {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
    const dist = rMax * (axisScore(item) / 100)
    clientPts.push({ x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) })
  })
  
  doc.setDrawColor(SLATE.r, SLATE.g, SLATE.b)
  doc.setLineWidth(1)
  for (let i = 0; i < numAxes; i++) {
    const p1 = clientPts[i]
    const p2 = clientPts[(i + 1) % numAxes]
    doc.line(p1.x, p1.y, p2.x, p2.y)
  }

  // 4. Draw projected potential polygon (brand)
  const projectedPts = []
  items.forEach((item, i) => {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
    const dist = rMax * (axisProjected(item) / 100)
    projectedPts.push({ x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) })
  })
  
  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setLineWidth(1.25)
  for (let i = 0; i < numAxes; i++) {
    const p1 = projectedPts[i]
    const p2 = projectedPts[(i + 1) % numAxes]
    doc.line(p1.x, p1.y, p2.x, p2.y)
  }

  // 5. Draw legend below
  const legendY = cy + rMax + 24
  const boxW = 8
  
  // Legend: Projected Potential
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(cx - 90, legendY - 6, boxW, boxW, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  doc.text(sanitizePdfText(pm('chartProjectedPotential')), cx - 78, legendY)

  // Legend: Client Values
  doc.setFillColor(SLATE.r, SLATE.g, SLATE.b)
  doc.rect(cx + 10, legendY - 6, boxW, boxW, 'F')
  doc.text(sanitizePdfText(pm('chartClientValues')), cx + 22, legendY)
}

async function loadImageAsDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Baldness stages 1–7. Ludwig when genderPreference is feminine; else Norwood. */
function usesLudwigScale(answers) {
  return String(answers?.genderPreference || '').trim().toLowerCase() === 'feminine'
}

async function loadBaldnessStageImages(answers) {
  const folder = usesLudwigScale(answers) ? 'ludwig-stages' : 'norwood-stages'
  return Promise.all(
    [1, 2, 3, 4, 5, 6, 7].map((n) => loadImageAsDataUrl(`/${folder}/stage-${n}.png`)),
  )
}

function drawNorwoodPanel(doc, y, activeStage = 1, stageImages = []) {
  const stageIdx = Math.max(0, Math.min(6, (activeStage || 1) - 1))
  const panelH = 108
  doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
  doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.75)
  doc.roundedRect(MARGIN, y, CONTENT_W, panelH, 6, 6, 'FD')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  doc.text(pm('scaleNormal'), MARGIN + 28, y + 14)
  doc.text(pm('scaleNeedAttention'), MARGIN + CONTENT_W / 2, y + 14, { align: 'center' })
  doc.text(pm('scaleExtreme'), MARGIN + CONTENT_W - 28, y + 14, { align: 'right' })

  const iconSize = 56
  const startX = MARGIN + 40
  const stepX = (CONTENT_W - 80) / 6
  const cy = y + 62

  for (let i = 0; i < 7; i++) {
    const cx = startX + i * stepX
    const img = stageImages[i]
    if (img) {
      doc.addImage(
        img,
        'PNG',
        cx - iconSize / 2,
        cy - iconSize / 2,
        iconSize,
        iconSize,
        undefined,
        IMG_QUALITY,
      )
    }

    if (i === stageIdx) {
      doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
      doc.setLineWidth(1.5)
      doc.roundedRect(cx - iconSize / 2 - 4, cy - iconSize / 2 - 4, iconSize + 8, iconSize + 8, 4, 4, 'S')
    }
  }
  return y + panelH + SECTION_GAP
}

function drawHairFeaturePage(doc, section, pageNum, beforeJpeg, norwoodImages = []) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('hair'), 26) + 4

  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP
  const frameH = 120
  const norwoodStage = section.layoutHints?.norwoodStage ?? section.norwoodStage ?? 1

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = wrapSubsectionText(doc, subs[0], MARGIN, leftY, COL_W)
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, frameH, beforeJpeg, tagBefore(), { cover: true })
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, frameH, section.afterJpeg || null, tagAfter(), {
    cover: true,
  })
  y = Math.max(leftY, rightY) + SECTION_GAP

  if (subs[1]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text(subLabel('Hair Loss'), MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const body = subs[1].body || ''
    const mid = Math.floor(body.length / 2)
    const splitAt = body.indexOf('. ', mid)
    const splitIdx = splitAt > 0 ? splitAt + 1 : mid
    const textTop = y + 18
    leftY = wrapText(doc, body.slice(0, splitIdx).trim(), MARGIN, textTop, COL_W, 11.5)
    rightY = wrapText(doc, body.slice(splitIdx).trim(), rightX, textTop, COL_W, 11.5)
    y = Math.max(leftY, rightY) + SECTION_GAP
  }

  y = drawNorwoodPanel(doc, y, norwoodStage, norwoodImages)

  layoutBottomAnchoredLeftColumn(
    doc,
    subs[2] || null,
    pm('featureSummary', { name: localizedFeaturePrimary('hair', activeReportT) }),
    section.summary,
    y,
    rightX,
    COL_W,
    { bodyOffset: 18, drawTier: true },
  )
}

function drawEyesFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const pairBefore = slots.pairBefore || slots.brows || section.beforeJpeg
  const eyesPreview = slots.preview || slots.eyes || section.beforeJpeg
  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP

  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('eyes'), 26) + 4

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Eyebrows', subs[0].body, COL_W)
  if (subs[1]) rightY = drawLabeledBody(doc, rightX, rightY, 'Eyelashes', subs[1].body, COL_W)
  y = Math.max(leftY, rightY) + SECTION_GAP

  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, pairBefore, section.afterJpeg || null, 130, true)

  leftY = y
  rightY = y
  if (subs[2]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Eyes', subs[2].body, COL_W)
  if (subs[3]) rightY = drawLabeledBody(doc, rightX, rightY, 'Under eye', subs[3].body, COL_W)
  y = Math.max(leftY, rightY) + SECTION_GAP

  // EYES crop + summary share the bottom edge of the page
  const eyesFrameH = 110
  const summary = drawSummaryCard(doc, rightX, y, COL_W, pm('eyeRegionSummary'), section.summary)
  const eyesY = Math.max(y, summary.bottom - eyesFrameH)
  drawImageFrame(doc, MARGIN, eyesY, COL_W, eyesFrameH, eyesPreview, tagEyes(), {
    cover: false,
    gap: 0,
  })
}

function drawNoseFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('nose'), 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  drawLabeledBody(doc, MARGIN, y, 'Nose', subs[0]?.body, COL_W)
  let rightY = y

  if (profileJpeg && profileIsReal) {
    rightY = drawImageFrame(doc, rightX, rightY, COL_W, PROFILE_FRAME_H, profileJpeg, tagProfile(), {
      cover: true,
    })
  }
  rightY = drawBeforeAfterPair(doc, rightX, rightY, COL_W, beforeJpeg, section.afterJpeg || null, 120, true)
  drawSummaryCard(doc, rightX, rightY, COL_W, pm('featureSummary', { name: localizedFeaturePrimary('nose', activeReportT) }), section.summary)
}

function drawCheeksFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const analysisSrc = slots.analysis || section.beforeJpeg
  const pairBefore = slots.pairBefore || analysisSrc
  const overlayPoints = slots.overlayPoints || []
  const overlaySegments = slots.overlaySegments || []
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('cheeks'), 26) + 4

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Cheek Structure', subs[0].body, COL_W)

  // ANALYSIS + BEFORE + AFTER share one box size
  const cheekFrameW = COL_W
  const cheekFrameH = 180
  drawImageFrame(doc, rightX, rightY, cheekFrameW, cheekFrameH, analysisSrc, tagAnalysis(), {
    cover: true,
    gap: 0,
  })
  drawCheekMeasurementOverlay(
    doc,
    rightX,
    rightY,
    cheekFrameW,
    cheekFrameH,
    overlayPoints,
    overlaySegments,
    analysisSrc
  )
  rightY += cheekFrameH + IMAGE_TEXT_GAP
  y = Math.max(leftY, rightY) + SECTION_GAP

  // Pair width so each tile is exactly cheekFrameW (= COL_W)
  y = drawBeforeAfterPair(doc, MARGIN, y, cheekFrameW * 2 + 8, pairBefore, section.afterJpeg || null, cheekFrameH, true)
  drawSummaryBar(doc, y, pm('cheekRegionSummary'), section.summary)
}

function drawJawFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('jaw'), 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Jaw Structure', subs[0]?.body, COL_W)
  let rightY = drawImageFrame(
    doc,
    rightX,
    y,
    COL_W,
    PROFILE_FRAME_H,
    profileJpeg && profileIsReal ? profileJpeg : beforeJpeg,
    tagProfile(),
    { cover: true },
  )
  y = Math.max(leftY, rightY) + SECTION_GAP

  // BEFORE/AFTER larger than before, but still smaller than the profile plate
  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, beforeJpeg, section.afterJpeg || null, 150, true)

  const furtherSub = subs[1]
    ? { ...subs[1], title: subs[1].title || 'Further Enhancement' }
    : null
  layoutBottomAnchoredLeftColumn(
    doc,
    furtherSub,
    pm('jawRegionSummary'),
    section.summary,
    y,
    rightX,
    COL_W,
    { bodyOffset: 22, drawTier: false },
  )
}

function drawLipsFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const previewSrc = slots.preview || section.beforeJpeg
  const pairBefore = slots.pairBefore || section.beforeJpeg
  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP

  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('lips'), 26) + 4

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Lips', subs[0].body, COL_W)
  // Square LIPS contour preview — full column width (and equal height)
  const lipsSquare = COL_W
  rightY = drawImageFrame(doc, rightX, rightY, lipsSquare, lipsSquare, previewSrc, tagLips(), {
    cover: true,
  })
  y = Math.max(leftY, rightY) + SECTION_GAP

  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, pairBefore, section.afterJpeg || null, 200, true)
  drawSummaryBar(doc, y, pm('featureSummary', { name: localizedFeaturePrimary('lips', activeReportT) }), section.summary)
}

/** Map 0–1 profile landmark into a center-cover PROFILE frame (inner padded box). */
function mapChinGuidePoint(
  profileSrc,
  frameX,
  frameY,
  frameW,
  frameH,
  nx,
  ny,
  pad = 4,
  coordSpace = 'image',
  poseId = null,
  cover = true
) {
  const boxX = frameX + pad
  const boxY = frameY + pad
  const boxW = frameW - pad * 2
  const boxH = frameH - pad * 2
  // Cover-space landmarks were detected on the same crop the plate shows — identity map.
  if (coordSpace === 'cover') {
    return { x: boxX + nx * boxW, y: boxY + ny * boxH }
  }
  const img = coverCropSession?.getImage?.(profileSrc)
  if (!img?.width || !img?.height) {
    return { x: boxX + nx * boxW, y: boxY + ny * boxH }
  }
  if (!cover) {
    const ratio = Math.min(boxW / img.width, boxH / img.height)
    const w = img.width * ratio
    const h = img.height * ratio
    const ox = boxX + (boxW - w) / 2
    const oy = boxY + (boxH - h) / 2
    return { x: ox + nx * w, y: oy + ny * h }
  }
  const customSx = coverCropSession?.getCropOffset?.(profileSrc) ?? null
  return mapNormThroughCover(nx, ny, img.width, img.height, boxX, boxY, boxW, boxH, poseId, customSx)
}

function clipSegToBox(a, b, box) {
  const pad = 8
  const inside = (p) =>
    p.x >= box.x - pad &&
    p.x <= box.x + box.w + pad &&
    p.y >= box.y - pad &&
    p.y <= box.y + box.h + pad
  return inside(a) || inside(b)
}

function guidesForChinFrame(
  profileSrc,
  frameW,
  frameH,
  rawOverlay,
  poseId = 'rightProfile',
  { style = 'thirds' } = {}
) {
  const pad = 4
  const boxW = frameW - pad * 2
  const boxH = frameH - pad * 2
  const img = coverCropSession?.getImage?.(profileSrc)

  const resolved = rawOverlay || (img ? resolveChinProjectionOverlay(img, poseId, boxW, boxH) : null)
  if (!resolved) return null

  if (style === 'projection') {
    return buildChinProjectionGuides(resolved, poseId)
  }

  return buildChinProfileGuides(resolved, poseId)
}

function drawChinProfileGuideOverlays(doc, profileSrc, frameX, frameY, frameW, frameH, guides, mode, poseId = null, cover = true) {
  if (!guides || !profileSrc) return
  const pad = 4
  const coordSpace = guides.coordSpace || 'image'
  const map = (nx, ny) =>
    mapChinGuidePoint(profileSrc, frameX, frameY, frameW, frameH, nx, ny, pad, coordSpace, poseId, cover)

  const drawLineWithOutline = (x1, y1, x2, y2, isDashed = false) => {
    // Dark outline pass for high contrast on light backgrounds
    doc.setDrawColor(20, 24, 33)
    doc.setLineWidth(2.6)
    if (isDashed) doc.setLineDashPattern([3, 2], 0)
    else doc.setLineDashPattern([], 0)
    doc.line(x1, y1, x2, y2)

    // Crisp white foreground pass
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(1.5)
    if (isDashed) doc.setLineDashPattern([3, 2], 0)
    else doc.setLineDashPattern([], 0)
    doc.line(x1, y1, x2, y2)
    doc.setLineDashPattern([], 0)
  }

  // Style 1: Nose Projection Lines (Top Image)
  if (mode === 'thirds' && guides.chinShow) {
    const c = guides.chinShow
    const nt = map(c.nose_tip.x, c.nose_tip.y)
    const sn = map(c.subnasale.x, c.subnasale.y)
    const ul = map(c.upper_lip.x, c.upper_lip.y)
    const ch = map(c.chin.x, c.chin.y)

    // Vertical line at nose tip's X coordinate, spanning from subnasale's Y to chin's Y
    drawLineWithOutline(nt.x, sn.y, nt.x, ch.y, false)

    // Horizontal dashed lines to the nose tip vertical line
    drawLineWithOutline(sn.x, sn.y, nt.x, sn.y, true)
    drawLineWithOutline(ul.x, ul.y, nt.x, ul.y, true)
    drawLineWithOutline(ch.x, ch.y, nt.x, ch.y, true)
  }

  // Style 2: E-line and True Verticals (Bottom Image)
  if (mode === 'projection' && guides.projection) {
    const p = guides.projection
    const nt = map(p.nose_tip.x, p.nose_tip.y)
    const sn = map(p.subnasale.x, p.subnasale.y)
    const nas = map(p.nasion.x, p.nasion.y)
    const ch = map(p.chin.x, p.chin.y)

    // ~20px offset in normalized height: (ch.y - sn.y) * 0.15
    const extraY = Math.max(15, (ch.y - sn.y) * 0.15)

    // Ricketts' E-line (nose tip to chin)
    drawLineWithOutline(nt.x, nt.y, ch.x, ch.y, false)

    // Zero Meridian (Vertical from Nasion)
    drawLineWithOutline(nas.x, nas.y, nas.x, ch.y + extraY, false)

    // Subnasale Perpendicular (Vertical from Subnasale)
    drawLineWithOutline(sn.x, sn.y, sn.x, ch.y + extraY, false)
  }
}

async function resolveChinProfileOverlay(cvReport, profileJpeg) {
  const poseId =
    cvReport?.profile?.primary?.poseId ||
    cvReport?.profile?.primaryView ||
    'rightProfile'
  const stored =
    cvReport?.profile?.primary?.overlay ||
    cvReport?.profile?.rightProfile?.overlay ||
    null
  if (profileJpeg) {
    try {
      const { landmarks } = await analyzeWithMediaPipe(profileJpeg)
      const fromMesh = overlayFromProfileLandmarks(landmarks)
      if (fromMesh) return { overlay: fromMesh, poseId }
    } catch {
      /* profile yaw often fails FaceMesh — fall through */
    }
  }
  return { overlay: stored, poseId }
}

async function drawChinFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('chin'), 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []
  const profileSrc = profileJpeg && profileIsReal ? profileJpeg : null
  const rawOverlay = section.profileOverlay
  const poseId = section.profilePoseId || 'rightProfile'

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Chin', subs[0]?.body, COL_W)
  let rightY = y

  if (profileSrc) {
    const showSrc = profileSrc

    const topAnnotated = await generateAnnotatedChinProfileImage(showSrc, 'thirds', poseId, rawOverlay, COL_W, CHIN_PROFILE_FRAME_H)
    const botAnnotated = await generateAnnotatedChinProfileImage(showSrc, 'projection', poseId, rawOverlay, COL_W, CHIN_PROFILE_FRAME_H)

    rightY = drawImageFrame(doc, rightX, rightY, COL_W, CHIN_PROFILE_FRAME_H, topAnnotated, tagProfile(), {
      cover: false,
      poseId,
    })

    rightY = drawImageFrame(doc, rightX, rightY, COL_W, CHIN_PROFILE_FRAME_H, botAnnotated, tagProfile(), {
      cover: false,
      poseId,
    })
  }

  y = Math.max(leftY, rightY) + SECTION_GAP
  // Pair sizing unchanged (profiles + B/A as today). Summary grows down into leftover only.
  const summaryReserve = 52
  const maxPairH = PAGE_BOTTOM - y - summaryReserve - IMAGE_TEXT_GAP
  const pairH = Math.min(120, Math.max(60, maxPairH))
  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, beforeJpeg, section.afterJpeg || null, pairH, true)
  drawSummaryBar(
    doc,
    y,
    pm('featureSummary', { name: localizedFeaturePrimary('chin', activeReportT) }),
    section.summary,
  )
}

function drawSkinFeaturePage(doc, section, pageNum, beforeJpeg, afterJpeg = null) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('skin'), 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  const diagH = 240
  const diagY = y
  // Half-split only: use face-aligned AFTER so midline features match. Side-by-side pair stays unaligned.
  const splitAfter = section.splitAfterJpeg || afterJpeg
  let leftY = drawSplitComparisonFrame(doc, MARGIN, diagY, COL_W, diagH, beforeJpeg, splitAfter, { gap: 10 })

  const introText = pm('skinIntro')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  let rightY = wrapText(doc, introText, rightX, y, COL_W, 11.5) + 12
  rightY = drawLabeledBody(doc, rightX, rightY, 'Skincare Protocol', subs[0]?.body, COL_W)

  // Vorher/Nachher sits under the split frame only — do not wait on right-column protocol height.
  const pairY = leftY + SECTION_GAP
  const pairBefore = section.imageSlots?.pairBefore || beforeJpeg
  leftY = drawBeforeAfterPair(doc, MARGIN, pairY, COL_W, pairBefore, afterJpeg, 150, true)
  if (subs[1]) {
    leftY = drawLabeledBody(
      doc,
      MARGIN,
      leftY,
      'Further Skin Enhancement',
      subs[1].body,
      COL_W,
      11.5,
      { maxBottom: PAGE_H - 1 },
    )
  }
  // Summary top-floor is below protocol (or pair row); stickToBottom keeps the mint card on the footer.
  drawSummaryCard(
    doc,
    rightX,
    Math.max(rightY + 8, pairY),
    COL_W,
    pm('featureSummary', { name: localizedFeaturePrimary('skin', activeReportT) }),
    section.summary,
  )
}

function drawNeckFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('neck'), 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Neck Size', subs[0]?.body, COL_W) + 16
  if (subs[1]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Neck Skin', subs[1].body, COL_W)

  let rightY = drawImageFrame(doc, rightX, y, COL_W, 240, beforeJpeg, tagBefore(), { cover: true })
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, 240, section.afterJpeg || null, tagAfter(), { cover: true })

  drawSummaryCard(doc, MARGIN, Math.max(leftY, rightY) + SECTION_GAP, COL_W, pm('featureSummary', { name: localizedFeaturePrimary('neck', activeReportT) }), section.summary)
}

function drawEarsFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum, activePdfT)
  let y = drawSplitTitle(doc, MARGIN, 85, ...featureSplit('ears'), 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Ear Structure', subs[0]?.body, COL_W)

  // Front-facing ear crop only — no measurement overlays for now
  let rightY = drawImageFrame(doc, rightX, y, COL_W, 220, beforeJpeg, tagBefore(), { cover: true })
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, 220, section.afterJpeg || null, tagAfter(), { cover: true })

  drawSummaryCard(doc, MARGIN, Math.max(leftY, rightY) + SECTION_GAP, COL_W, pm('featureSummary', { name: localizedFeaturePrimary('ears', activeReportT) }), section.summary)
}

function reportFeatureCopy(pdfMessages, zoneKey, field) {
  return pdfMessages?.Report?.executiveSummary?.featureRows?.[zoneKey]?.[field] ?? zoneKey
}

function reportPhaseCopy(pdfMessages, phaseKey, field) {
  return pdfMessages?.Report?.executiveSummary?.phases?.[phaseKey]?.[field] ?? ''
}

function reportPhaseItem(pdfMessages, phaseKey, index) {
  return pdfMessages?.Report?.executiveSummary?.phases?.[phaseKey]?.items?.[String(index)] ?? ''
}

function drawCompactRadarChart(doc, boxX, boxY, boxW, boxH, items) {
  const numAxes = items.length
  if (!numAxes) return

  const axisScore = (item) => {
    const n = Number(item?.score)
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0
  }

  const cx = boxX + boxW / 2
  const cy = boxY + boxH / 2 + 2
  const rMax = Math.min(boxW, boxH) / 2 - 16

  doc.setLineWidth(0.4)
  doc.setDrawColor(229, 231, 235)
  ;[0.4, 0.7, 1].forEach((scale) => {
    const pts = []
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
      pts.push([cx + rMax * scale * Math.cos(angle), cy + rMax * scale * Math.sin(angle)])
    }
    for (let i = 0; i < numAxes; i++) {
      const p1 = pts[i]
      const p2 = pts[(i + 1) % numAxes]
      doc.line(p1[0], p1[1], p2[0], p2[1])
    }
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  items.forEach((item, i) => {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
    const xLine = cx + rMax * Math.cos(angle)
    const yLine = cy + rMax * Math.sin(angle)
    doc.line(cx, cy, xLine, yLine)
    const cosVal = Math.cos(angle)
    const xLabel = cx + (rMax + 10) * cosVal
    const yLabel = cy + (rMax + 10) * Math.sin(angle) + 2
    let align = 'center'
    if (cosVal > 0.15) align = 'left'
    else if (cosVal < -0.15) align = 'right'
    setMuted(doc)
    doc.text(sanitizePdfText(item.label || ''), xLabel, yLabel, { align })
  })

  const pts = items.map((item, i) => {
    const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2
    const dist = rMax * (axisScore(item) / 100)
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) }
  })

  doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
  doc.setLineWidth(1.2)
  for (let i = 0; i < numAxes; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % numAxes]
    doc.line(p1.x, p1.y, p2.x, p2.y)
  }
}

function drawPanel(doc, x, y, w, h, radius = 4, fillRgb = null) {
  const fill = fillRgb || { r: 249, g: 250, b: 251 }
  doc.setFillColor(fill.r, fill.g, fill.b)
  if (fillRgb) doc.setDrawColor(200, 220, 214)
  else doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.4)
  doc.roundedRect(x, y, w, h, radius, radius, 'FD')
}

/** Page 1 — light-grey protocol dashboard (header + body; no action buttons). */
function drawProtocolDashboardPage1(doc, ctx) {
  const {
    t,
    pdfMessages,
    clientName,
    protocolId,
    reportDate,
    photoJpeg,
    overviewAfterJpeg,
    cvReport,
    metrics,
    answers,
    eyeAnalysis,
    protocolNarrative,
    aiNarrative,
    miniPreviews = {},
    featurePageById = {},
    createdAt = null,
    updatedAt = null,
    landmarks = null,
    locale = 'en',
  } = ctx

  const dash = buildProtocolDashboardData({
    cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt,
  })
  const reportT = createReportTranslator(pdfMessages)
  const tCv = createCvReportTranslator(pdfMessages)
  const treatment = resolveTreatmentPhases({ protocolNarrative, dash, t: reportT })
  const firstName = clientName.split(/\s+/)[0] || clientName
  const overviewText = protocolNarrative?.summary
    || aiNarrative?.content?.summary
    || ''
  const miniLinks = []

  // Full-page light grey (no mint frame / brand hairline)
  doc.setFillColor(PAGE1_BG.r, PAGE1_BG.g, PAGE1_BG.b)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')

  const pad = 22
  const innerRight = PAGE_W - pad
  const headerH = 36

  // Soft-grey header bar — PROTOCOL | meta left, MyFace centered, empty right (no buttons)
  doc.setFillColor(238, 240, 243)
  doc.rect(0, 0, PAGE_W, headerH, 'F')
  doc.setDrawColor(220, 223, 228)
  doc.setLineWidth(0.5)
  doc.line(0, headerH, PAGE_W, headerH)

  const headerY = Math.round(headerH / 2) + 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  setInk(doc)
  doc.text(t('dashProtocol'), pad, headerY)
  const protocolLabelW = doc.getTextWidth(t('dashProtocol'))
  doc.setDrawColor(209, 213, 219)
  doc.setLineWidth(0.5)
  doc.line(pad + protocolLabelW + 5, headerY - 4, pad + protocolLabelW + 5, headerY + 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  doc.text(`${clientName}  #${protocolId}  ${reportDate}`, pad + protocolLabelW + 12, headerY)

  const logoDataUrl = ctx.brandWordmarkDataUrl
  if (logoDataUrl) {
    const logoH = 12
    const logoW = 48
    try {
      doc.addImage(logoDataUrl, 'PNG', PAGE_W / 2 - logoW / 2, headerY - 9, logoW, logoH)
    } catch {
  doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
  setInk(doc)
      doc.text('MyFace', PAGE_W / 2, headerY - 1, { align: 'center' })
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    setInk(doc)
    doc.text('MyFace', PAGE_W / 2, headerY - 1, { align: 'center' })
  }

  let y = headerH + 22

  // KPI strip — labels/units muted/ink; numeric values brand green
  const kpiGap = 8
  const kpiW = (innerRight - pad - kpiGap * 2) / 3
  const kpiH = 48
  const evaluatedFull = dash.evaluatedPoints != null
      ? t('dashKpiEvaluatedValue', { count: dash.evaluatedPoints })
    : null
  const splitLeadingNum = (text) => {
    if (text == null) return null
    // Keep trailing + with the number (e.g. "170+ points")
    const m = String(text).match(/^(\d[\d,]*\+?)(.*)$/)
    if (!m) return [{ text: String(text), brand: false }]
    const parts = [{ text: m[1], brand: true }]
    if (m[2]) parts.push({ text: m[2], brand: false })
    return parts
  }
  const kpiRows = [
    {
      label: t('dashKpiOverall'),
      parts: dash.overallScore != null
        ? [
            { text: String(dash.overallScore), brand: true },
            { text: ' / 100', brand: false },
          ]
        : null,
    },
    {
      label: t('dashKpiEvaluated'),
      parts: splitLeadingNum(evaluatedFull),
    },
    {
      label: t('dashKpiAnalysisTime'),
      parts: analysisTimeDaysParts(dash.analysisTimeDays, reportT),
    },
  ]
  kpiRows.forEach(({ label, parts }, i) => {
    const kx = pad + i * (kpiW + kpiGap)
    drawPanel(doc, kx, y, kpiW, kpiH, 5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setMuted(doc)
    doc.text(label, kx + 8, y + 15)
    doc.setFontSize(13)
    let vx = kx + 8
    if (!parts) {
    setInk(doc)
      doc.text('—', vx, y + 36)
      return
    }
    parts.forEach(({ text, brand }) => {
      if (brand) setBrand(doc)
      else setInk(doc)
      doc.text(text, vx, y + 36)
      vx += doc.getTextWidth(text)
    })
  })
  y += kpiH + 18

  const footerY = PAGE_H - 18
  const bodyBottom = footerY - 12
  const colGap = 10
  const innerW = innerRight - pad
  // Left a bit wider for hero copy; right a bit narrower for treatment phases
  const leftW = Math.round(innerW * 0.30)
  const rightW = Math.round(innerW * 0.24)
  const centerW = innerW - leftW - rightW - colGap * 2
  const leftX = pad
  const centerX = leftX + leftW + colGap
  const rightX = centerX + centerW + colGap

  // Name / protocol plate — same box size; first name + protocol + assessed + overall score
  const namePlateW = leftW
  const namePlateH = Math.round(leftW * 0.72)
  const treatmentTop = y
  doc.setFillColor(FACE_MAP_BG.r, FACE_MAP_BG.g, FACE_MAP_BG.b)
  doc.roundedRect(leftX, y, namePlateW, namePlateH, 8, 8, 'F')
  const plateCx = leftX + namePlateW / 2
  // Pack four lines into the fixed plate height (centered stack, no box resize)
  const plateMid = y + namePlateH / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setWhite(doc)
  doc.text(firstName, plateCx, plateMid - 14, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  doc.setTextColor(255, 255, 255)
  doc.text(
    reportT('executiveSummary.protocolIdLine', { id: protocolId }),
    plateCx,
    plateMid - 3,
    { align: 'center' },
  )
  doc.setFontSize(4.5)
  doc.setTextColor(235, 238, 240)
  doc.text(
    reportT('executiveSummary.namePlateAssessed', { date: reportDate }),
    plateCx,
    plateMid + 7,
    { align: 'center' },
  )
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  setWhite(doc)
  doc.text(
    dash.overallScore != null
      ? reportT('executiveSummary.namePlateOverallScore', { score: dash.overallScore })
      : '—',
    plateCx,
    plateMid + 16,
    { align: 'center' },
  )
  y += namePlateH + 8

  // Hero — mirrors FeatureAnalysisHero: copy | portrait, metrics full-width below
  const heroH = 168
  const heroW = leftW
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.roundedRect(leftX, y, heroW, heroH, 7, 7, 'FD')
  const heroPad = 7
  const metricsBandH = 28
  const topBandH = heroH - metricsBandH - heroPad
  const heroImgW = Math.round((heroW - heroPad * 3) * 0.42)
  const heroImgH = topBandH - 2
  const heroImgX = leftX + heroW - heroPad - heroImgW
  const heroImgY = y + heroPad
  const heroTextX = leftX + heroPad
  const heroTextW = Math.max(36, heroImgX - heroTextX - heroPad)

  const heroPrefix = reportT('executiveSummary.heroTitlePrefix')
  const heroAccent = reportT('executiveSummary.heroTitleAccent')
  let textY = y + heroPad + 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const titleOneLine = `${heroPrefix} ${heroAccent}`
  if (doc.getTextWidth(sanitizePdfText(titleOneLine)) <= heroTextW) {
    setInk(doc)
    doc.text(sanitizePdfText(heroPrefix), heroTextX, textY)
    const pw = doc.getTextWidth(`${sanitizePdfText(heroPrefix)} `)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(sanitizePdfText(heroAccent), heroTextX + pw, textY)
    textY += 10
  } else {
    setInk(doc)
    doc.text(sanitizePdfText(heroPrefix), heroTextX, textY)
    textY += 9
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    const accentLines = doc.splitTextToSize(sanitizePdfText(heroAccent), heroTextW)
    doc.text(accentLines[0] || heroAccent, heroTextX, textY)
    textY += 10
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5)
  setMuted(doc)
  textY = wrapTextMaxLines(
    doc,
    reportT('executiveSummary.heroBody'),
    heroTextX,
    textY + 1,
    heroTextW,
    6,
    3,
  )

  textY += 5
  const heroFeatures = pdfMessages?.Report?.executiveSummary?.heroFeatures || {}
  const heroFeatureCount = Math.max(1, Math.min(3, Object.keys(heroFeatures).length || 0))
  for (let i = 0; i < heroFeatureCount; i += 1) {
    const featTitle = reportT(`executiveSummary.heroFeatures.${i}.title`)
    const featDetail = reportT(`executiveSummary.heroFeatures.${i}.detail`)
    const cy = textY + 2
    const featTextW = heroTextW - 12
    doc.setFillColor(219, 238, 232)
    doc.circle(heroTextX + 3.5, cy, 3.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(String(i + 1), heroTextX + 3.5, cy + 1.5, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    setInk(doc)
    const titleParts = doc.splitTextToSize(sanitizePdfText(featTitle), featTextW)
    doc.text(titleParts[0] || featTitle, heroTextX + 10, cy + 1)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4.5)
    setMuted(doc)
    const detailParts = doc.splitTextToSize(sanitizePdfText(featDetail), featTextW)
    doc.text(detailParts[0] || featDetail, heroTextX + 10, cy + 7)
    textY += 14
  }

  doc.setFillColor(232, 240, 238)
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(heroImgX, heroImgY, heroImgW, heroImgH, 5, 5, 'FD')
  let imgNatW = 0
  let imgNatH = 0
  if (photoJpeg) {
    try {
      const props = doc.getImageProperties(photoJpeg)
      imgNatW = props.width
      imgNatH = props.height
      addPdfImage(doc, photoJpeg, heroImgX + 1, heroImgY + 1, heroImgW - 2, heroImgH - 2, true)
    } catch {
      /* mint fill */
    }
  }
  const faceMapKey = {
    forehead: 'dashFaceMapForehead',
    eyes: 'dashFaceMapEyes',
    nose: 'dashFaceMapNose',
    mouth: 'dashFaceMapMouth',
  }
  const callouts = resolveFeaturePreviewCallouts(landmarks)
  const boxW = heroImgW - 2
  const boxH = heroImgH - 2
  callouts.forEach((c) => {
    const mapped = imgNatW && imgNatH
      ? mapCoverTopCenter(c.x, c.y, imgNatW, imgNatH, boxW, boxH)
      : { x: c.x, y: c.y }
    const ax = heroImgX + 1 + mapped.x * boxW
    const ay = heroImgY + 1 + mapped.y * boxH
    const lx = heroImgX + heroImgW - 3
    doc.setFillColor(255, 255, 255)
    doc.circle(ax, ay, 1.1, 'F')
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(0.35)
    doc.line(ax, ay, lx, ay)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(3.5)
    setInk(doc)
    const label = t(faceMapKey[c.id] || 'dashFaceMapNose')
    const tw = doc.getTextWidth(label) + 3
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.3)
    doc.roundedRect(lx - tw, ay - 2.4, tw, 5, 1.5, 1.5, 'FD')
    doc.text(label, lx - 1.5, ay + 1, { align: 'right' })
  })

  // Metrics band — same labels/values as interactive hero summary row
  const metricTop = y + heroH - metricsBandH
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.4)
  doc.line(leftX + heroPad, metricTop, leftX + heroW - heroPad, metricTop)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(4)
  setMuted(doc)
  doc.text(reportT('executiveSummary.heroSummaryLabel').toUpperCase(), leftX + heroPad, metricTop + 7)
  const metricVals = [
    [
      dash.overallScore != null ? `${dash.overallScore} / 100` : '—',
      t('dashKpiOverall'),
    ],
    [
      dash.evaluatedPoints
        ? t('dashKpiEvaluatedValue', { count: dash.evaluatedPoints })
        : '—',
      t('dashKpiEvaluated'),
    ],
    [
      formatAnalysisTimeDays(dash.analysisTimeDays, reportT) || '—',
      t('dashKpiAnalysisTime'),
    ],
  ]
  const metricColW = (heroW - heroPad * 2) / 3
  metricVals.forEach(([value, label], i) => {
    const mx = leftX + heroPad + i * metricColW
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setInk(doc)
    const clipped = String(value)
    doc.text(clipped.length > 14 ? `${clipped.slice(0, 13)}…` : clipped, mx, metricTop + 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(4)
    setMuted(doc)
    doc.text(label, mx, metricTop + 24)
  })

  y += heroH + 12

  const bodyH = bodyBottom - y
  const bodyTop = y

  // ── Left column: priority mini cards (same column as name + hero) ──
  let miniY = bodyTop
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  setMuted(doc)
  doc.text(reportT('executiveSummary.priorityFeatures'), leftX, miniY)
  miniY += 8
  const miniGap = 3
  const miniCards = dash.miniCards?.length ? dash.miniCards : []
  const availableMiniH = Math.max(0, bodyBottom - miniY)
  // Content-sized cards — no equal-height stretch (avoids empty whitespace)
  const estimateCardH = (card) => {
    const findings = (card.findings || []).filter((f) => f?.title).slice(0, 3)
    let h = 10 // padding / title row
    h += 8
    if (card.scoreLabel) h += 6
    if (findings.length) {
      h += 6
      h += findings.length * 8
    }
    return h + 4
  }
  let totalEst = miniCards.reduce((sum, c) => sum + estimateCardH(c), 0)
    + Math.max(0, miniCards.length - 1) * miniGap
  if (totalEst > availableMiniH && miniCards.length) {
    // Content already compact without thumbs — no further thumb shrink needed
    totalEst = miniCards.reduce((sum, c) => sum + estimateCardH(c), 0)
      + Math.max(0, miniCards.length - 1) * miniGap
  }
  miniCards.forEach((rawCard) => {
    const card = localizePriorityMiniCard(rawCard, { tReport: reportT, tCv, locale })
    const findings = (card.findings || []).filter((f) => f?.title).slice(0, 3)
    let cardH = estimateCardH(card)
    const remaining = bodyBottom - miniY
    if (remaining < 28) return
    cardH = Math.min(cardH, remaining)
    drawPanel(doc, leftX, miniY, leftW, cardH, 3)
    let textY = miniY + 10
    const miniTitleText = String(card.title || card.id)
    const scoreText = card.score ? String(card.score) : ''
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    setInk(doc)
    doc.text(miniTitleText, leftX + 5, textY)
    if (scoreText) {
      doc.text(scoreText, leftX + leftW - 5, textY, { align: 'right' })
    }
    textY += 7
    if (card.scoreLabel && textY < miniY + cardH - 2) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5)
      setMuted(doc)
      doc.text(String(card.scoreLabel), leftX + leftW - 5, textY, { align: 'right' })
      textY += 5
    }
    if (findings.length && textY < miniY + cardH - 4) {
      doc.setDrawColor(229, 231, 235)
      doc.line(leftX + 5, textY, leftX + leftW - 5, textY)
      textY += 6
      findings.forEach((finding) => {
        if (textY > miniY + cardH - 3) return
        const key = String(finding.title || '')
        const val = finding.detail != null && finding.detail !== '' ? String(finding.detail) : '—'
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(5)
        setInk(doc)
        doc.text(key, leftX + 5, textY)
        doc.setFont('helvetica', 'normal')
        setMuted(doc)
        doc.text(val, leftX + leftW - 5, textY, { align: 'right' })
        textY += 7
      })
    }
    const pageNumber = featurePageById[card.id] || card.pdfPage
    if (pageNumber) {
      miniLinks.push({ x: leftX, y: miniY, w: leftW, h: cardH, pageNumber })
    }
    miniY += cardH + miniGap
  })

  // ── Center column (proportional stack) ──
  let cy = treatmentTop
  const pairGap = 6
  // Center column height from name plate top down — fills beside hero + priority
  const pairH = Math.round((bodyBottom - treatmentTop) * 0.29)
  const halfW = (centerW - pairGap) / 2
  drawImageFrame(doc, centerX, cy, halfW, pairH, photoJpeg, t('dashBefore'), { cover: true, gap: 0, pdfT: t })
  drawImageFrame(doc, centerX + halfW + pairGap, cy, halfW, pairH, overviewAfterJpeg, t('dashPotential'), { cover: true, gap: 0, pdfT: t })
  cy += pairH + 8

  const ageH = 52
  drawPanel(doc, centerX, cy, centerW, ageH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setMuted(doc)
  doc.text(t('dashFacialAge'), centerX + 8, cy + 10)
  const faceAge = dash.faceAge
  const faceText = faceAge != null ? String(faceAge) : '—'
  doc.setFontSize(18)
  setInk(doc)
  doc.text(faceText, centerX + 10, cy + 32)

  const axisMin = 5
  let axisMax = 65
  if (faceAge != null) {
    axisMax = Math.max(axisMax, faceAge + 4)
  }
  const barX = centerX + 42
  const barW = centerW - 52
  const barY = cy + 22
  const barH = 4
  const toX = (val) => barX + ((val - axisMin) / (axisMax - axisMin)) * barW
  doc.setFillColor(226, 232, 240)
  doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F')
  if (faceAge != null) {
    const fx = toX(faceAge)
    doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
    doc.setLineWidth(1.1)
    doc.line(fx, barY - 2, fx, barY + barH + 12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(String(faceAge), fx, barY + barH + 18, { align: 'center' })
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(4.5)
  setMuted(doc)
  doc.text(String(axisMin), barX, barY + barH + 9)
  doc.text(String(Math.round(axisMax)), barX + barW, barY + barH + 9, { align: 'right' })
  cy += ageH + 8

  const stackH = bodyBottom - cy - 16
  const graphH = Math.floor(stackH * (1 / 3.35))
  const overviewH = Math.floor(stackH * (1.35 / 3.35))
  const tableH = stackH - graphH - overviewH

  drawPanel(doc, centerX, cy, centerW, graphH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setMuted(doc)
  doc.text(t('dashHarmonyProfile'), centerX + 8, cy + 12)
  const radarBoxW = Math.min(98, Math.round(centerW * 0.42))
  const radarItems = [
    { label: reportT('executiveSummary.radarAxesShort.symmetry'), score: dash.radarScores.symmetry },
    { label: reportT('executiveSummary.radarAxesShort.smoothness'), score: dash.radarScores.smoothness },
    { label: reportT('executiveSummary.radarAxesShort.jawline'), score: dash.radarScores.jawline },
    { label: reportT('executiveSummary.radarAxesShort.skin'), score: dash.radarScores.skin },
    { label: reportT('executiveSummary.radarAxesShort.volume'), score: dash.radarScores.volume },
    { label: reportT('executiveSummary.radarAxesShort.harmony'), score: dash.radarScores.harmony },
  ]
  const hasRadar = radarItems.some((item) => item.score != null)
  if (hasRadar) {
    drawCompactRadarChart(doc, centerX + (centerW - radarBoxW) / 2, cy + 14, radarBoxW, graphH - 22, radarItems)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setMuted(doc)
    doc.text('—', centerX + centerW / 2, cy + graphH / 2 + 2, { align: 'center' })
  }
  cy += graphH + 8

  drawPanel(doc, centerX, cy, centerW, overviewH)
  const overviewLineH = 7.5
  const overviewMaxLines = Math.max(4, Math.floor((overviewH - 28) / overviewLineH))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setMuted(doc)
  doc.text(t('dashOverview'), centerX + 8, cy + 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  setInk(doc)
  wrapTextMaxLines(doc, overviewText || '—', centerX + 8, cy + 22, centerW - 16, overviewLineH, overviewMaxLines)
  cy += overviewH + 8

  drawPanel(doc, centerX, cy, centerW, tableH)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  setMuted(doc)
  doc.text(t('dashFeatureEvaluation'), centerX + 8, cy + 12)
  const colZone = centerX + 8
  const colFinding = centerX + Math.round(centerW * 0.28)
  const colRef = centerX + Math.round(centerW * 0.58)
  ;[t('dashZone'), t('dashFinding'), t('dashReference')].forEach((h, i) => {
    doc.text(h, [colZone, colFinding, colRef][i], cy + 24)
  })
  let rowY = cy + 34
  const rowStep = Math.min(11, Math.floor((tableH - 38) / Math.max(1, dash.featureRows.length)))
  dash.featureRows.forEach((row) => {
    const localized = localizeFeatureRow(row, { tReport: reportT, tCv, locale })
    const finding = localized.finding || '—'
    const ref = localized.ref || '—'
    const findingText = sanitizePdfText(finding)
    const refText = sanitizePdfText(ref)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    setInk(doc)
    doc.text(reportFeatureCopy(pdfMessages, row.zoneKey, 'zone'), colZone, rowY)
    doc.setFont('helvetica', 'normal')
    setMuted(doc)
    doc.text(findingText.length > 28 ? `${findingText.slice(0, 27)}…` : findingText, colFinding, rowY)
    doc.text(refText.length > 22 ? `${refText.slice(0, 21)}…` : refText, colRef, rowY)
    rowY += rowStep
  })

  // ── Right column: treatment protocol (aligned with name plate, not below hero) ──
  const treatmentTitleBaseline = treatmentTop + 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  setMuted(doc)
  doc.text(t('dashTreatmentProtocol'), rightX, treatmentTitleBaseline)
  let ry = treatmentTitleBaseline + 12

  const phaseKeys = ['phase01', 'phase02', 'phase03'].filter((k) => treatment.phases?.[k])
  const phaseGap = 5
  const textX = rightX + 6
  const textW = rightW - 12
  const titleLineH = PHASE_CARD_LAYOUT.titleLineH
  const bodyLineH = PHASE_CARD_LAYOUT.bodyLineH
  const padTop = PHASE_CARD_LAYOUT.padTop
  const padBottom = PHASE_CARD_LAYOUT.padBottom
  const labelToTitle = PHASE_CARD_LAYOUT.labelToTitle
  const titleToDurationGap = PHASE_CARD_LAYOUT.titleToDurationGap
  const durationToDivider = PHASE_CARD_LAYOUT.durationToDivider
  const dividerToItems = PHASE_CARD_LAYOUT.dividerToItems

  const summaryLineH = 7
  const summaryGap = 10
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  const summaryFullLines = treatment.summary
    ? doc.splitTextToSize(sanitizePdfText(treatment.summary), rightW)
    : []
  // Reserve up to 4 lines for summary so phase cards don't eat the footer band.
  const summaryReserve = summaryFullLines.length
    ? Math.min(4, summaryFullLines.length) * summaryLineH + summaryGap
    : 0

  const columnBudget = Math.max(40, bodyBottom - 8 - ry - summaryReserve)
  const layouts = layoutTreatmentPhaseCards(doc, {
    phaseKeys,
    phases: treatment.phases,
    textW,
    columnBudget,
    phaseGap,
  })

  layouts.forEach((layout) => {
    const drawH = layout.height

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(236, 236, 236)
    doc.roundedRect(rightX, ry, rightW, drawH, 4, 4, 'FD')

    let cursorY = ry + padTop
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(
      layout.phase?.label || reportPhaseCopy(pdfMessages, layout.phaseKey, 'label'),
      textX,
      cursorY,
    )

    cursorY += labelToTitle
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setInk(doc)
    layout.titleLines.forEach((line, i) => {
      doc.text(line, textX, cursorY + i * titleLineH)
    })
    cursorY += layout.titleLines.length * titleLineH + titleToDurationGap

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    setMuted(doc)
    layout.durationLines.forEach((line, i) => {
      doc.text(line, textX, cursorY + i * bodyLineH)
    })
    cursorY += layout.durationLines.length * bodyLineH + durationToDivider

    doc.setDrawColor(236, 236, 236)
    doc.line(textX, cursorY, rightX + rightW - 6, cursorY)
    cursorY += dividerToItems

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    setInk(doc)
    const contentBottom = ry + drawH - padBottom
    layout.itemLineGroups.forEach((lines) => {
      if (!lines.length) return
      // Whole bullet only — if the last line baseline would pass the card floor, drop the bullet.
      const lastBaseline = cursorY + (lines.length - 1) * bodyLineH
      if (lastBaseline > contentBottom) return
      lines.forEach((line) => {
        doc.text(line, textX, cursorY)
        cursorY += bodyLineH
      })
    })

    ry += drawH + phaseGap
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  setMuted(doc)
  if (treatment.summary && ry < bodyBottom - 12) {
    const summaryMaxLines = Math.max(1, Math.floor((bodyBottom - 12 - ry) / summaryLineH))
    const summaryLines = splitTextWordBoundary(doc, treatment.summary, rightW, summaryMaxLines)
    summaryLines.forEach((line, i) => {
      doc.text(line, rightX, ry + 2 + i * summaryLineH)
    })
  }

  // Footer
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  setMuted(doc)
  doc.text('—', pad, footerY)
  doc.text(
    t('dashFooterMetrics', {
      points: String(dash.evaluatedPoints || '—'),
    }),
    innerRight,
    footerY,
    { align: 'right' },
  )

  return { miniLinks }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Build MyFace report-style aesthetic protocol PDF (same generator as download).
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function buildMyFacePdf({
  photo,
  photos,
  cvReport,
  metrics,
  landmarks,
  protocolNarrative,
  answers,
  eyeAnalysis,
  aiNarrative,
  user = null,
  assessmentOwner = null,
  projectedAfter = null,
  projectedAnalysis = null,
  assessmentId = null,
  createdAt = null,
  updatedAt = null,
  pdfT = defaultPdfT,
  pdfMessages = null,
  locale = 'en',
}) {
  if (!photo || !cvReport) throw new Error(pdfT('missingData'))
  const t = pdfMessages ? createPdfTranslator(pdfMessages) : pdfT
  activePdfT = t
  activeReportT = createReportTranslator(pdfMessages)

  const photoJpeg = await normalizeToJpegDataUrl(photo)
  const afterUrl = resolveProjectedAfterUrl(projectedAfter)
  const afterLandmarks = resolveAfterLandmarks(projectedAnalysis)
  const afterCv = resolveAfterCvPayload(projectedAnalysis)
  let afterJpeg = null
  if (afterUrl) {
    try {
      afterJpeg = await normalizeToJpegDataUrl(afterUrl)
    } catch (err) {
      console.warn('[MyFace] Projected AFTER image failed to load for PDF:', afterUrl, err)
    }
  }

  // Overview pair: warp AFTER onto BEFORE canvas so frame cover matches face scale (no squeeze).
  let overviewAfterJpeg = afterJpeg
  if (photoJpeg && afterJpeg) {
    try {
      overviewAfterJpeg = await alignAfterToBefore(photoJpeg, afterJpeg)
    } catch (err) {
      console.warn('[MyFace] Overview AFTER align failed; using unaligned AFTER', err)
      overviewAfterJpeg = afterJpeg
    }
  }
  const [featurePages, norwoodImages] = await Promise.all([
    Promise.resolve(buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative, locale, activeReportT)),
    loadBaldnessStageImages(answers).catch(() => []),
  ])

  const featureImages = await resolveAllFeatureImages({
    featurePages,
    photoJpeg,
    landmarks,
    cvReport,
    eyeAnalysis,
    photos,
    lipPreviewMask: 'contour',
  })

  const featureAfterImages = afterJpeg
    ? await resolveAllFeatureAfterImages({
        featurePages,
        afterFullUrl: afterJpeg,
        beforeFullUrl: photoJpeg,
        landmarks,
        afterLandmarks,
        afterCvReport: afterCv?.cvReport || null,
        afterEyeAnalysis: afterCv?.eyeAnalysis || null,
        forPdf: true,
      })
    : {}

  const sectionPairs = featurePages.map((page) => ({
    ...page,
    beforeJpeg: featureImages[page.id]?.before || null,
    imageSlots: featureImages[page.id]?.slots || {},
    profileJpeg: featureImages[page.id]?.profile || null,
    profileIsReal: featureImages[page.id]?.profileIsReal ?? false,
    profileOverlay: null,
    afterJpeg: featureAfterImages[page.id] || afterJpeg,
    splitAfterJpeg: null,
  }))

  // Skin half-split only: warp full AFTER onto skin BEFORE canvas (BEFORE unchanged).
  // BEFORE here is the wide cheek crop (imageSlots.before), NOT the tight side-by-side pair crop.
  const skinSection = sectionPairs.find((p) => p.id === 'skin')
  if (skinSection?.beforeJpeg && (afterJpeg || skinSection.afterJpeg)) {
    try {
      skinSection.splitAfterJpeg = await alignAfterToBefore(
        skinSection.beforeJpeg,
        afterJpeg || skinSection.afterJpeg
      )
    } catch (err) {
      console.warn('[MyFace] Skin split AFTER align failed; using unaligned AFTER', err)
      skinSection.splitAfterJpeg = skinSection.afterJpeg
    }
  }

  // Warm HTMLImages so cover frames can canvas-crop (no jsPDF clip).
  coverCropSession = createCoverCropSession()
  const warmUrls = [photoJpeg, afterJpeg, overviewAfterJpeg]
  for (const page of sectionPairs) {
    warmUrls.push(page.beforeJpeg, page.profileJpeg, page.afterJpeg, page.splitAfterJpeg)
    const slots = page.imageSlots || {}
    for (const v of Object.values(slots)) {
      if (typeof v === 'string') warmUrls.push(v)
    }
  }
  await coverCropSession.warm(warmUrls)

  const chinSection = sectionPairs.find((p) => p.id === 'chin')
  if (chinSection) {
    const resolved = await resolveChinProfileOverlay(
      cvReport,
      chinSection.profileJpeg || photoJpeg
    )
    chinSection.profileOverlay = resolved?.overlay ?? null
    chinSection.profilePoseId = resolved?.poseId || 'rightProfile'
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  wrapJsPdfTextSanitizer(doc)
  let y = 0
  const clientName = getClientName(answers, user, assessmentOwner)
  const monthLabel = formatProtocolMonth(undefined, locale)
  const closingParagraphs = buildClosingRecommendations(
    aiNarrative,
    cvReport,
    clientName,
    protocolNarrative,
    locale,
    activeReportT,
  )
  const closingCols = buildClosingColumns(closingParagraphs)
  const contents = buildProtocolContents(clientName, activeReportT)
  const chartItems = getFeatureComparisonData(cvReport).map((item) => ({
    ...item,
    label: pm(`chartAxes.${item.id}`) || item.label,
  }))

  try {
  const protocolId = formatProtocolId(assessmentId)
  const reportDateSource = updatedAt || createdAt
  const reportDateMs = reportDateSource ? Date.parse(reportDateSource) : NaN
  const reportDate = Number.isFinite(reportDateMs)
    ? new Date(reportDateMs).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'

  // ── Page 1: Protocol dashboard (mint clinical overview) ──
  const featurePageById = Object.fromEntries(sectionPairs.map((s, i) => [s.id, 6 + i]))
  const miniPreviews = Object.fromEntries(
    sectionPairs.map((s) => [
      s.id,
      s.imageSlots?.preview || s.imageSlots?.pairBefore || s.beforeJpeg || featureImages[s.id]?.before || photoJpeg,
    ]),
  )
  const { miniLinks = [] } = drawProtocolDashboardPage1(doc, {
    t,
    pdfMessages,
    clientName,
    protocolId,
    reportDate,
    photoJpeg,
    overviewAfterJpeg,
    cvReport,
    metrics,
    answers,
    eyeAnalysis,
    protocolNarrative,
    aiNarrative,
    miniPreviews,
    featurePageById,
    createdAt,
    updatedAt,
    landmarks,
    locale,
  }) || {}

  // ── Page 2: Disclaimer + Privacy (two columns) ──
  doc.addPage()
  drawHeader(doc, 2, t)
  y = drawSplitTitle(doc, MARGIN, 85, t('disclaimer'), t('policy'), 26)

  // Draw vertical separator line down the middle
  doc.setDrawColor(236, 236, 236) // #ECECEC
  doc.setLineWidth(0.75)
  doc.line(PAGE_W / 2, 150, PAGE_W / 2, PAGE_H - 120)

  // Start column headers
  let columnHeaderY = 155
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text(t('disclaimerPolicy'), MARGIN, columnHeaderY)
  doc.text(t('privacyPolicy'), MARGIN + COL_W + COL_GAP, columnHeaderY)

  // Draw paragraphs
  let leftY = columnHeaderY + 18
  let rightY = columnHeaderY + 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  
  // Disclaimer paragraphs
  DISCLAIMER_PARAGRAPH_KEYS.forEach((key, idx) => {
    if (idx === DISCLAIMER_PARAGRAPH_KEYS.length - 1) {
      doc.setFont('helvetica', 'bold')
      setInk(doc)
    } else {
      doc.setFont('helvetica', 'normal')
      setInk(doc)
    }
    leftY = wrapText(doc, activeReportT(key), MARGIN, leftY, COL_W, 11.5) + 10
  })

  // Privacy paragraphs
  doc.setFont('helvetica', 'normal')
  PRIVACY_PARAGRAPH_KEYS.forEach((key) => {
    rightY = wrapText(doc, activeReportT(key), MARGIN + COL_W + COL_GAP, rightY, COL_W, 11.5) + 10
  })

  // Clickable Privacy Policy URL link at the bottom of the column
  doc.setFontSize(8)
  rightY = drawWrappedPrivacyLink(
    doc,
    MARGIN + COL_W + COL_GAP,
    rightY,
    COL_W,
    t('readPrivacyPrefix'),
    t('privacyLink'),
    PRIVACY_POLICY_URL,
    11.5,
  )

  // Bottom signature block at the bottom of the right column (left-aligned within the column)
  const signatureY = PAGE_H - 110
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text(t('companyName'), MARGIN + COL_W + COL_GAP, signatureY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text(t('commissionedFor'), MARGIN + COL_W + COL_GAP, signatureY + 12)
  doc.text(t('commissionedOn', { name: clientName, month: monthLabel }), MARGIN + COL_W + COL_GAP, signatureY + 24)

  // ── Page 3: Introduction + Contents (two columns) ──
  doc.addPage()
  drawHeader(doc, 3, t)
  y = drawSplitTitle(doc, MARGIN, 85, pm('introduction'), null, 26)

  // Draw vertical separator line
  doc.setDrawColor(236, 236, 236) // #ECECEC
  doc.setLineWidth(0.75)
  doc.line(PAGE_W / 2, 130, PAGE_W / 2, PAGE_H - 120)

  // Columns start at y=140
  const colStartY = 140
  
  // Left column top (Introduction)
  leftY = colStartY
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  INTRODUCTION_PARAGRAPH_KEYS.forEach((key) => {
    leftY = wrapText(doc, activeReportT(key), MARGIN, leftY, COL_W, 11.5) + 10
  })

  // Horizontal divider in left column
  const dividerY = 410
  doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.75)
  doc.line(MARGIN, dividerY, MARGIN + COL_W, dividerY)

  // Left column bottom (Limitations)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text(pm('limitationsLabel'), MARGIN, dividerY + 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, activeReportT(LIMITATIONS_PARAGRAPH_KEY), MARGIN, dividerY + 34, COL_W, 11.5)

  // Right column (Contents)
  rightY = colStartY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text(pm('contents'), MARGIN + COL_W + COL_GAP, rightY)
  rightY += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  contents.forEach((item) => {
    setInk(doc)
    doc.text(item.label, MARGIN + COL_W + COL_GAP, rightY)
    setMuted(doc)
    doc.text(String(item.page).padStart(2, '0'), PAGE_W - MARGIN, rightY, { align: 'right' })
    rightY += 18
  })

  // ── Page 4: Understanding the Results ──
  doc.addPage()
  drawHeader(doc, 4, t)
  y = drawSplitTitle(doc, MARGIN, 85, pm('understandingPrimary'), pm('understandingSecondary'), 28)

  // Horizontal divider below the title
  doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.75)
  doc.line(MARGIN, 138, PAGE_W - MARGIN, 138)

  UNDERSTANDING_RESULTS_KEYS.forEach((key, idx) => {
    const full = activeReportT(key)
    const splitAt = full.indexOf('. ')
    const bold = splitAt > 0 ? full.slice(0, splitAt + 1) : full
    const normal = splitAt > 0 ? full.slice(splitAt + 2) : ''
    const blockY = 172 + idx * 140

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(44)
    doc.setTextColor(215, 222, 228)
    doc.text(String(idx + 1).padStart(2, '0'), MARGIN, blockY + 32)

    // Wider gap between the large number and the copy column
    const numGap = 78
    const textX = MARGIN + numGap
    const textW = CONTENT_W - numGap

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setInk(doc)
    const boldLines = doc.splitTextToSize(bold, textW)
    boldLines.forEach((line, i) => {
      doc.text(line, textX, blockY + 10 + i * 15)
    })

    let textY = blockY + 10 + boldLines.length * 15 + 5

    if (normal) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setMuted(doc)
      const normalLines = doc.splitTextToSize(normal, textW)
      normalLines.forEach((line, i) => {
        doc.text(line, textX, textY + i * 13)
      })
    }
  })

  // ── Page 5: Client protocol overview ──
  doc.addPage()
  drawHeader(doc, 5, t)
  y = drawSplitTitle(
    doc,
    MARGIN,
    85,
    locale === 'de' ? clientName : `${clientName}'s`,
    pm('protocolSecondary'),
    26,
  )

  // Tall side-by-side BEFORE / AFTER portraits
  const rightX = MARGIN + COL_W + COL_GAP
  const protocolPairH = 360
  const protocolPairY = 140
  drawImageFrame(doc, MARGIN, protocolPairY, COL_W, protocolPairH, photoJpeg, tagBefore(), {
    cover: true,
  })
  drawImageFrame(doc, rightX, protocolPairY, COL_W, protocolPairH, overviewAfterJpeg, tagAfter(), {
    cover: true,
  })

  const textY = protocolPairY + protocolPairH + IMAGE_TEXT_GAP

  // Description text below BEFORE / AFTER — height follows wrapped German copy
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  const leadLeftEnd = wrapText(doc, pm('protocolLeadBefore'), MARGIN, textY, COL_W, 11)
  const leadRightEnd = wrapText(doc, pm('protocolLeadAfter'), rightX, textY, COL_W, 11)

  const bottomY = Math.max(leadLeftEnd, leadRightEnd) + 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setInk(doc)
  doc.text(pm('projectedPotential').split(' · ')[0] || pm('projectedPotential'), MARGIN, bottomY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  const introEndY = wrapText(doc, pm('protocolFeaturesIntro'), MARGIN, bottomY + 16, COL_W, 10)

  const listCol1 = [
    localizedFeaturePrimary('hair', activeReportT),
    pm('contentsEyebrows'),
    pm('contentsEyes'),
    localizedFeaturePrimary('nose', activeReportT),
    pm('contentsCheeks'),
    localizedFeaturePrimary('jaw', activeReportT),
  ]
  const listCol2 = ['lips', 'chin', 'skin', 'neck', 'ears'].map((id) =>
    localizedFeaturePrimary(id, activeReportT),
  )
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  const listY = Math.max(bottomY + 32, introEndY + 4)
  listCol1.forEach((label, i) => {
    doc.text(`•  ${label}`, MARGIN, listY + i * 12)
  })
  listCol2.forEach((label, i) => {
    doc.text(`•  ${label}`, MARGIN + 120, listY + i * 12)
  })

  // Draw vector radar chart in right column
  const cx = rightX + COL_W / 2
  const cy = bottomY + 55
  const rMax = 42
  drawRadarChart(doc, cx, cy, rMax, chartItems)

  // ── Per-feature pages ──
  let featurePageNum = 6
  for (const section of sectionPairs) {
    doc.addPage()
    if (section.id === 'hair') {
      drawHairFeaturePage(doc, section, featurePageNum, section.beforeJpeg, norwoodImages)
    } else if (section.id === 'eyes') {
      drawEyesFeaturePage(doc, section, featurePageNum)
    } else if (section.id === 'nose') {
      drawNoseFeaturePage(doc, section, featurePageNum, section.beforeJpeg, section.profileJpeg, section.profileIsReal)
    } else if (section.id === 'cheeks') {
      drawCheeksFeaturePage(doc, section, featurePageNum)
    } else if (section.id === 'jaw') {
      drawJawFeaturePage(doc, section, featurePageNum, section.imageSlots?.pairBefore || section.beforeJpeg, section.profileJpeg, section.profileIsReal)
    } else if (section.id === 'lips') {
      drawLipsFeaturePage(doc, section, featurePageNum)
    } else if (section.id === 'chin') {
      await drawChinFeaturePage(doc, section, featurePageNum, section.beforeJpeg, section.profileJpeg, section.profileIsReal)
    } else if (section.id === 'skin') {
      drawSkinFeaturePage(doc, section, featurePageNum, section.beforeJpeg, section.afterJpeg)
    } else if (section.id === 'neck') {
      drawNeckFeaturePage(doc, section, featurePageNum, section.beforeJpeg)
    } else if (section.id === 'ears') {
      drawEarsFeaturePage(doc, section, featurePageNum, section.beforeJpeg)
    } else {
      drawFeaturePage(doc, section, featurePageNum, section.beforeJpeg, section.profileJpeg, section.profileIsReal)
    }
    featurePageNum += 1
  }

  // Dashboard mini-cards → feature page GoTo links (after pages exist)
  if (miniLinks.length) {
    const lastPage = doc.getNumberOfPages()
    doc.setPage(1)
    miniLinks.forEach(({ x, y, w, h, pageNumber }) => {
      doc.link(x, y, w, h, { pageNumber })
    })
    doc.setPage(lastPage)
  }

  // ── Page 16: Closing Recommendations (two columns) ──
  doc.addPage()
  drawHeader(doc, 16, t)
  y = drawSplitTitle(doc, MARGIN, 78, pm('closingPrimary'), pm('recommendations'), 20)
  y += 12

  doc.setDrawColor(229, 231, 235)
  doc.line(MARGIN + COL_W + COL_GAP / 2, y, MARGIN + COL_W + COL_GAP / 2, PAGE_H - 60)

  leftY = y
  rightY = y
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  closingCols.left.forEach((para) => {
    leftY = wrapText(doc, para, MARGIN, leftY, COL_W, 11) + 10
  })
  closingCols.right.forEach((para) => {
    rightY = wrapText(doc, para, MARGIN + COL_W + COL_GAP, rightY, COL_W, 11) + 10
  })

  const safeName = clientName.replace(/[^\w\s-]/g, '').trim() || 'Client'
  const filename = `MyFace-Protocol-${safeName.replace(/\s+/g, '-')}.pdf`
  const blob = doc.output('blob')
  return { blob, filename }
  } finally {
    coverCropSession = null
    activePdfT = defaultPdfT
    activeReportT = createReportTranslator()
  }
}

/** Generate and download MyFace report-style aesthetic protocol PDF. */
export async function downloadMyFacePdf(opts) {
  const { blob, filename } = await buildMyFacePdf(opts)
  triggerBlobDownload(blob, filename)
}

export { createPdfTranslator, defaultPdfT } from './pdfI18n'
