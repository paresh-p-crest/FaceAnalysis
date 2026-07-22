import { defaultPdfT, createPdfTranslator, createReportTranslator } from './pdfI18n'
import { jsPDF } from 'jspdf'
import { normalizeToJpegDataUrl } from './aestheticProjection'
import {
  buildChinProfileGuides,
  buildChinProjectionGuides,
  createProfileSilhouetteSampler,
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
  buildClosingColumns,
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  buildProtocolDashboardData,
  DISCLAIMER_PARAGRAPHS,
  formatProtocolId,
  formatProtocolMonth,
  getClientName,
  getFeatureComparisonData,
  INTRODUCTION_PARAGRAPHS,
  LIMITATIONS_PARAGRAPH,
  PRIVACY_PARAGRAPHS,
  QOVES_PROTOCOL_FEATURES,
  resolveTreatmentPhases,
  resolveFeaturePreviewCallouts,
  mapCoverTopCenter,
  UNDERSTANDING_RESULTS,
} from './qovesProtocolModel'

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

function evidenceTierLabel(tier, pdfT) {
  const key = EVIDENCE_TIER_LABELS[tier]
  return key ? pdfT(key) : tier
}

function wrapSubsectionText(doc, sub, x, y, maxW, lineH = 11.5, pdfT = defaultPdfT) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text(sub.title, x, y)
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

const DISCLAIMER_PARAGRAPHS_PDF = [
  'This report is provided for general informational and educational purposes only. It discusses topics related to facial aesthetics, orthodontics, and other health related subjects. It is not intended to constitute, and should not be relied upon as, medical, clinical, or professional advice, diagnosis, or treatment of any kind.',
  'The information provided by MyFace, MyFace Inc., and their affiliates is not a substitute for consultation with a qualified medical or healthcare professional. Readers should always seek the advice of an appropriately licensed professional regarding any medical condition, treatment, or decision.',
  'MyFace, MyFace Inc., and their affiliates make no representations or warranties, express or implied, regarding the accuracy, reliability, timeliness, or completeness of the information contained in this report, and expressly disclaim any liability arising from reliance on its contents. Any actions taken based on this report are done solely at the reader\'s own risk.',
  'The purpose of this report is solely to help the reader understand their facial features and how certain treatments or recommendations could potentially impact appearance. Any reference to treatments, procedures, or outcomes is provided for informational context only. The final decision on whether any treatment or intervention is appropriate must be made by a qualified medical or healthcare professional.'
]

const PRIVACY_PARAGRAPHS_PDF = [
  'The contents of this report have been produced for the intended client and all supplied original content by the client including but not limited to images and videos are stored offline for 30 days in the event of revisions or corrections to the supplied report.',
  'The MyFace brand does not use supplied client material for any purpose other than for the intended report the client has provided consent for. By supplying visual content (images, videos) to MyFace, it is implicitly assumed that the client provides consent for MyFace to use it in the client\'s report.',
  'This produced report is intended for the client only and will not be distributed to anyone other than the client. MyFace reserves the right to store the report offline for up to 1 year for reference purposes.',
  'Client-supplied images that have been modified by MyFace will be stored as a whole within the report.',
  'The MyFace brand does use cookies on the myface.club website to help aid navigation, analytics and browsing metadata. This process does track browser usage throughout the site.'
]

const INTRODUCTION_PARAGRAPHS_PDF = [
  'In this report, MyFace has approached the commissioned facial analysis from a cephalometric point of view; taking soft tissue measurements and comparing it with established scientific research data. The majority of this research data concerns itself with facial aesthetics and determining \'ideal\' cephalometric values in how they correspond to a 1/10 scale of rated attractiveness by the layperson.',
  'This approach makes the report\'s findings less subjective where recommendations and observations may vary from person to person. However, it should be noted that there are some limitations to the studies used throughout the report and the recommendations throughout should be taken only as empirical guidelines and not entirely precise measurements.'
]

const LIMITATIONS_PARAGRAPH_PDF =
  'This report does have numerous limitations that need to be taken into account. For one it\'s not possible for the MyFace team to ensure the subject is maintaining a Neutral Head Position. This may influence submental and under jaw measurements significantly. Another issue is lighting, camera quality and shadows which may influence the qualitative assessments by \'ageing\' the face unfavourably. Also, a proper assessment would require radio-cephalographs to better determine underlying dentofacial structure. These are not available and the MyFace team would like to reiterate that this report is not a medical diagnosis.'

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

function addFooter(doc, pageNum, pdfT = defaultPdfT) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text(pdfT('footerConfidential'), MARGIN, PAGE_H - 28)
  doc.text(pdfT('pageNumber', { page: pageNum }), PAGE_W - MARGIN, PAGE_H - 28, { align: 'right' })
}

function drawPageNumber(doc, num, pdfT = defaultPdfT) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text(pdfT('pageHeader', { page: String(num).padStart(2, '0') }), PAGE_W - MARGIN, 40, { align: 'right' })
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
 * Final pass keeps printable ASCII only so wrapping stays reliable.
 */
function sanitizePdfText(text) {
  if (typeof text !== 'string' || !text) return ''
  let out = text.normalize('NFKC')
  // Soft / non-breaking / fancy hyphens and dashes → ASCII hyphen
  out = out.replace(/[\u00AD\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE63\uFF0D]/g, '-')
  out = out.replace(/[\u2018\u2019\u2032\u0060\u00B4]/g, "'")
  out = out.replace(/[\u201C\u201D\u2033]/g, '"')
  out = out.replace(/[\u2022\u2023\u25E6\u00B7]/g, '-')
  out = out.replace(/\u2026/g, '...')
  out = out.replace(/[\u00A0\u202F\u2007\u2009\u200A\u2008]/g, ' ')
  out = out.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
  // Drop any remaining non-printable / non-ASCII (fixes DC1/DLE soft-hyphen ghosts)
  out = out.replace(/[^\t\n\r\x20-\x7E]/g, '')
  out = out.replace(/(\w)\s+-\s+(\w)/g, '$1-$2')
  out = out.replace(/[ \t]+\n/g, '\n')
  out = out.replace(/[ \t]{2,}/g, ' ')
  return out.trim()
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
    /** Register an already-decoded (or freshly rotated) image under a data URL key. */
    putImage(dataUrl, img) {
      if (dataUrl && img) imgByUrl.set(dataUrl, img)
    },
    crop(dataUrl, maxW, maxH) {
      if (!dataUrl || maxW <= 0 || maxH <= 0) return null
      const key = `${maxW.toFixed(1)}x${maxH.toFixed(1)}:${dataUrl.length}:${dataUrl.slice(-48)}`
      if (cropByKey.has(key)) return cropByKey.get(key)
      const img = imgByUrl.get(dataUrl)
      if (!img || !img.width || !img.height) return null

      const pxW = Math.max(1, Math.round(maxW * 2))
      const pxH = Math.max(1, Math.round(maxH * 2))
      const scale = Math.max(pxW / img.width, pxH / img.height)
      const sw = pxW / scale
      const sh = pxH / scale
      const sx = (img.width - sw) / 2
      const sy = (img.height - sh) / 2

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

function addPdfImage(doc, dataUrl, x, y, maxW, maxH, cover = false) {
  if (!dataUrl) return { w: 0, h: 0 }
  if (cover) {
    const fitted = coverCropSession?.crop(dataUrl, maxW, maxH) || null
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

function drawImageFrame(doc, x, y, w, h, dataUrl, tag, { cover = false, gap = IMAGE_TEXT_GAP, pdfT = defaultPdfT } = {}) {
  doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
  doc.roundedRect(x, y, w, h, 6, 6, 'F')
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 6, 6, 'S')

  if (dataUrl) {
    const pad = 4
    addPdfImage(doc, dataUrl, x + pad, y + pad, w - pad * 2, h - pad * 2, cover)
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
    doc.text('Projected image pending', rx + (w / 2 - pad) / 2, y + h / 2, { align: 'center' })
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

/** Labeled body block; returns Y after the last text line. */
function drawLabeledBody(doc, x, y, title, body, maxW, lineH = 11.5) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text(title, x, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  return wrapText(doc, body || '', x, y + 22, maxW, lineH)
}

/**
 * Summary card whose height grows with wrapped copy.
 * Column cards stick to PAGE_BOTTOM (without overlapping content above)
 * and never draw past maxBottom — even when minH cannot fit.
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
  const lines = doc.splitTextToSize(summary || '', w - pad * 2)
  // Title baseline at +16; leave more room before body (was 22 — cramped under "X Summary")
  const titleBlock = 30
  const naturalH = Math.max(minH, titleBlock + lines.length * lineH + pad)
  const topFloor = Math.max(80, y)
  const available = Math.max(0, maxBottom - topFloor)

  // Never exceed remaining space — minH is a preference, not a license to overflow
  let cardH = available > 0 ? Math.min(naturalH, available) : 0
  if (cardH < 36) {
    // Almost no room below content: pin to bottom and use whatever fits above footer
    cardH = Math.min(naturalH, Math.max(36, maxBottom - 80))
  }

  let cardY = stickToBottom ? maxBottom - cardH : topFloor
  if (cardY < topFloor) {
    cardH = Math.max(36, maxBottom - topFloor)
    cardY = maxBottom - cardH
  }
  if (cardY + cardH > maxBottom) {
    cardH = Math.max(36, maxBottom - cardY)
  }

  const maxLines = Math.max(1, Math.floor((cardH - titleBlock - pad / 2) / lineH))
  const visible = lines.slice(0, maxLines)

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
    drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, 'BEFORE', { cover })
    drawImageFrame(doc, x + frameW + gap, y, frameW, frameH, afterSrc, 'AFTER', { cover })
    return y + frameH + IMAGE_TEXT_GAP
  }

  drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, 'BEFORE', { cover })
  drawImageFrame(doc, x, y + frameH + gap, frameW, frameH, afterSrc, 'AFTER', { cover })
  return y + frameH * 2 + gap + IMAGE_TEXT_GAP
}

function drawSummaryBar(doc, y, title, summary) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(summary || '', CONTENT_W - 160)
  const lineH = 12
  const barH = Math.max(44, 20 + Math.min(summaryLines.length, 4) * lineH)
  let barY = y
  if (barY + barH > PAGE_BOTTOM) {
    barY = Math.max(80, PAGE_BOTTOM - barH)
  }
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, barY, CONTENT_W, barH, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text(title, MARGIN + 12, barY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  summaryLines.slice(0, 4).forEach((line, i) => {
    doc.text(line, MARGIN + 140, barY + 16 + i * lineH)
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
    doc.text(item.label, x, rowY + 2)

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
  doc.text('Client Values', x + 12, legendY + 2)
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.circle(x + 88, legendY, 3, 'F')
  doc.text('Projected Potential', x + 96, legendY + 2)

  return legendY + 14
}

function drawFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal = false) {
  drawHeader(doc, pageNum)

  const titleParts = section.title.split(' ')
  const primary = titleParts[0]
  const secondary = titleParts.slice(1).join(' ')
  let titleY = drawSplitTitle(doc, MARGIN, 68, primary, secondary, 20)

  const rightX = MARGIN + COL_W + COL_GAP
  const imgColW = COL_W
  let textY = titleY + 4
  const textMaxW = COL_W - 4

  section.subsections.forEach((sub) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(doc)
    doc.text(sub.title, MARGIN, textY)
    textY += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setInk(doc)
    textY = wrapText(doc, sub.body, MARGIN, textY, textMaxW, 11) + 8
  })

  let imgY = titleY + 4
  if (section.layoutHints?.profileImage && profileJpeg && profileIsReal) {
    imgY = drawImageFrame(doc, rightX, imgY, imgColW, 120, profileJpeg, 'PROFILE')
  }

  const pairH = section.layoutHints?.stackedImages ? 180 : 100
  const vertical = section.layoutHints?.stackedImages
  imgY = drawBeforeAfterPair(doc, rightX, imgY, imgColW, beforeJpeg, section.afterJpeg || null, pairH, !vertical)

  const summaryTitle = `${section.title.replace(' Recommendations', '')} Summary`
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
    doc.text(item.label, textX, yLabel, { align })
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
  doc.text('Projected Potential', cx - 78, legendY)

  // Legend: Client Values
  doc.setFillColor(SLATE.r, SLATE.g, SLATE.b)
  doc.rect(cx + 10, legendY - 6, boxW, boxW, 'F')
  doc.text('Client Values', cx + 22, legendY)
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

/** Norwood stages 1–7 (no 3-vertex). Head-only crops from public/norwood-stages/. */
async function loadNorwoodStageImages() {
  return Promise.all(
    [1, 2, 3, 4, 5, 6, 7].map((n) => loadImageAsDataUrl(`/norwood-stages/stage-${n}.png`)),
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
  doc.text('Normal', MARGIN + 28, y + 14)
  doc.text('Need Attention', MARGIN + CONTENT_W / 2, y + 14, { align: 'center' })
  doc.text('Extreme', MARGIN + CONTENT_W - 28, y + 14, { align: 'right' })

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
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Hair', 'Recommendations', 26) + 4

  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP
  const frameH = 120
  const norwoodStage = section.layoutHints?.norwoodStage ?? section.norwoodStage ?? 1

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = wrapSubsectionText(doc, subs[0], MARGIN, leftY, COL_W)
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, frameH, beforeJpeg, 'BEFORE', { cover: true })
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, frameH, section.afterJpeg || null, 'AFTER', {
    cover: true,
  })
  y = Math.max(leftY, rightY) + SECTION_GAP

  if (subs[1]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Hair Loss', MARGIN, y)
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

  leftY = y
  rightY = y
  if (subs[2]) leftY = wrapSubsectionText(doc, subs[2], MARGIN, leftY, COL_W)
  drawSummaryCard(doc, rightX, rightY, COL_W, 'Hair Summary', section.summary)
}

function drawEyesFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const pairBefore = slots.pairBefore || slots.brows || section.beforeJpeg
  const eyesPreview = slots.preview || slots.eyes || section.beforeJpeg
  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP

  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Eye', 'Recommendations', 26) + 4

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
  const summary = drawSummaryCard(doc, rightX, y, COL_W, 'Eye Region Summary', section.summary)
  const eyesY = Math.max(y, summary.bottom - eyesFrameH)
  drawImageFrame(doc, MARGIN, eyesY, COL_W, eyesFrameH, eyesPreview, 'EYES', {
    cover: false,
    gap: 0,
  })
}

function drawNoseFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Nose', 'Recommendations', 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  drawLabeledBody(doc, MARGIN, y, 'Nose', subs[0]?.body, COL_W)
  let rightY = y

  if (profileJpeg && profileIsReal) {
    rightY = drawImageFrame(doc, rightX, rightY, COL_W, PROFILE_FRAME_H, profileJpeg, 'PROFILE', {
      cover: true,
    })
  }
  rightY = drawBeforeAfterPair(doc, rightX, rightY, COL_W, beforeJpeg, section.afterJpeg || null, 120, true)
  drawSummaryCard(doc, rightX, rightY, COL_W, 'Nose Summary', section.summary)
}

function drawCheeksFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const analysisSrc = slots.analysis || section.beforeJpeg
  const pairBefore = slots.pairBefore || analysisSrc
  const overlayPoints = slots.overlayPoints || []
  const overlaySegments = slots.overlaySegments || []
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Cheek', 'Recommendations', 26) + 4

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Cheek Structure', subs[0].body, COL_W)

  // ANALYSIS + BEFORE + AFTER share one box size
  const cheekFrameW = COL_W
  const cheekFrameH = 180
  drawImageFrame(doc, rightX, rightY, cheekFrameW, cheekFrameH, analysisSrc, 'ANALYSIS', {
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
  drawSummaryBar(doc, y, 'Cheek Region Summary', section.summary)
}

function drawJawFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Jaw', 'Recommendations', 26) + 4
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
    'PROFILE',
    { cover: true },
  )
  y = Math.max(leftY, rightY) + SECTION_GAP

  // BEFORE/AFTER larger than before, but still smaller than the profile plate
  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, beforeJpeg, section.afterJpeg || null, 150, true)

  leftY = y
  rightY = y
  if (subs[1]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Further Enhancement', subs[1].body, COL_W)
  drawSummaryCard(doc, rightX, rightY, COL_W, 'Jaw Region Summary', section.summary)
}

function drawLipsFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const previewSrc = slots.preview || section.beforeJpeg
  const pairBefore = slots.pairBefore || section.beforeJpeg
  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP

  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Lip', 'Recommendations', 26) + 4

  let leftY = y
  let rightY = y
  if (subs[0]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Lip', subs[0].body, COL_W)
  // Square LIPS contour preview — full column width (and equal height)
  const lipsSquare = COL_W
  rightY = drawImageFrame(doc, rightX, rightY, lipsSquare, lipsSquare, previewSrc, 'LIPS', {
    cover: true,
  })
  y = Math.max(leftY, rightY) + SECTION_GAP

  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, pairBefore, section.afterJpeg || null, 200, true)
  drawSummaryBar(doc, y, 'Lips Summary', section.summary)
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
  coordSpace = 'image'
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
  return mapNormThroughCover(nx, ny, img.width, img.height, boxX, boxY, boxW, boxH)
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

  // Both plates resolve Pn/Sn/Pog on the pitched bitmap (ignore collapsed Mongo).
  const resolved = img
    ? resolveChinProjectionOverlay(img, poseId, boxW, boxH)
    : null
  if (!resolved) return null

  if (style === 'projection') {
    return buildChinProjectionGuides(resolved)
  }

  // Top plate: Image-2 chin-show (one anterior vertical + equal-length rays)
  const guides = buildChinProfileGuides(resolved)
  if (guides?.chinShow) {
    const tipY = guides.chinShow.tipY ?? -Infinity
    const len = guides.chinShow.rayLength ?? 0.08
    const vx = guides.chinShow.verticalX
    const noseRight = guides.chinShow.noseIsRight !== false
    // Keep equal length; only filter stray above-tip rays (do not silhouette-vary x1)
    guides.chinShow.rays = (guides.chinShow.rays || [])
      .filter((ray) => ray.y1 > tipY + 0.02)
      .map((ray) => ({
        ...ray,
        x2: vx,
        x1: noseRight ? Math.max(0, vx - len) : Math.min(1, vx + len),
        y2: ray.y1,
      }))
  }
  return guides
}

function drawChinProfileGuideOverlays(doc, profileSrc, frameX, frameY, frameW, frameH, guides, mode) {
  if (!guides || !profileSrc) return
  const pad = 4
  const box = { x: frameX + pad, y: frameY + pad, w: frameW - pad * 2, h: frameH - pad * 2 }
  const coordSpace = guides.coordSpace || 'image'
  const map = (nx, ny) =>
    mapChinGuidePoint(profileSrc, frameX, frameY, frameW, frameH, nx, ny, pad, coordSpace)

  doc.setDrawColor(255, 255, 255)

  // Top plate: one nose-tip vertical + horizontals from soft-tissue profile → vertical
  if (mode === 'thirds' && guides.chinShow) {
    const c = guides.chinShow
    const v0 = map(c.verticalX, c.y0)
    const v1 = map(c.verticalX, c.y1)
    doc.setLineWidth(1.15)
    doc.setLineDashPattern([], 0)
    // Always draw vertical (even if endpoints sit near the pad edge)
    doc.line(v0.x, v0.y, v1.x, v1.y)
    for (const ray of c.rays || []) {
      const a = map(ray.x1, ray.y1)
      const b = map(ray.x2, ray.y2)
      if (ray.dashed) {
        doc.setLineDashPattern([2.5, 2], 0)
        doc.setLineWidth(1.0)
      } else {
        doc.setLineDashPattern([], 0)
        doc.setLineWidth(1.1)
      }
      doc.line(a.x, a.y, b.x, b.y)
    }
    doc.setLineDashPattern([], 0)
    return
  }

  // Bottom plate: verticals only
  if (mode === 'projection' && guides.projection) {
    const p = guides.projection
    doc.setLineWidth(1.05)
    doc.setLineDashPattern([], 0)
    for (const v of p.verticals || []) {
      const a = map(v.x, v.y0)
      const b = map(v.x, v.y1)
      doc.line(a.x, a.y, b.x, b.y)
    }
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
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Chin', 'Recommendations', 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []
  const profileSrc = profileJpeg && profileIsReal ? profileJpeg : null
  const rawOverlay = section.profileOverlay
  const poseId = section.profilePoseId || 'rightProfile'

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Chin', subs[0]?.body, COL_W)
  let rightY = y

  if (profileSrc) {
    // Pitch chin-down for presentation (Image 2 slant), then resolve Pn/Pog on
    // that pitched bitmap so the Ricketts E-line locks to nose tip and chin.
    let showSrc = profileSrc
    const rawImg = coverCropSession?.getImage?.(profileSrc)
    const oriented = rawImg ? orientProfileForChinShow(rawImg, poseId) : null
    if (oriented?.dataUrl) {
      showSrc = oriented.dataUrl
      try {
        const orientedImg = await loadHtmlImage(showSrc)
        coverCropSession?.putImage?.(showSrc, orientedImg)
      } catch {
        showSrc = profileSrc
      }
    }

    const thirdsGuides = guidesForChinFrame(showSrc, COL_W, CHIN_PROFILE_FRAME_H, rawOverlay, poseId, {
      style: 'thirds',
    })
    const projectionGuides = guidesForChinFrame(showSrc, COL_W, CHIN_PROFILE_FRAME_H, rawOverlay, poseId, {
      style: 'projection',
    })

    const topFrameY = rightY
    rightY = drawImageFrame(doc, rightX, rightY, COL_W, CHIN_PROFILE_FRAME_H, showSrc, 'PROFILE', {
      cover: true,
    })
    drawChinProfileGuideOverlays(
      doc,
      showSrc,
      rightX,
      topFrameY,
      COL_W,
      CHIN_PROFILE_FRAME_H,
      thirdsGuides,
      'thirds'
    )

    const botFrameY = rightY
    rightY = drawImageFrame(doc, rightX, rightY, COL_W, CHIN_PROFILE_FRAME_H, showSrc, 'PROFILE', {
      cover: true,
    })
    drawChinProfileGuideOverlays(
      doc,
      showSrc,
      rightX,
      botFrameY,
      COL_W,
      CHIN_PROFILE_FRAME_H,
      projectionGuides,
      'projection'
    )
  }

  y = Math.max(leftY, rightY) + SECTION_GAP
  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, beforeJpeg, section.afterJpeg || null, 120, true)
  drawSummaryBar(doc, y, 'Chin Summary', section.summary)
}

function drawSkinFeaturePage(doc, section, pageNum, beforeJpeg, afterJpeg = null) {
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Skin', 'Recommendations', 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  const diagH = 240
  const diagY = y
  // Half-split only: use face-aligned AFTER so midline features match. Side-by-side pair stays unaligned.
  const splitAfter = section.splitAfterJpeg || afterJpeg
  let leftY = drawSplitComparisonFrame(doc, MARGIN, diagY, COL_W, diagH, beforeJpeg, splitAfter, { gap: 10 })

  const introText =
    'The condition of the subject\'s facial skin is a key part of overall appearance and one of the main signals of youth. To improve how the skin looks and support its health, the following steps are recommended:'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  let rightY = wrapText(doc, introText, rightX, y, COL_W, 11.5) + 12
  rightY = drawLabeledBody(doc, rightX, rightY, 'Skincare Protocol', subs[0]?.body, COL_W)

  y = Math.max(leftY, rightY) + SECTION_GAP

  // Side-by-side pair uses the tight single-cheek crop (eye→lips, nose excluded);
  // the half-split above stays on the wide beforeJpeg.
  const pairBefore = section.imageSlots?.pairBefore || beforeJpeg
  leftY = drawBeforeAfterPair(doc, MARGIN, y, COL_W, pairBefore, afterJpeg, 150, true)
  if (subs[1]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Further Skin Enhancement', subs[1].body, COL_W)
  drawSummaryCard(doc, rightX, y, COL_W, 'Skin Summary', section.summary)
}

function drawNeckFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Neck', 'Recommendations', 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Neck Size', subs[0]?.body, COL_W) + 16
  if (subs[1]) leftY = drawLabeledBody(doc, MARGIN, leftY, 'Neck Skin', subs[1].body, COL_W)

  let rightY = drawImageFrame(doc, rightX, y, COL_W, 240, beforeJpeg, 'BEFORE', { cover: true })
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, 240, section.afterJpeg || null, 'AFTER', { cover: true })

  drawSummaryCard(doc, MARGIN, Math.max(leftY, rightY) + SECTION_GAP, COL_W, 'Neck Summary', section.summary)
}

function drawEarsFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum)
  let y = drawSplitTitle(doc, MARGIN, 85, 'Ear', 'Recommendations', 26) + 4
  const rightX = MARGIN + COL_W + COL_GAP
  const subs = section.subsections || []

  let leftY = drawLabeledBody(doc, MARGIN, y, 'Ear Structure', subs[0]?.body, COL_W)

  // Front-facing ear crop only — no measurement overlays for now
  let rightY = drawImageFrame(doc, rightX, y, COL_W, 220, beforeJpeg, 'BEFORE', { cover: true })
  rightY = drawImageFrame(doc, rightX, rightY, COL_W, 220, section.afterJpeg || null, 'AFTER', { cover: true })

  drawSummaryCard(doc, MARGIN, Math.max(leftY, rightY) + SECTION_GAP, COL_W, 'Ear Summary', section.summary)
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
    doc.text(item.label, xLabel, yLabel, { align })
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
  } = ctx

  const dash = buildProtocolDashboardData({
    cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt,
  })
  const reportT = createReportTranslator(pdfMessages)
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
    // Keep trailing + with the number (e.g. "468+ points")
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
      parts: dash.analysisTimeDays != null
        ? [
            { text: String(dash.analysisTimeDays), brand: true },
            { text: dash.analysisTimeDays === 1 ? ' day' : ' days', brand: false },
          ]
        : null,
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
  for (let i = 0; i < 3; i += 1) {
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
      dash.analysisTimeDays
        ? (dash.analysisTimeDays === 1 ? '1 day' : `${dash.analysisTimeDays} days`)
        : '—',
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
  miniCards.forEach((card) => {
    const findings = (card.findings || []).filter((f) => f?.title).slice(0, 3)
    let cardH = estimateCardH(card)
    const remaining = bodyBottom - miniY
    if (remaining < 28) return
    cardH = Math.min(cardH, remaining)
    drawPanel(doc, leftX, miniY, leftW, cardH, 3)
    let textY = miniY + 10
    const miniTitle = card.title
      || pdfMessages?.Report?.executiveSummary?.miniCards?.[card.id]?.title
      || card.id
    const miniTitleText = String(miniTitle)
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
    { label: 'Sym', score: dash.radarScores.symmetry },
    { label: 'Smo', score: dash.radarScores.smoothness },
    { label: 'Jaw', score: dash.radarScores.jawline },
    { label: 'Skin', score: dash.radarScores.skin },
    { label: 'Vol', score: dash.radarScores.volume },
    { label: 'Har', score: dash.radarScores.harmony },
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
    const finding = row.finding || '—'
    const ref = row.ref || '—'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    setInk(doc)
    doc.text(reportFeatureCopy(pdfMessages, row.zoneKey, 'zone'), colZone, rowY)
    doc.setFont('helvetica', 'normal')
    setMuted(doc)
    doc.text(finding.length > 28 ? `${finding.slice(0, 27)}…` : finding, colFinding, rowY)
    doc.text(ref.length > 22 ? `${ref.slice(0, 21)}…` : ref, colRef, rowY)
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
  const itemLineH = 9
  const phaseHeaderH = 38
  const phasePadBottom = 8
  phaseKeys.forEach((phaseKey) => {
    const phase = treatment.phases?.[phaseKey]
    const items = (phase?.items || []).slice(0, 3)
    const rowCount = Math.max(items.length, 1)
    // Content-sized cards (do not stretch a single phase to fill the column)
    const phaseCardH = phaseHeaderH + rowCount * itemLineH + phasePadBottom
    const remaining = bodyBottom - ry - 40
    if (remaining < 36) return
    const drawH = Math.min(phaseCardH, remaining)

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(236, 236, 236)
    doc.roundedRect(rightX, ry, rightW, drawH, 4, 4, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
    doc.text(phase?.label || reportPhaseCopy(pdfMessages, phaseKey, 'label'), rightX + 6, ry + 10)
    doc.setFontSize(7.5)
    setInk(doc)
    const title = phase?.title || '—'
    doc.text(title.length > 34 ? `${title.slice(0, 33)}…` : title, rightX + 6, ry + 20)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    setMuted(doc)
    const duration = phase?.duration || '—'
    doc.text(duration.length > 38 ? `${duration.slice(0, 37)}…` : duration, rightX + 6, ry + 28)
    doc.setDrawColor(236, 236, 236)
    doc.line(rightX + 6, ry + 32, rightX + rightW - 6, ry + 32)
    doc.setFontSize(6)
    setInk(doc)
    for (let i = 0; i < rowCount; i += 1) {
      const itemY = ry + 40 + i * itemLineH
      if (itemY > ry + drawH - 4) break
      const item = items[i]
      const line = item
        ? `· ${item.name}${item.detail ? `: ${item.detail}` : ''}`
        : '· —'
      const clipped = line.length > 52 ? `${line.slice(0, 51)}…` : line
      doc.text(clipped, rightX + 6, itemY)
    }
    ry += drawH + phaseGap
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.5)
  setMuted(doc)
  if (treatment.summary && ry < bodyBottom - 12) {
    wrapText(doc, treatment.summary, rightX, ry + 2, rightW, 7)
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
 * Build MyFace Qoves-style aesthetic protocol PDF (same generator as download).
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
}) {
  if (!photo || !cvReport) throw new Error(pdfT('missingData'))
  const t = pdfMessages ? createPdfTranslator(pdfMessages) : pdfT

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
    Promise.resolve(buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative)),
    loadNorwoodStageImages().catch(() => []),
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
      chinSection.profileIsReal ? chinSection.profileJpeg : null
    )
    chinSection.profileOverlay = resolved?.overlay ?? null
    chinSection.profilePoseId = resolved?.poseId || 'rightProfile'
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  let pageNum = 1
  let y = 0
  const clientName = getClientName(answers, user, assessmentOwner)
  const monthLabel = formatProtocolMonth()
  const closingParagraphs = buildClosingRecommendations(
    aiNarrative,
    cvReport,
    clientName,
    protocolNarrative
  )
  const closingCols = buildClosingColumns(closingParagraphs)
  const contents = buildProtocolContents(clientName)
  const chartItems = getFeatureComparisonData(cvReport)

  try {
  const protocolId = formatProtocolId(assessmentId)
  const reportDateSource = updatedAt || createdAt
  const reportDateMs = reportDateSource ? Date.parse(reportDateSource) : NaN
  const reportDate = Number.isFinite(reportDateMs)
    ? new Date(reportDateMs).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  }) || {}
  pageNum++

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
  DISCLAIMER_PARAGRAPHS_PDF.forEach((para, idx) => {
    if (idx === DISCLAIMER_PARAGRAPHS_PDF.length - 1) {
      doc.setFont('helvetica', 'bold')
      setInk(doc)
    } else {
      doc.setFont('helvetica', 'normal')
      setInk(doc)
    }
    leftY = wrapText(doc, para, MARGIN, leftY, COL_W, 11.5) + 10
  })

  // Privacy paragraphs
  doc.setFont('helvetica', 'normal')
  PRIVACY_PARAGRAPHS_PDF.forEach((para) => {
    rightY = wrapText(doc, para, MARGIN + COL_W + COL_GAP, rightY, COL_W, 11.5) + 10
  })

  // Clickable Privacy Policy URL link at the bottom of the column
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text(t('readPrivacyPrefix'), MARGIN + COL_W + COL_GAP, rightY)

  const linkText = t('privacyLink')
  const prefixW = doc.getTextWidth(t('readPrivacyPrefix') + ' ')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(94, 159, 139) // brand color `#5e9f8b`
  doc.text(linkText, MARGIN + COL_W + COL_GAP + prefixW, rightY)
  
  const linkW = doc.getTextWidth(linkText)
  doc.setDrawColor(94, 159, 139)
  doc.setLineWidth(0.5)
  doc.line(MARGIN + COL_W + COL_GAP + prefixW, rightY + 1.5, MARGIN + COL_W + COL_GAP + prefixW + linkW, rightY + 1.5)
  
  doc.link(MARGIN + COL_W + COL_GAP + prefixW, rightY - 7, linkW, 9, { url: 'https://myface.club' })

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

  pageNum++

  // ── Page 3: Introduction + Contents (two columns) ──
  doc.addPage()
  drawHeader(doc, 3)
  y = drawSplitTitle(doc, MARGIN, 85, 'Introduction', null, 26)

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
  INTRODUCTION_PARAGRAPHS_PDF.forEach((para) => {
    leftY = wrapText(doc, para, MARGIN, leftY, COL_W, 11.5) + 10
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
  doc.text('Limitations', MARGIN, dividerY + 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, LIMITATIONS_PARAGRAPH_PDF, MARGIN, dividerY + 34, COL_W, 11.5)

  // Right column (Contents)
  rightY = colStartY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text('Contents', MARGIN + COL_W + COL_GAP, rightY)
  rightY += 22

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  
  const contentsList = [
    { label: 'Understanding the Results', page: 4 },
    { label: `${clientName}'s Protocol`, page: 5 },
    { label: 'Hair', page: 6 },
    { label: 'Eyebrows', page: 7 },
    { label: 'Eyes', page: 7 },
    { label: 'Nose', page: 8 },
    { label: 'Cheeks', page: 9 },
    { label: 'Jaw', page: 10 },
    { label: 'Lips', page: 11 },
    { label: 'Chin', page: 12 },
    { label: 'Skin', page: 13 },
    { label: 'Neck', page: 14 },
    { label: 'Ear', page: 15 },
    { label: 'Closing Recommendations', page: 16 }
  ]

  contentsList.forEach((item) => {
    setInk(doc)
    doc.text(item.label, MARGIN + COL_W + COL_GAP, rightY)
    setMuted(doc)
    doc.text(String(item.page).padStart(2, '0'), PAGE_W - MARGIN, rightY, { align: 'right' })
    rightY += 18
  })

  pageNum++

  // ── Page 4: Understanding the Results ──
  doc.addPage()
  drawHeader(doc, 4)
  y = drawSplitTitle(doc, MARGIN, 85, 'Understanding', 'the Results', 28)

  // Horizontal divider below the title
  doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.75)
  doc.line(MARGIN, 138, PAGE_W - MARGIN, 138)

  const UNDERSTANDING_RESULTS_RICH = [
    {
      bold: 'These recommendations focus on key markers of facial health and harmony.',
      normal: 'The goal is not to change what makes the subject unique, but to understand what works best with the subject\'s existing features. By refining what is already there, overall facial harmony can improve and form a strong foundation for any future aesthetic goals.',
    },
    {
      bold: 'MyFace does not rate attractiveness.',
      normal: 'The assessment is designed to highlight what works best for the subject\'s features. The analysis is objective by design. Rather than measuring against a single standard, it identifies what is already working well and where there is room to build, because everyone\'s features present a different set of opportunities.',
    },
    {
      bold: 'The protocol includes a mix of foundational and more advanced recommendations.',
      normal: 'Some may feel simple or general, and the subject may already follow some of them. While some recommendations, like "SPF", may seem obvious, the fundamentals matter most, as they support the effectiveness of any more targeted recommendations.',
    },
    {
      bold: 'All recommendations are provided for informational purposes and reflect aesthetic considerations only.',
      normal: 'Any in-clinic treatment or prescription-only product should be discussed with and approved by a qualified medical professional before use.',
    },
  ]

  UNDERSTANDING_RESULTS_RICH.forEach((item, idx) => {
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
    const boldLines = doc.splitTextToSize(item.bold, textW)
    boldLines.forEach((line, i) => {
      doc.text(line, textX, blockY + 10 + i * 15)
    })

    let textY = blockY + 10 + boldLines.length * 15 + 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setMuted(doc)
    const normalLines = doc.splitTextToSize(item.normal, textW)
    normalLines.forEach((line, i) => {
      doc.text(line, textX, textY + i * 13)
    })
  })

  pageNum++

  // ── Page 5: Client protocol overview ──
  doc.addPage()
  drawHeader(doc, 5)
  y = drawSplitTitle(doc, MARGIN, 85, `${clientName}'s`, 'Protocol', 26)

  // Tall side-by-side BEFORE / AFTER portraits
  const rightX = MARGIN + COL_W + COL_GAP
  const protocolPairH = 360
  const protocolPairY = 140
  drawImageFrame(doc, MARGIN, protocolPairY, COL_W, protocolPairH, photoJpeg, 'BEFORE', {
    cover: true,
  })
  drawImageFrame(doc, rightX, protocolPairY, COL_W, protocolPairH, overviewAfterJpeg, 'AFTER', {
    cover: true,
  })

  const textY = protocolPairY + protocolPairH + IMAGE_TEXT_GAP

  // Description text below BEFORE image
  const beforeText = "To help the subject achieve aesthetic potential, this detailed science-based protocol has been developed. Following this evidence-based protocol supports progress toward the subject's full aesthetic potential."
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  wrapText(doc, beforeText, MARGIN, textY, COL_W, 11)

  // Description text below AFTER image
  const afterText = "The analysis is designed to be objective. Instead of comparing the subject to a universal ideal, it highlights strengths and areas for improvement, recognizing that each person's features offer unique possibilities."
  wrapText(doc, afterText, rightX, textY, COL_W, 11)

  // Bottom section: Projected potential (left column) and Radar chart (right column)
  const bottomY = textY + 52
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setInk(doc)
  doc.text('Projected potential', MARGIN, bottomY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text('This report is organised around 11 key features for facial aesthetics:', MARGIN, bottomY + 16)

  const col1Features = ['Hair', 'Eyebrows', 'Eyes', 'Nose', 'Cheeks', 'Jaw']
  const col2Features = ['Lips', 'Chin', 'Skin', 'Neck', 'Ears']
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  const listY = bottomY + 32
  col1Features.forEach((label, i) => {
    doc.text(`•  ${label}`, MARGIN, listY + i * 12)
  })
  col2Features.forEach((label, i) => {
    doc.text(`•  ${label}`, MARGIN + 120, listY + i * 12)
  })

  // Draw vector radar chart in right column
  const cx = rightX + COL_W / 2
  const cy = bottomY + 55
  const rMax = 42
  drawRadarChart(doc, cx, cy, rMax, chartItems)

  pageNum++

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
    pageNum++ // Increment page count for each feature page
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
  drawHeader(doc, 16)
  y = drawSplitTitle(doc, MARGIN, 78, 'Closing', 'Recommendations', 20)
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
  addFooter(doc, pageNum++, t)

  const safeName = clientName.replace(/[^\w\s-]/g, '').trim() || 'Client'
  const filename = `MyFace-Protocol-${safeName.replace(/\s+/g, '-')}.pdf`
  const blob = doc.output('blob')
  return { blob, filename }
  } finally {
    coverCropSession = null
  }
}

/** Generate and download MyFace Qoves-style aesthetic protocol PDF. */
export async function downloadMyFacePdf(opts) {
  const { blob, filename } = await buildMyFacePdf(opts)
  triggerBlobDownload(blob, filename)
}

export { createPdfTranslator, defaultPdfT } from './pdfI18n'
