/**
 * Verbatim copy of reportPdf.js text-clip helpers for HTML preview parity.
 * reportPdf.js is left unchanged — keep this in sync by hand when PDF clip changes.
 */
import { jsPDF } from 'jspdf'

/* Same sheet constants as reportPdf.js */
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2
const COL_GAP = 20
const COL_W = (CONTENT_W - COL_GAP) / 2
const BODY_LINE_H = 11.5
const SUMMARY_PAD = 12
const SUMMARY_TITLE_BLOCK = 30
const SUMMARY_BAR_LINE_H = 12
const SUMMARY_BAR_BODY_TOP = 16

const SUMMARY_CARD_MIN_H = 110
const PAGE_BOTTOM = PAGE_H - 56

export const PDF_COL_W = COL_W
export const PDF_BODY_LINE_H = BODY_LINE_H
export const PDF_PAGE_H = PAGE_H
export const PDF_PAGE_BOTTOM = PAGE_BOTTOM
export const PDF_SUMMARY_CARD_MIN_H = SUMMARY_CARD_MIN_H

/** Copy of reportPdf.sanitizePdfText */
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

/** Copy of reportPdf.wrapJsPdfTextSanitizer */
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

/** Copy of reportPdf.splitTextMaxLines */
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

/**
 * Keep full sentences that fit in maxBodyHeight; drop the rest.
 * If even the first sentence is too long, keep that first sentence intact
 * (no mid-word line clip — DE often glues sentences as "wollen.Ein").
 * Must stay in sync with reportPdf.truncateAtSentences.
 */
export function truncateAtSentences(doc, text, maxW, maxBodyHeight, lineH = 11.5) {
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

/** Copy of reportPdf.splitTextAtSentences */
export function splitTextAtSentences(doc, text, maxW, maxLines, lineH) {
  const truncated = truncateAtSentences(doc, text, maxW, maxLines * lineH, lineH)
  if (!truncated) return []
  return doc.splitTextToSize(sanitizePdfText(truncated), maxW).map((line) => sanitizePdfText(line))
}

let measureDoc = null

function getMeasureDoc(fontSize = 8, style = 'normal') {
  if (!measureDoc) {
    measureDoc = new jsPDF({ unit: 'pt', format: 'a4' })
    wrapJsPdfTextSanitizer(measureDoc)
  }
  measureDoc.setFont('helvetica', style)
  measureDoc.setFontSize(fontSize)
  return measureDoc
}

/** Merkmalsbewertung bullet — same 6.5pt / 5-line sentence clip as page-1 PDF. */
export const FEATURE_HIGHLIGHT_MAX_LINES = 5
export const FEATURE_HIGHLIGHT_LINE_H = 7.5
/** Approximate right-column text width on protocol page 1 (~0.21 of content − pad). */
export const FEATURE_HIGHLIGHT_TEXT_W = 95

export function truncateFeatureHighlightBullet(text, {
  maxLines = FEATURE_HIGHLIGHT_MAX_LINES,
  maxW = FEATURE_HIGHLIGHT_TEXT_W,
  lineH = FEATURE_HIGHLIGHT_LINE_H,
} = {}) {
  const doc = getMeasureDoc(6.5, 'normal')
  return truncateAtSentences(doc, text, maxW, maxLines * lineH, lineH)
}

/** Column body — same COL_W / 11.5 as drawLabeledBody + layoutBottomAnchoredLeftColumn. */
export function truncatePdfBody(text, maxBodyHeight) {
  const doc = getMeasureDoc(8, 'normal')
  return truncateAtSentences(doc, text, COL_W, maxBodyHeight, BODY_LINE_H)
}

/** Mint summary card — same titleBlock 30 + pad 12 + textW as drawSummaryCard. */
export function truncatePdfSummaryCard(text, cardH) {
  const doc = getMeasureDoc(8, 'normal')
  const textW = COL_W - SUMMARY_PAD * 2
  const maxBodyHeight = cardH - SUMMARY_TITLE_BLOCK - SUMMARY_PAD
  return truncateAtSentences(doc, text, textW, maxBodyHeight, BODY_LINE_H)
}

/** Full-width mint bar — same titleColW / bodyW / lineH as drawSummaryBar. */
export function truncatePdfSummaryBar(text, barH, title) {
  const doc = getMeasureDoc(9, 'bold')
  const measuredTitleW = doc.getTextWidth(title || '')
  const titleColW = Math.min(Math.max(112, measuredTitleW + SUMMARY_PAD), CONTENT_W * 0.42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const bodyW = Math.max(120, CONTENT_W - titleColW - 10 - SUMMARY_PAD)
  const maxBodyHeight = barH - SUMMARY_BAR_BODY_TOP - SUMMARY_PAD
  return truncateAtSentences(doc, text, bodyW, maxBodyHeight, SUMMARY_BAR_LINE_H)
}

/**
 * Copy of reportPdf.drawSummaryCard sizing + sentence clip (no draw).
 * stickToBottom pins card bottom to PAGE_BOTTOM; returns truncated summary + geometry.
 */
export function measureSummaryCard(summary, topFloor, {
  minH = SUMMARY_CARD_MIN_H,
  pad = SUMMARY_PAD,
  lineH = BODY_LINE_H,
  maxBottom = PAGE_BOTTOM,
  stickToBottom = true,
  w = COL_W,
} = {}) {
  const doc = getMeasureDoc(8, 'normal')
  const textW = w - pad * 2
  const lines = doc.splitTextToSize(summary || '', textW)
  const titleBlock = SUMMARY_TITLE_BLOCK
  const neededH = Math.max(minH, titleBlock + Math.max(lines.length, 1) * lineH + pad)
  const floor = Math.max(80, topFloor)
  const growCap = PAGE_H - 1
  const bottomEdge = stickToBottom ? Math.min(maxBottom, growCap) : growCap
  const leftover = Math.max(0, bottomEdge - floor)
  const compactH = Math.min(minH, leftover || minH)
  const wantsGrow = neededH > minH + 0.5

  let cardY
  let cardH
  if (wantsGrow) {
    cardH = Math.max(36, leftover)
    cardY = stickToBottom ? bottomEdge - cardH : floor
    if (cardY < floor) {
      cardY = floor
      cardH = Math.max(36, leftover)
    }
  } else {
    cardH = Math.max(36, compactH)
    if (stickToBottom) {
      cardY = bottomEdge - cardH
      if (cardY < floor) {
        cardY = floor
        cardH = Math.max(36, Math.min(cardH, leftover))
      }
    } else {
      cardY = floor
    }
  }
  if (cardY + cardH > bottomEdge) {
    cardH = Math.max(36, bottomEdge - cardY)
  }

  const maxLines = Math.max(1, Math.floor((cardH - titleBlock - pad) / lineH))
  const truncated = truncateAtSentences(doc, summary, textW, maxLines * lineH, lineH)
  const visible = truncated
    ? doc.splitTextToSize(truncated, textW)
    : []
  if (wantsGrow) {
    cardH = Math.min(
      leftover,
      Math.max(compactH, titleBlock + Math.max(visible.length, 1) * lineH + pad),
    )
    if (stickToBottom) {
      cardY = bottomEdge - cardH
      if (cardY < floor) {
        cardY = floor
        cardH = Math.max(36, bottomEdge - cardY)
      }
    }
  }

  return {
    cardY,
    cardH,
    bottom: cardY + cardH,
    summary: truncated,
  }
}

/**
 * Copy of reportPdf.layoutBottomAnchoredLeftColumn clip math (no draw).
 * Returns truncated body + summary and title/card geometry for HTML positioning.
 */
export function layoutBottomAnchoredClip(
  bodyText,
  summaryText,
  topFloor,
  { bodyOffset = 18, lineH = BODY_LINE_H, drawTier = false } = {},
) {
  const card = measureSummaryCard(summaryText, topFloor, { stickToBottom: true, maxBottom: PAGE_BOTTOM })
  const tierH = drawTier ? 12 : 0
  const growCap = PAGE_H - 1

  let titleY = Math.max(topFloor, card.cardY + 16)
  let maxBodyHeight = growCap - titleY - bodyOffset - tierH
  if (maxBodyHeight < lineH * 2) {
    titleY = topFloor
    maxBodyHeight = growCap - titleY - bodyOffset - tierH
  }
  maxBodyHeight = Math.max(lineH, maxBodyHeight)

  const doc = getMeasureDoc(8, 'normal')
  const body = truncateAtSentences(doc, bodyText || '', COL_W, maxBodyHeight, lineH)

  return {
    body,
    summary: card.summary,
    titleY,
    titlePad: Math.max(0, titleY - topFloor),
    cardY: card.cardY,
    cardH: card.cardH,
    cardTop: Math.max(0, card.cardY - topFloor),
    maxBodyHeight,
    topFloor,
  }
}

/** ponytail: node artifacts/myface/utils/pdfTextFit.js */
export function selfCheckPdfTextFit() {
  const doc = getMeasureDoc(8, 'normal')
  // Narrow width so each sentence needs its own line (mirrors PDF line budget).
  const narrow = 55
  const one = truncateAtSentences(doc, 'One done. Two done. Three extra.', narrow, BODY_LINE_H, BODY_LINE_H)
  if (one !== 'One done.') throw new Error(`pdfTextFit: expected first sentence, got ${JSON.stringify(one)}`)
  const two = truncateAtSentences(doc, 'One done. Two done. Three extra.', narrow, BODY_LINE_H * 2, BODY_LINE_H)
  if (two !== 'One done. Two done.') {
    throw new Error(`pdfTextFit: expected two sentences, got ${JSON.stringify(two)}`)
  }
  // DE missing space after period must still stop on a full sentence (not mid-word "können").
  const glued = 'First done.Second starts here and runs long. Third stays out.'
  const gluedKept = truncateAtSentences(doc, glued, narrow, BODY_LINE_H, BODY_LINE_H)
  if (gluedKept !== 'First done.') {
    throw new Error(`pdfTextFit: glued DE sentences, got ${JSON.stringify(gluedKept)}`)
  }
  if (/können|Second/.test(gluedKept) && gluedKept.includes('Second')) {
    throw new Error('pdfTextFit: must not keep second glued sentence on one line')
  }
  const body = truncatePdfBody('Alpha. Bravo. Charlie.', BODY_LINE_H)
  if (!body.startsWith('Alpha.')) throw new Error('pdfTextFit: truncatePdfBody keeps opening')

  const clip = layoutBottomAnchoredClip(
    'One done. Two done. Three done. Four done. Five done.',
    'Short summary only.',
    520,
    { bodyOffset: 22 },
  )
  if (!clip.body.includes('One done')) throw new Error('pdfTextFit: bottom clip keeps opening')
  if (Math.abs(clip.cardY + clip.cardH - PAGE_BOTTOM) > 0.5) {
    throw new Error('pdfTextFit: card must sit on PAGE_BOTTOM')
  }
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('pdfTextFit')) {
  selfCheckPdfTextFit()
}
