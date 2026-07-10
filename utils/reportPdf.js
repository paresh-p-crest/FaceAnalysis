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

const EVIDENCE_TIER_LABELS = {
  lifestyle: 'Routine / Topical',
  otc: 'Non-invasive / OTC',
  refer_clinician: 'See clinician',
}

function wrapSubsectionText(doc, sub, x, y, maxW, lineH = 11.5) {
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
    doc.text(`Recommendation tier: ${EVIDENCE_TIER_LABELS[sub.evidenceTier]}`, x, nextY + 4)
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

function drawHeader(doc, pageNum) {
  drawBrandBar(doc)
  
  // Top-left: MYFACE branding text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setInk(doc)
  doc.text('MYFACE', MARGIN, 40)

  // Top-right: PAGE  /  XX
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text('PAGE  /', PAGE_W - MARGIN - 18, 40, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  setInk(doc)
  doc.text(String(pageNum).padStart(2, '0'), PAGE_W - MARGIN, 40, { align: 'right' })

  // Divider line under the header at y=52
  doc.setDrawColor(236, 236, 236) // #ECECEC
  doc.setLineWidth(0.75)
  doc.line(MARGIN, 52, PAGE_W - MARGIN, 52)
}

function wrapText(doc, text, x, y, maxWidth, lineHeight = 13) {
  const lines = doc.splitTextToSize(text || '', maxWidth)
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
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

function addPdfImage(doc, dataUrl, x, y, maxW, maxH, cover = false) {
  if (!dataUrl) return { w: 0, h: 0 }
  const props = doc.getImageProperties(dataUrl)
  const ratio = cover
    ? Math.max(maxW / props.width, maxH / props.height)
    : Math.min(maxW / props.width, maxH / props.height)
  const w = props.width * ratio
  const h = props.height * ratio
  const ox = x + (maxW - w) / 2
  const oy = y + (maxH - h) / 2
  doc.addImage(dataUrl, 'JPEG', ox, oy, w, h, undefined, IMG_QUALITY)
  return { w, h, ox, oy }
}

function drawImageFrame(doc, x, y, w, h, dataUrl, tag, { cover = false } = {}) {
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
    doc.text('Projected image pending', x + w / 2, y + h / 2, { align: 'center' })
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
}

function drawCheekMeasurementOverlay(doc, frameX, frameY, frameW, frameH, points = []) {
  if (!points.length) return
  const pad = 6
  const ix = frameX + pad
  const iy = frameY + pad
  const iw = frameW - pad * 2
  const ih = frameH - pad * 2
  const toX = (p) => ix + p.x * iw
  const toY = (p) => iy + p.y * ih

  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.85)
  doc.setFillColor(255, 255, 255)

  const left = points.filter((p) => p.x < 0.48).sort((a, b) => a.y - b.y)
  const right = points.filter((p) => p.x >= 0.52).sort((a, b) => a.y - b.y)
  const midY = points.reduce((sum, p) => sum + p.y, 0) / points.length

  if (left.length >= 2) {
    const top = left[0]
    const bottom = left[left.length - 1]
    doc.line(toX(top), toY(top), toX(bottom), toY(bottom))
    doc.circle(toX(top), toY(top), 1.6, 'F')
    doc.circle(toX(bottom), toY(bottom), 1.6, 'F')
  }
  if (right.length >= 2) {
    const top = right[0]
    const bottom = right[right.length - 1]
    doc.line(toX(top), toY(top), toX(bottom), toY(bottom))
    doc.circle(toX(top), toY(top), 1.6, 'F')
    doc.circle(toX(bottom), toY(bottom), 1.6, 'F')
  }

  doc.line(ix + iw * 0.18, iy + midY * ih, ix + iw * 0.82, iy + midY * ih)
  doc.circle(ix + iw * 0.18, iy + midY * ih, 1.6, 'F')
  doc.circle(ix + iw * 0.82, iy + midY * ih, 1.6, 'F')
}

function drawBeforeAfterPair(doc, x, y, w, beforeSrc, afterSrc = null, imgH = 100, horizontal = true, cover = true) {
  const gap = 8
  const frameW = horizontal ? (w - gap) / 2 : w
  const frameH = horizontal ? imgH : (imgH - gap) / 2

  if (horizontal) {
    drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, 'BEFORE', { cover })
    drawImageFrame(doc, x + frameW + gap, y, frameW, frameH, afterSrc, 'AFTER', { cover })
    return y + frameH + 10
  }

  drawImageFrame(doc, x, y, frameW, frameH, beforeSrc, 'BEFORE', { cover })
  drawImageFrame(doc, x, y + frameH + gap, frameW, frameH, afterSrc, 'AFTER', { cover })
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
    drawImageFrame(doc, rightX, imgY, imgColW, 120, profileJpeg, 'PROFILE')
    imgY += 128
  }

  const pairH = section.layoutHints?.stackedImages ? 180 : 100
  const vertical = section.layoutHints?.stackedImages
  drawBeforeAfterPair(doc, rightX, imgY, imgColW, beforeJpeg, null, pairH, !vertical)

  const summaryTitle = `${section.title.replace(' Recommendations', '')} Summary`
  drawSummaryBar(doc, PAGE_H - 80, summaryTitle, section.summary)
}

function drawRadarChart(doc, cx, cy, rMax, items) {
  const numAxes = items.length
  
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
    const dist = rMax * (item.score / 100)
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
    const dist = rMax * (item.projected / 100)
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

function drawNorwoodPanel(doc, y, activeStage = 1) {
  const stageIdx = Math.max(0, Math.min(6, (activeStage || 1) - 1))
  const panelH = 90
  doc.setFillColor(SURFACE_WARM.r, SURFACE_WARM.g, SURFACE_WARM.b)
  doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.75)
  doc.roundedRect(MARGIN, y, CONTENT_W, panelH, 6, 6, 'FD')

  // Labels
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  doc.text('Normal', MARGIN + 28, y + 14)
  doc.text('Need Attention', MARGIN + CONTENT_W / 2, y + 14, { align: 'center' })
  doc.text('Extreme', MARGIN + CONTENT_W - 28, y + 14, { align: 'right' })

  const startX = MARGIN + 36
  const stepX = (CONTENT_W - 72) / 6
  const cy = y + 54

  for (let i = 0; i < 7; i++) {
    const cx = startX + i * stepX

    // 1. Draw head circle
    doc.setDrawColor(220, 224, 230)
    doc.setLineWidth(0.5)
    doc.circle(cx, cy, 18, 'S')

    // 2. Draw face features
    doc.setFillColor(180, 185, 195)
    doc.circle(cx - 5, cy + 4, 1, 'F')
    doc.circle(cx + 5, cy + 4, 1, 'F')
    doc.setDrawColor(180, 185, 195)
    doc.line(cx, cy + 3, cx, cy + 6)
    doc.line(cx - 3, cy + 10, cx + 3, cy + 10)

    // 3. Highlight active Norwood stage
    if (i === stageIdx) {
      doc.setDrawColor(BRAND.r, BRAND.g, BRAND.b)
      doc.setLineWidth(1.5)
      doc.roundedRect(cx - 24, cy - 24, 48, 48, 4, 4, 'S')
    }

    doc.setDrawColor(80, 85, 95)
    doc.setLineWidth(0.75)

    if (i === 0) {
      // Stage 1
      doc.line(cx - 16, cy - 6, cx - 12, cy - 12)
      doc.line(cx - 12, cy - 12, cx, cy - 14)
      doc.line(cx, cy - 14, cx + 12, cy - 12)
      doc.line(cx + 12, cy - 12, cx + 16, cy - 6)
    } else if (i === 1) {
      // Stage 2
      doc.line(cx - 16, cy - 6, cx - 11, cy - 9)
      doc.line(cx - 11, cy - 9, cx - 7, cy - 12)
      doc.line(cx - 7, cy - 12, cx, cy - 11)
      doc.line(cx, cy - 11, cx + 7, cy - 12)
      doc.line(cx + 7, cy - 12, cx + 11, cy - 9)
      doc.line(cx + 11, cy - 9, cx + 16, cy - 6)
    } else if (i === 2) {
      // Stage 3
      doc.line(cx - 16, cy - 6, cx - 10, cy - 6)
      doc.line(cx - 10, cy - 6, cx - 6, cy - 10)
      doc.line(cx - 6, cy - 10, cx, cy - 8)
      doc.line(cx, cy - 8, cx + 6, cy - 10)
      doc.line(cx + 6, cy - 10, cx + 10, cy - 6)
      doc.line(cx + 10, cy - 6, cx + 16, cy - 6)
    } else if (i === 3) {
      // Stage 4
      doc.line(cx - 16, cy - 6, cx - 9, cy - 4)
      doc.line(cx - 9, cy - 4, cx - 5, cy - 8)
      doc.line(cx - 5, cy - 8, cx, cy - 6)
      doc.line(cx, cy - 6, cx + 5, cy - 8)
      doc.line(cx + 5, cy - 8, cx + 9, cy - 4)
      doc.line(cx + 9, cy - 4, cx + 16, cy - 6)
      doc.circle(cx, cy - 14, 2, 'S')
    } else if (i === 4) {
      // Stage 5
      doc.line(cx - 16, cy - 6, cx - 8, cy - 2)
      doc.line(cx - 8, cy - 2, cx - 4, cy - 6)
      doc.line(cx - 4, cy - 6, cx, cy - 4)
      doc.line(cx, cy - 4, cx + 4, cy - 6)
      doc.line(cx + 4, cy - 6, cx + 8, cy - 2)
      doc.line(cx + 8, cy - 2, cx + 16, cy - 6)
      doc.circle(cx, cy - 13, 4, 'S')
    } else if (i === 5) {
      // Stage 6
      doc.line(cx - 16, cy - 6, cx - 8, cy + 2)
      doc.line(cx - 8, cy + 2, cx - 4, cy - 2)
      doc.line(cx - 4, cy - 2, cx + 4, cy - 2)
      doc.line(cx + 4, cy - 2, cx + 8, cy + 2)
      doc.line(cx + 8, cy + 2, cx + 16, cy - 6)
    } else {
      // Stage 7
      doc.line(cx - 16, cy - 4, cx - 12, cy + 4)
      doc.line(cx + 12, cy + 4, cx + 16, cy - 4)
    }
  }
}

function drawHairFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum)
  drawSplitTitle(doc, MARGIN, 85, 'Hair', 'Recommendations', 26)

  const subs = section.subsections || []
  const rightX = MARGIN + COL_W + COL_GAP
  const frameH = 80
  const norwoodStage = section.layoutHints?.norwoodStage ?? section.norwoodStage ?? 1

  if (subs[0]) wrapSubsectionText(doc, subs[0], MARGIN, 150, COL_W)
  drawImageFrame(doc, rightX, 150, COL_W, frameH, beforeJpeg, 'BEFORE')
  drawImageFrame(doc, rightX, 150 + frameH + 8, COL_W, frameH, null, 'AFTER')

  if (subs[1]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Hair Loss', MARGIN, 345)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const body = subs[1].body || ''
    const mid = Math.floor(body.length / 2)
    const splitAt = body.indexOf('. ', mid)
    const splitIdx = splitAt > 0 ? splitAt + 1 : mid
    wrapText(doc, body.slice(0, splitIdx).trim(), MARGIN, 362, COL_W, 11.5)
    wrapText(doc, body.slice(splitIdx).trim(), rightX, 362, COL_W, 11.5)
  }

  drawNorwoodPanel(doc, 460, norwoodStage)

  if (subs[2]) wrapSubsectionText(doc, subs[2], MARGIN, 570, COL_W)

  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(rightX, 570, COL_W, 110, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Hair Summary', rightX + 12, 586)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary || '', COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX + 12, 600 + i * 11.5)
  })
}

function drawEyesFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const pairBefore = slots.pairBefore || slots.brows || section.beforeJpeg
  const eyesPreview = slots.preview || slots.eyes || section.beforeJpeg
  const subs = section.subsections || []

  drawHeader(doc, pageNum)
  drawSplitTitle(doc, MARGIN, 85, 'Eye', 'Recommendations', 26)

  if (subs[0]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Eyebrows', MARGIN, 150)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    wrapText(doc, subs[0].body, MARGIN, 168, COL_W, 11.5)
  }

  const rightX = MARGIN + COL_W + COL_GAP
  if (subs[1]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Eyelashes', rightX, 150)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    wrapText(doc, subs[1].body, rightX, 168, COL_W, 11.5)
  }

  drawBeforeAfterPair(doc, MARGIN, 270, CONTENT_W, pairBefore, null, 100, true)

  if (subs[2]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Eyes', MARGIN, 395)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    wrapText(doc, subs[2].body, MARGIN, 413, COL_W, 11.5)
  }

  if (subs[3]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Under eye', rightX, 395)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    wrapText(doc, subs[3].body, rightX, 413, COL_W, 11.5)
  }

  drawImageFrame(doc, MARGIN, 520, COL_W, 100, eyesPreview, 'EYES', { cover: true })

  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(rightX, 520, COL_W, 100, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Eye Region Summary', rightX + 12, 536)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary || '', COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX + 12, 552 + i * 11.5)
  })
}

function drawNoseFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum)
  
  // Title
  let y = drawSplitTitle(doc, MARGIN, 85, 'Nose', 'Recommendations', 26)

  // Left Column
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Nose', MARGIN, 150)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[0].body, MARGIN, 168, COL_W, 11.5)

  // Right Column Vertical Stack
  const rightX = MARGIN + COL_W + COL_GAP
  
  // Profile photo (real side profile only)
  if (profileJpeg && profileIsReal) {
    drawImageFrame(doc, rightX, 150, COL_W, 160, profileJpeg, 'PROFILE')
  }
  // Front crop for before/after reference
  drawBeforeAfterPair(doc, rightX, profileJpeg && profileIsReal ? 318 : 150, COL_W, beforeJpeg, null, 80, true)

  // Nose summary card
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(rightX, 414, COL_W, 110, 6, 6, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Nose Summary', rightX + 12, 430)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary, COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX + 12, 446 + i * 11.5)
  })
}

function drawCheeksFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const analysisSrc = slots.analysis || section.beforeJpeg
  const pairBefore = slots.pairBefore || analysisSrc
  const overlayPoints = slots.overlayPoints || []

  drawHeader(doc, pageNum)
  drawSplitTitle(doc, MARGIN, 85, 'Cheek', 'Recommendations', 26)

  const subs = section.subsections || []
  if (subs[0]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Cheek Structure', MARGIN, 150)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    wrapText(doc, subs[0].body, MARGIN, 168, COL_W, 11.5)
  }

  const rightX = MARGIN + COL_W + COL_GAP
  const analysisY = 150
  const analysisH = 170
  drawImageFrame(doc, rightX, analysisY, COL_W, analysisH, analysisSrc, 'ANALYSIS', { cover: true })
  drawCheekMeasurementOverlay(doc, rightX, analysisY, COL_W, analysisH, overlayPoints)

  drawBeforeAfterPair(doc, MARGIN, 340, CONTENT_W, pairBefore, null, 150, true)

  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, 520, CONTENT_W, 60, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Cheek Region Summary', MARGIN + 12, 555)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary || '', COL_W + 10)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX - 10, 545 + i * 11.5)
  })
}

function drawJawFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum)
  
  // Title
  let y = drawSplitTitle(doc, MARGIN, 85, 'Jaw', 'Recommendations', 26)

  // Top Section: Jaw Structure Text + Profile Image on right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Jaw Structure', MARGIN, 150)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[0].body, MARGIN, 168, COL_W, 11.5)

  // Right column Profile Image
  const rightX = MARGIN + COL_W + COL_GAP
  drawImageFrame(doc, rightX, 150, COL_W, 160, profileJpeg && profileIsReal ? profileJpeg : beforeJpeg, 'PROFILE')

  // Middle Section: Before / After jaw close-ups
  drawBeforeAfterPair(doc, MARGIN, 330, CONTENT_W, beforeJpeg, null, 90, true)

  // Bottom Section: Further Enhancement on left, Summary Card on right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Further Enhancement', MARGIN, 445)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[1].body, MARGIN, 463, COL_W, 11.5)

  // Jaw summary card
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(rightX, 445, COL_W, 135, 6, 6, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Jaw Region Summary', rightX + 12, 461)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary, COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX + 12, 477 + i * 11.5)
  })
}

function drawLipsFeaturePage(doc, section, pageNum) {
  const slots = section.imageSlots || {}
  const previewSrc = slots.preview || section.beforeJpeg
  const pairBefore = slots.pairBefore || section.beforeJpeg
  const subs = section.subsections || []

  drawHeader(doc, pageNum)
  drawSplitTitle(doc, MARGIN, 85, 'Lip', 'Recommendations', 26)

  if (subs[0]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Lip', MARGIN, 150)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    wrapText(doc, subs[0].body, MARGIN, 168, COL_W, 11.5)
  }

  const rightX = MARGIN + COL_W + COL_GAP
  drawImageFrame(doc, rightX, 150, COL_W, 120, previewSrc, 'LIPS', { cover: true })

  drawBeforeAfterPair(doc, MARGIN, 295, CONTENT_W, pairBefore, null, 150, true)

  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, 475, CONTENT_W, 60, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Lips Summary', MARGIN + 12, 510)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary || '', COL_W + 10)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX - 10, 500 + i * 11.5)
  })
}

function drawChinFeaturePage(doc, section, pageNum, beforeJpeg, profileJpeg, profileIsReal) {
  drawHeader(doc, pageNum)
  
  // Title
  let y = drawSplitTitle(doc, MARGIN, 85, 'Chin', 'Recommendations', 26)

  // Top Section: Chin Structure Text + stacked profile visuals with overlays on right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Chin', MARGIN, 150)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[0].body, MARGIN, 168, COL_W, 11.5)

  // Right column stacked profile images with vector guidelines
  const rightX = MARGIN + COL_W + COL_GAP
  
  // Top profile image + overlay 1
  drawImageFrame(doc, rightX, 150, COL_W, 100, profileJpeg && profileIsReal ? profileJpeg : beforeJpeg, null)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  for (let i = 0; i < 4; i++) {
    doc.line(rightX + 60, 150 + 30 + i * 18, rightX + COL_W - 20, 150 + 30 + i * 18)
  }
  doc.line(rightX + COL_W - 20, 150 + 30, rightX + COL_W - 20, 150 + 30 + 3 * 18)

  // Bottom profile image + overlay 2
  drawImageFrame(doc, rightX, 258, COL_W, 100, profileJpeg && profileIsReal ? profileJpeg : beforeJpeg, null)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  doc.line(rightX + 110, 258 + 20, rightX + 150, 258 + 80)
  doc.line(rightX + 150, 258 + 80, rightX + 130, 258 + 95)
  doc.line(rightX + 130, 258 + 40, rightX + 130, 258 + 95)

  // Middle Section: Before / After chin crops
  drawBeforeAfterPair(doc, MARGIN, 385, CONTENT_W, beforeJpeg, null, 120, true)

  // Bottom Section: Summary Bar (full width)
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, 535, CONTENT_W, 60, 6, 6, 'F')
  
  // Left heading
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Chin Summary', MARGIN + 12, 570)
  
  // Right text
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary, COL_W + 10)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX - 10, 560 + i * 11.5)
  })
}

function drawSkinFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum)
  
  // Title
  let y = drawSplitTitle(doc, MARGIN, 85, 'Skin', 'Recommendations', 26)

  // Top Section: Left large split diagnostic image, right explanatory text
  // 1. Split Image on Left
  drawImageFrame(doc, MARGIN, 150, COL_W, 240, beforeJpeg, null)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  doc.setLineDashPattern([3, 3], 0)
  doc.line(MARGIN + COL_W / 2, 150, MARGIN + COL_W / 2, 150 + 240)
  doc.setLineDashPattern([], 0) // reset

  // 2. Explanatory text on Right
  const rightX = MARGIN + COL_W + COL_GAP
  const introText = "The condition of your facial skin is a key part of your overall appearance and one of the main signals of youth. To improve how your skin looks and support its health, we recommend the following steps:"
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  let textY = wrapText(doc, introText, rightX, 150, COL_W, 11.5) + 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Skincare Protocol', rightX, textY)
  textY += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  textY = wrapText(doc, section.subsections[0].body, rightX, textY, COL_W, 11.5)

  // Bottom Section: Left has small crops and enhancement text, right has summary card
  // 1. Before / After skin crops on Left
  drawBeforeAfterPair(doc, MARGIN, 405, COL_W, beforeJpeg, null, 90, true)

  // 2. Further Skin Enhancement text below crops
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Further Skin Enhancement', MARGIN, 515)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[1].body, MARGIN, 533, COL_W, 11.5)

  // 3. Skin Summary Card on Right
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(rightX, 515, COL_W, 135, 6, 6, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Skin Summary', rightX + 12, 531)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary, COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, rightX + 12, 547 + i * 11.5)
  })
}

function drawNeckFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum)
  
  // Title
  let y = drawSplitTitle(doc, MARGIN, 85, 'Neck', 'Recommendations', 26)

  // Left column: Neck Size and Neck Skin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Neck Size', MARGIN, 150)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  let textY = wrapText(doc, section.subsections[0].body, MARGIN, 168, COL_W, 11.5) + 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Neck Skin', MARGIN, textY)
  textY += 18
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[1].body, MARGIN, textY, COL_W, 11.5)

  // Left column Bottom: Summary card
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, 510, COL_W, 110, 6, 6, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Neck Summary', MARGIN + 12, 526)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary, COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, MARGIN + 12, 542 + i * 11.5)
  })

  // Right column: Stacked neck images
  const rightX = MARGIN + COL_W + COL_GAP
  drawImageFrame(doc, rightX, 150, COL_W, 230, beforeJpeg, 'BEFORE')
  drawImageFrame(doc, rightX, 390, COL_W, 230, null, 'AFTER')
}

function drawEarsFeaturePage(doc, section, pageNum, beforeJpeg) {
  drawHeader(doc, pageNum)
  
  // Title
  let y = drawSplitTitle(doc, MARGIN, 85, 'Ear', 'Recommendations', 26)

  // Left column: Ear Structure text & Ear Summary card
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Ear Structure', MARGIN, 150)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  wrapText(doc, section.subsections[0].body, MARGIN, 168, COL_W, 11.5)

  // Left column Bottom: Summary card
  doc.setFillColor(SUMMARY_BG.r, SUMMARY_BG.g, SUMMARY_BG.b)
  doc.roundedRect(MARGIN, 510, COL_W, 110, 6, 6, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setWhite(doc)
  doc.text('Ear Summary', MARGIN + 12, 526)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const summaryLines = doc.splitTextToSize(section.summary, COL_W - 24)
  summaryLines.forEach((line, i) => {
    doc.text(line, MARGIN + 12, 542 + i * 11.5)
  })

  // Right column stacked ear photos with overlays
  const rightX = MARGIN + COL_W + COL_GAP
  
  // Top: antihelix guide line overlay
  drawImageFrame(doc, rightX, 150, COL_W, 160, beforeJpeg, null)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  doc.line(rightX + COL_W - 40, 150 + 40, rightX + COL_W - 60, 150 + 130)
  doc.line(rightX + COL_W - 20, 150 + 40, rightX + COL_W - 40, 150 + 130)

  // Bottom: ear height guide bounding boxes
  drawImageFrame(doc, rightX, 320, COL_W, 160, beforeJpeg, null)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(1)
  doc.line(rightX + 50, 320 + 40, rightX + 50, 320 + 120)
  doc.line(rightX + 40, 320 + 40, rightX + 80, 320 + 40)
  doc.line(rightX + 40, 320 + 120, rightX + 80, 320 + 120)
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
    imageSlots: featureImages[page.id]?.slots || {},
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
  
  // Top Header Line & Brand
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setWhite(doc)
  doc.text('MYFACE', MARGIN, 72)
  
  doc.setDrawColor(58, 74, 90) // accent dark blue-gray line
  doc.setLineWidth(1)
  doc.line(MARGIN, 85, PAGE_W - MARGIN, 85)
  
  // Center-Left Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(38)
  doc.setTextColor(255, 255, 255)
  doc.text('Aesthetic', MARGIN, 370)
  
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(181, 199, 211) // hex #B5C7D3 light slate/grey
  doc.text('Protocol', MARGIN, 415)
  
  // Metadata Section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(180, 190, 200)
  doc.text('PREPARED FOR', MARGIN, 480)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(clientName.toUpperCase(), MARGIN, 498)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(180, 190, 200)
  doc.text('DATE', MARGIN + 180, 480)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(monthLabel.toUpperCase(), MARGIN + 180, 498)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(180, 190, 200)
  doc.text('EDITION', MARGIN + 320, 480)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(editionLabel.toUpperCase(), MARGIN + 320, 498)

  // Bottom Footer
  doc.setDrawColor(58, 74, 90)
  doc.setLineWidth(1)
  doc.line(MARGIN, PAGE_H - 80, PAGE_W - MARGIN, PAGE_H - 80)
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(140, 150, 160)
  doc.text('MYFACE.CLUB', MARGIN, PAGE_H - 62)
  
  doc.setFont('helvetica', 'normal')
  doc.text('CONFIDENTIAL AESTHETIC PROTOCOL', PAGE_W - MARGIN, PAGE_H - 62, { align: 'right' })

  // Increment page count
  pageNum++

  // ── Page 2: Disclaimer + Privacy (two columns) ──
  doc.addPage()
  drawHeader(doc, 2)
  y = drawSplitTitle(doc, MARGIN, 85, 'Disclaimer', 'Policy', 26)

  // Draw vertical separator line down the middle
  doc.setDrawColor(236, 236, 236) // #ECECEC
  doc.setLineWidth(0.75)
  doc.line(PAGE_W / 2, 150, PAGE_W / 2, PAGE_H - 120)

  // Start column headers
  let columnHeaderY = 155
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setInk(doc)
  doc.text('Disclaimer Policy', MARGIN, columnHeaderY)
  doc.text('Privacy Policy', MARGIN + COL_W + COL_GAP, columnHeaderY)

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
  doc.text('Read the full privacy policy ', MARGIN + COL_W + COL_GAP, rightY)
  
  const linkText = 'here (myface.club)'
  const prefixW = doc.getTextWidth('Read the full privacy policy ')
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
  doc.text('MyFace Inc', MARGIN + COL_W + COL_GAP, signatureY)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text('The following report was commissioned for', MARGIN + COL_W + COL_GAP, signatureY + 12)
  doc.text(`${clientName} on ${monthLabel}.`, MARGIN + COL_W + COL_GAP, signatureY + 24)

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
    { label: 'Understanding Your Results', page: 4 },
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

  // ── Page 4: Understanding Your Results ──
  doc.addPage()
  drawHeader(doc, 4)
  y = drawSplitTitle(doc, MARGIN, 85, 'Understanding', 'Your Results', 26)

  // Horizontal divider below the title
  doc.setDrawColor(236, 236, 236)
  doc.setLineWidth(0.75)
  doc.line(MARGIN, 135, PAGE_W - MARGIN, 135)

  const UNDERSTANDING_RESULTS_RICH = [
    {
      bold: 'These recommendations focus on key markers of facial health and harmony.',
      normal: 'The goal is not to change what makes you uniquely you, but to understand what works best with your existing features. By refining what is already there, you can improve overall facial harmony and build a strong foundation for any future aesthetic goals.',
    },
    {
      bold: 'MyFace does not rate attractiveness.',
      normal: 'Your assessment is designed to highlight what works best for your features. The analysis is objective by design. Rather than measuring against a single standard, it identifies what is already working well and where there is room to build, because everyone\'s features present a different set of opportunities.',
    },
    {
      bold: 'You will see a mix of foundational and more advanced recommendations.',
      normal: 'Some may feel simple or general, and you may already be following some of the recommendations. While some recommendations, like "SPF", may seem obvious, we believe the fundamentals matter most, as they support the effectiveness of any more targeted recommendations.',
    },
    {
      bold: 'All recommendations are provided for informational purposes and reflect aesthetic considerations only.',
      normal: 'Any in-clinic treatment or prescription-only product should be discussed with and approved by a qualified medical professional before use.',
    },
  ]

  UNDERSTANDING_RESULTS_RICH.forEach((item, idx) => {
    const blockY = 170 + idx * 135

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(44)
    doc.setTextColor(215, 222, 228)
    doc.text(String(idx + 1).padStart(2, '0'), MARGIN, blockY + 32)

    const textX = MARGIN + 48
    const textW = CONTENT_W - 48

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(doc)
    const boldLines = doc.splitTextToSize(item.bold, textW)
    boldLines.forEach((line, i) => {
      doc.text(line, textX, blockY + 10 + i * 13)
    })
    
    let textY = blockY + 10 + boldLines.length * 13 + 4

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setMuted(doc)
    const normalLines = doc.splitTextToSize(item.normal, textW)
    normalLines.forEach((line, i) => {
      doc.text(line, textX, textY + i * 11.5)
    })
  })

  pageNum++

  // ── Page 5: Client protocol overview ──
  doc.addPage()
  drawHeader(doc, 5)
  y = drawSplitTitle(doc, MARGIN, 85, `${clientName}'s`, 'Protocol', 26)

  // Draw side-by-side BEFORE / AFTER images (tall portrait aspect ratio)
  const rightX = MARGIN + COL_W + COL_GAP
  drawImageFrame(doc, MARGIN, 150, COL_W, 240, photoJpeg, 'BEFORE')
  drawImageFrame(doc, rightX, 150, COL_W, 240, null, 'AFTER')

  // Description text below BEFORE image
  const beforeText = "To help you achieve your aesthetic potential, we have developed this detailed and comprehensive science-based protocol. By following this evidence-based protocol, you can reach your full aesthetic potential."
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  wrapText(doc, beforeText, MARGIN, 405, COL_W, 11.5)

  // Description text below AFTER image
  const afterText = "Our analysis is designed to be objective. Instead of comparing you to a universal ideal, it highlights your strengths and areas for improvement, recognizing that each person's features offer unique possibilities."
  wrapText(doc, afterText, rightX, 405, COL_W, 11.5)

  // Bottom section: Projected potential (left column) and Radar chart (right column)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setInk(doc)
  doc.text('Projected potential', MARGIN, 475)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  setMuted(doc)
  doc.text('This report is organised around 11 key features for facial aesthetics:', MARGIN, 495)

  const col1Features = ['Hair', 'Eyebrows', 'Eyes', 'Nose', 'Cheeks', 'Jaw']
  const col2Features = ['Lips', 'Chin', 'Skin', 'Neck', 'Ears']
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setInk(doc)
  col1Features.forEach((label, i) => {
    doc.text(`•  ${label}`, MARGIN, 515 + i * 14)
  })
  col2Features.forEach((label, i) => {
    doc.text(`•  ${label}`, MARGIN + 120, 515 + i * 14)
  })

  // Draw vector radar chart in right column
  const cx = rightX + COL_W / 2
  const cy = 550
  const rMax = 50
  drawRadarChart(doc, cx, cy, rMax, chartItems)

  pageNum++

  // ── Per-feature pages ──
  let featurePageNum = 6
  for (const section of sectionPairs) {
    doc.addPage()
    if (section.id === 'hair') {
      drawHairFeaturePage(doc, section, featurePageNum, section.beforeJpeg)
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
      drawChinFeaturePage(doc, section, featurePageNum, section.beforeJpeg, section.profileJpeg, section.profileIsReal)
    } else if (section.id === 'skin') {
      drawSkinFeaturePage(doc, section, featurePageNum, section.beforeJpeg)
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
  addFooter(doc, pageNum++)

  const safeName = clientName.replace(/[^\w\s-]/g, '').trim() || 'Client'
  doc.save(`MyFace-Protocol-${safeName.replace(/\s+/g, '-')}.pdf`)
}
