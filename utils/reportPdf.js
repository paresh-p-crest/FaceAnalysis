import { jsPDF } from 'jspdf'
import { normalizeToJpegDataUrl } from './aestheticProjection'
import { resolveAllFeatureImages } from './protocolFeatureImages'
import {
  buildClosingColumns,
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  DISCLAIMER_PARAGRAPHS,
  formatProtocolEditionDate,
  formatProtocolMonth,
  getClientName,
  getFeatureComparisonData,
  INTRODUCTION_PARAGRAPHS,
  LIMITATIONS_PARAGRAPH,
  PRIVACY_PARAGRAPHS,
  QOVES_PROTOCOL_FEATURES,
  UNDERSTANDING_RESULTS,
} from './qovesProtocolModel'

// MyFace theme tokens (docs/design/theme.md)
const BRAND = { r: 94, g: 159, b: 139 }
const SLATE = { r: 55, g: 65, b: 81 }
const INK = { r: 17, g: 24, b: 39 }
const MUTED = { r: 107, g: 114, b: 128 }
const SURFACE_WARM = { r: 250, g: 251, b: 253 }
const SUMMARY_BG = { r: 55, g: 65, b: 81 }
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2
const COL_GAP = 20
const COL_W = (CONTENT_W - COL_GAP) / 2
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

function addFooter(doc, pageNum) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text('MyFace · Confidential Facial Analysis', MARGIN, PAGE_H - 28)
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 28, { align: 'right' })
}

function drawPageNumber(doc, num) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text(`PAGE / ${String(num).padStart(2, '0')}`, PAGE_W - MARGIN, 40, { align: 'right' })
}

function drawBrandBar(doc) {
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
}

function wrapText(doc, text, x, y, maxWidth, lineHeight = 13) {
  const lines = doc.splitTextToSize(text || '', maxWidth)
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function drawSplitTitle(doc, x, y, primary, secondary, size = 22) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(size)
  setInk(doc)
  doc.text(primary, x, y)
  if (secondary) {
    doc.setFont('helvetica', 'normal')
    setMuted(doc)
    doc.text(secondary, x, y + size * 0.85)
    return y + size * 1.6
  }
  return y + size * 0.5
}

function fitImage(w, h, maxW, maxH) {
  const ratio = Math.min(maxW / w, maxH / h)
  return { w: w * ratio, h: h * ratio }
}

function addPdfImage(doc, dataUrl, x, y, maxW, maxH) {
  if (!dataUrl) return { w: 0, h: 0 }
  const props = doc.getImageProperties(dataUrl)
  const fit = fitImage(props.width, props.height, maxW, maxH)
  doc.addImage(dataUrl, 'JPEG', x, y, fit.w, fit.h, undefined, IMG_QUALITY)
  return fit
}

function drawImageFrame(doc, x, y, w, h, dataUrl, tag) {
  doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
  doc.roundedRect(x, y, w, h, 6, 6, 'F')
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, w, h, 6, 6, 'S')

  if (dataUrl) {
    const pad = 4
    addPdfImage(doc, dataUrl, x + pad, y + pad, w - pad * 2, h - pad * 2)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setMuted(doc)
    doc.text('Projected image pending', x + w / 2, y + h / 2, { align: 'center' })
  }

  if (tag) {
    doc.setFillColor(80, 80, 80)
    doc.roundedRect(x + 6, y + 6, 52, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setWhite(doc)
    doc.text(tag, x + 10, y + 16)
  }
}

function drawBeforeAfterPair(doc, x, y, w, beforeSrc, afterSrc = null, imgH = 100, horizontal = true) {
  const gap = 8
  const frameW = horizontal ? (w - gap) / 2 : w
  const frameH = horizontal ? imgH : (imgH - gap) / 2

  if (horizontal) {
    drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, 'BEFORE')
    drawImageFrame(doc, x + frameW + gap, y, frameW, frameH, afterSrc, 'AFTER')
    return y + frameH + 10
  }

  drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, 'BEFORE')
  drawImageFrame(doc, x, y + frameH + gap, frameW, frameH, afterSrc, 'AFTER')
  return y + frameH * 2 + gap + 10
}

function drawSummaryBar(doc, y, title, summary) {
  const barH = 44
  const barY = Math.min(y, PAGE_H - 72)
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, barY, CONTENT_W, barH, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text(title, MARGIN + 12, barY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(summary || '', CONTENT_W - 160)
  doc.text(summaryLines[0] || '', MARGIN + 140, barY + 16)
  if (summaryLines[1]) doc.text(summaryLines[1], MARGIN + 140, barY + 28)
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
  drawBrandBar(doc)
  drawPageNumber(doc, pageNum)

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
    drawImageFrame(doc, rightX, imgY, imgColW, 120, profileJpeg, 'PROFILE')
    imgY += 128
  }

  const pairH = section.layoutHints?.stackedImages ? 180 : 100
  const vertical = section.layoutHints?.stackedImages
  drawBeforeAfterPair(doc, rightX, imgY, imgColW, beforeJpeg, null, pairH, !vertical)

  const summaryTitle = `${section.title.replace(' Recommendations', '')} Summary`
  drawSummaryBar(doc, PAGE_H - 80, summaryTitle, section.summary)
}

/**
 * Generate and download MyFace Qoves-style aesthetic protocol PDF.
 */
export async function downloadMyFacePdf({
  photo,
  photos,
  cvReport,
  metrics,
  landmarks,
  protocolData,
  protocolNarrative,
  answers,
  eyeAnalysis,
  aiNarrative,
}) {
  if (!photo || !cvReport) throw new Error('Photo and analysis data required for PDF export')

  const photoJpeg = await normalizeToJpegDataUrl(photo)
  const featurePages = buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative)

  const featureImages = await resolveAllFeatureImages({
    featurePages,
    photoJpeg,
    landmarks,
    cvReport,
    eyeAnalysis,
    photos,
  })

  const sectionPairs = featurePages.map((page) => ({
    ...page,
    beforeJpeg: featureImages[page.id]?.before || null,
    profileJpeg: featureImages[page.id]?.profile || null,
    profileIsReal: featureImages[page.id]?.profileIsReal ?? false,
    afterJpeg: null,
  }))

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  let pageNum = 1
  let y = 0
  const clientName = getClientName(answers)
  const monthLabel = formatProtocolMonth()
  const editionLabel = formatProtocolEditionDate()
  const closingParagraphs = buildClosingRecommendations(
    aiNarrative,
    cvReport,
    clientName,
    protocolNarrative
  )
  const closingCols = buildClosingColumns(closingParagraphs)
  const contents = buildProtocolContents(clientName)
  const chartItems = getFeatureComparisonData(cvReport)

  // ── Page 1: Cover — simple dark background, no photo ──
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('MYFACE', MARGIN, 72)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(220, 220, 220)
  doc.text(`${clientName}  ·  ${monthLabel}`, MARGIN, 110)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.setTextColor(255, 255, 255)
  doc.text('Aesthetic', MARGIN, 170)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(160, 170, 180)
  doc.text('Protocol', MARGIN, 210)
  doc.setFontSize(9)
  doc.setTextColor(180, 180, 180)
  doc.text(`WRITTEN ${editionLabel}`, MARGIN, 240)
  doc.text('PROTOCOL EDITION', PAGE_W - MARGIN, PAGE_H - 56, { align: 'right' })
  addFooter(doc, pageNum++)

  // ── Page 2: Disclaimer + Privacy (two columns) ──
  doc.addPage()
  drawBrandBar(doc)
  drawPageNumber(doc, 2)
  y = drawSplitTitle(doc, MARGIN, 68, 'Disclaimer', 'Policy', 20)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text('Disclaimer Policy', MARGIN, y + 8)
  doc.text('Privacy Policy', MARGIN + COL_W + COL_GAP, y + 8)
  y += 20

  let leftY = y
  let rightY = y
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  DISCLAIMER_PARAGRAPHS.forEach((para) => {
    leftY = wrapText(doc, para, MARGIN, leftY, COL_W, 11) + 8
  })
  PRIVACY_PARAGRAPHS.forEach((para) => {
    rightY = wrapText(doc, para, MARGIN + COL_W + COL_GAP, rightY, COL_W, 11) + 8
  })

  const footerY = Math.max(leftY, rightY) + 12
  setMuted(doc)
  wrapText(
    doc,
    `The following report was commissioned for ${clientName} on ${monthLabel}.`,
    MARGIN,
    footerY,
    CONTENT_W,
    11
  )
  addFooter(doc, pageNum++)

  // ── Page 3: Introduction + Contents (two columns) ──
  doc.addPage()
  drawBrandBar(doc)
  drawPageNumber(doc, 3)
  y = drawSplitTitle(doc, MARGIN, 68, 'Introduction', null, 20)
  y += 8

  leftY = y
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  INTRODUCTION_PARAGRAPHS.forEach((para) => {
    leftY = wrapText(doc, para, MARGIN, leftY, COL_W, 11) + 8
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text('Limitations', MARGIN, leftY + 4)
  leftY += 14
  doc.setFont('helvetica', 'normal')
  leftY = wrapText(doc, LIMITATIONS_PARAGRAPH, MARGIN, leftY, COL_W, 11)

  rightY = y
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Contents', MARGIN + COL_W + COL_GAP, rightY)
  rightY += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  contents.forEach((item) => {
    doc.text(item.label, MARGIN + COL_W + COL_GAP, rightY)
    doc.text(String(item.page).padStart(2, '0'), PAGE_W - MARGIN, rightY, { align: 'right' })
    rightY += 14
  })
  addFooter(doc, pageNum++)

  // ── Page 4: Understanding Your Results ──
  doc.addPage()
  drawBrandBar(doc)
  drawPageNumber(doc, 4)
  y = drawSplitTitle(doc, MARGIN, 68, 'Understanding', 'Your Results', 20)
  y += 16
  UNDERSTANDING_RESULTS.forEach((item, idx) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    setMuted(doc)
    doc.text(String(idx + 1).padStart(2, '0'), MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setInk(doc)
    y = wrapText(doc, item, MARGIN + 28, y - 2, CONTENT_W - 28, 11) + 14
  })
  addFooter(doc, pageNum++)

  // ── Page 5: Client protocol overview ──
  doc.addPage()
  drawBrandBar(doc)
  drawPageNumber(doc, 5)
  const protocolTitle = `${clientName}'s Protocol`
  y = drawSplitTitle(doc, MARGIN, 68, protocolTitle.replace(' Protocol', ''), 'Protocol', 20)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  y = wrapText(
    doc,
    protocolNarrative?.summary ||
      protocolData?.summary ||
      'To help you achieve your aesthetic potential, this evidence-based protocol is grounded in your measured facial analysis. Recommendations are organised around 11 key features for facial aesthetics.',
    MARGIN,
    y,
    CONTENT_W,
    11
  ) + 10

  y = drawBeforeAfterPair(doc, MARGIN, y, CONTENT_W, photoJpeg, null, 130, true)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text('Projected potential', MARGIN, y + 6)
  y += 16

  const featureList = QOVES_PROTOCOL_FEATURES.map((f) => f.title)
  const half = Math.ceil(featureList.length / 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  featureList.slice(0, half).forEach((label, i) => {
    doc.text(`· ${label}`, MARGIN, y + i * 12)
  })
  featureList.slice(half).forEach((label, i) => {
    doc.text(`· ${label}`, MARGIN + COL_W, y + i * 12)
  })

  drawDumbbellChart(doc, MARGIN + COL_W + COL_GAP, y - 4, COL_W, 200, chartItems)
  addFooter(doc, pageNum++)

  // ── Per-feature pages ──
  let featurePageNum = 6
  for (const section of sectionPairs) {
    doc.addPage()
    drawFeaturePage(doc, section, featurePageNum, section.beforeJpeg, section.profileJpeg, section.profileIsReal)
    addFooter(doc, pageNum++)
    featurePageNum += 1
  }

  // ── Page 16: Closing Recommendations (two columns) ──
  doc.addPage()
  drawBrandBar(doc)
  drawPageNumber(doc, 16)
  y = drawSplitTitle(doc, MARGIN, 68, 'Closing', 'Recommendations', 20)
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
  addFooter(doc, pageNum++)

  const safeName = clientName.replace(/[^\w\s-]/g, '').trim() || 'Client'
  doc.save(`MyFace-Protocol-${safeName.replace(/\s+/g, '-')}.pdf`)
}
