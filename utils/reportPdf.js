import { jsPDF } from 'jspdf'
import {
  projectFullFaceAfter,
  projectFeatureAfter,
  cropFeatureBefore,
  normalizeToJpegDataUrl,
} from './aestheticProjection'
import { safeDisplay } from './safeFormat'
import {
  buildClosingRecommendations,
  buildFeaturePages,
  buildProtocolContents,
  DISCLAIMER_PARAGRAPHS,
  formatProtocolEditionDate,
  formatProtocolMonth,
  getClientName,
  getRadarData,
  INTRODUCTION_PARAGRAPHS,
  UNDERSTANDING_RESULTS,
} from './qovesProtocolModel'

const BRAND = { r: 15, g: 118, b: 110 }
const SLATE = { r: 51, g: 65, b: 85 }
const INK = { r: 23, g: 23, b: 23 }
const MUTED = { r: 100, g: 116, b: 125 }
const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 48
const CONTENT_W = PAGE_W - MARGIN * 2

function setBrand(doc) {
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b)
}

function setInk(doc) {
  doc.setTextColor(INK.r, INK.g, INK.b)
}

function setMuted(doc) {
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b)
}

function addFooter(doc, pageNum) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text('AuraScan · Confidential Facial Analysis', MARGIN, PAGE_H - 28)
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 28, { align: 'right' })
}

function addPageHeader(doc, title, subtitle) {
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, PAGE_W, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  setInk(doc)
  doc.text(title, MARGIN, 52)
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    setMuted(doc)
    doc.text(subtitle, MARGIN, 68)
  }
  doc.setDrawColor(230, 235, 238)
  doc.line(MARGIN, 78, PAGE_W - MARGIN, 78)
}

function wrapText(doc, text, x, y, maxWidth, lineHeight = 14) {
  const lines = doc.splitTextToSize(text || '', maxWidth)
  lines.forEach((line, i) => doc.text(line, x, y + i * lineHeight))
  return y + lines.length * lineHeight
}

function drawScoreBar(doc, x, y, width, height, score, label) {
  doc.setFillColor(240, 244, 245)
  doc.roundedRect(x, y, width, height, 2, 2, 'F')
  const fillW = (Math.min(100, Math.max(0, score)) / 100) * width
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.roundedRect(x, y, fillW, height, 2, 2, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(doc)
  doc.text(label, x, y - 3)
  setBrand(doc)
  doc.setFont('helvetica', 'bold')
  doc.text(String(score), x + width + 8, y + height - 1)
}

function fitImage(w, h, maxW, maxH) {
  const ratio = Math.min(maxW / w, maxH / h)
  return { w: w * ratio, h: h * ratio }
}

function addPdfImage(doc, dataUrl, x, y, maxW, maxH) {
  if (!dataUrl) return { w: 0, h: 0 }
  const props = doc.getImageProperties(dataUrl)
  const fit = fitImage(props.width, props.height, maxW, maxH)
  doc.addImage(dataUrl, 'JPEG', x, y, fit.w, fit.h, undefined, 'FAST')
  return fit
}

function tipsFromExplanation(explanation, fallbacks = []) {
  if (!explanation) return fallbacks.length ? fallbacks : ['Follow the personalized protocol for this feature.']
  const parts = explanation.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean)
  return parts.slice(0, 3).map((s) => (s.endsWith('.') ? s : `${s}.`))
}

function buildProtocolSections(cvReport, photoJpeg, eyeAnalysis) {
  const face = cvReport?.symmetry?.imageSrc || cvReport?.faceShape?.imageSrc || photoJpeg
  const sections = [
    { id: 'hair', title: 'Hair', score: cvReport?.hair?.score,
      before: cvReport?.hair?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.hair?.explanation, [
        'Keep hairline clean with regular trims.',
        'Use lightweight products to avoid weighing hair down.',
      ]),
    },
    { id: 'eyebrows', title: 'Eyebrows', score: cvReport?.eyebrows?.metrics ? 80 : null,
      before: cvReport?.eyebrows?.crop || face,
      tips: tipsFromExplanation(null, [
        `Shape: ${safeDisplay(cvReport?.eyebrows?.metrics?.shape, 'Natural')}. Consider professional grooming for definition.`,
        'Brush brows upward in the morning for a lifted look.',
      ]),
    },
    { id: 'eyes', title: 'Eyes', score: cvReport?.eyes?.score,
      before: eyeAnalysis?.eyesCrop || face,
      tips: tipsFromExplanation(eyeAnalysis?.metrics?.explanation || cvReport?.eyes?.explanation, [
        'Prioritize 7–9 hours sleep to reduce periorbital shadows.',
        'Apply SPF and sunglasses to protect the delicate eye area.',
      ]),
    },
    { id: 'nose', title: 'Nose', score: cvReport?.nose?.score,
      before: cvReport?.nose?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.nose?.explanation, [
        'Subtle highlight along the bridge can refine proportions.',
        'Keep skin matte on the nose to reduce shine.',
      ]),
    },
    { id: 'cheeks', title: 'Cheeks', score: cvReport?.cheeks?.score,
      before: cvReport?.cheeks?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.cheeks?.explanation, [
        'Maintain even hydration across both cheeks.',
        'Light contour can enhance cheekbone definition.',
      ]),
    },
    { id: 'jaw', title: 'Jaw', score: cvReport?.jaw?.score || cvReport?.jawChin?.score,
      before: cvReport?.jaw?.imageSrc || cvReport?.jawChin?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.jaw?.explanation || cvReport?.jawChin?.explanation, [
        'Jaw exercises can support lower-face definition over time.',
        'Maintain good posture for a sharper jaw-neck angle.',
      ]),
    },
    { id: 'lips', title: 'Lips', score: cvReport?.lips?.score,
      before: cvReport?.lips?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.lips?.explanation, [
        'Use a hydrating lip balm with ceramides daily.',
        'Gentle exfoliation 1–2× weekly keeps lips smooth.',
      ]),
    },
    { id: 'chin', title: 'Chin', score: cvReport?.chin?.score || cvReport?.jawChin?.score,
      before: cvReport?.chin?.imageSrc || cvReport?.jawChin?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.chin?.explanation, [
        'Chin posture exercises support a balanced profile.',
        'Keep beard lines sharp if facial hair is worn.',
      ]),
    },
    { id: 'skin', title: 'Skin', score: cvReport?.skin?.score,
      before: face,
      tips: tipsFromExplanation(cvReport?.skin?.explanation, [
        'Daily SPF 30+ is the foundation of skin improvement.',
        'Consistent cleanser + moisturizer morning and night.',
      ]),
    },
    { id: 'neck', title: 'Neck', score: cvReport?.neck?.score,
      before: cvReport?.neck?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.neck?.explanation, [
        'Extend skincare routine to the neck and décolletage.',
        'Neck stretches improve posture and jaw-neck transition.',
      ]),
    },
    { id: 'ears', title: 'Ears', score: cvReport?.ears?.score,
      before: cvReport?.ears?.imageSrc || face,
      tips: tipsFromExplanation(cvReport?.ears?.explanation, [
        'Keep hair styling balanced to frame ear proportions.',
        'Maintain clean, moisturized skin behind the ears.',
      ]),
    },
  ]
  return sections
}

function getFeatureMeasurements(sectionId, cvReport, metrics) {
  const anth = metrics?.anthropometrics?.measurements || []
  const pick = (...ids) => ids.map((id) => anth.find((m) => m.id === id)).filter(Boolean)

  switch (sectionId) {
    case 'hair':
      return pick('hairline').map((m) => `${m.label}: ${m.value} (ideal ${m.ideal})`)
    case 'eyebrows':
      return [`Brow symmetry index: ${safeDisplay(metrics?.anthropometrics?.featureScores?.symmetry, '—')}/100`]
    case 'eyes':
      return pick('canthalTilt', 'interocular').map((m) => `${m.label}: ${m.value} ${m.unit}`)
    case 'nose':
      return [`Nasal W/L: ${safeDisplay(cvReport?.nose?.widthLengthRatio, '—')}`, ...pick('noseWidthIpd').map((m) => `${m.label}: ${m.value}`)]
    case 'jaw':
    case 'chin':
      return pick('jawWidth', 'chinHeight').map((m) => `${m.label}: ${m.value}`)
    case 'lips':
      return pick('philtrumLip').map((m) => `${m.label}: ${m.value} (ideal ${m.ideal})`)
    case 'skin':
      return [`Skin score: ${cvReport?.skin?.score || '—'}/100`, `Tone: ${safeDisplay(cvReport?.skin?.tone, '—')}`]
    default:
      return sectionId === 'cheeks' || sectionId === 'neck' || sectionId === 'ears'
        ? [`Feature score: ${cvReport?.[sectionId]?.score || '—'}/100`]
        : pick('symmetry').map((m) => `${m.label}: ${m.value}`)
  }
}

function drawRadarChart(doc, cx, cy, radius, items) {
  const n = items.length
  const angleStep = (Math.PI * 2) / n
  const toPoint = (score, i) => {
    const a = -Math.PI / 2 + i * angleStep
    const r = (score / 100) * radius
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  }

  doc.setDrawColor(220, 225, 230)
  doc.setLineWidth(0.5)
  ;[0.25, 0.5, 0.75, 1].forEach((lvl) => {
    doc.circle(cx, cy, radius * lvl, 'S')
  })

  items.forEach((_, i) => {
    const a = -Math.PI / 2 + i * angleStep
    doc.line(cx, cy, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
  })

  const currentPts = items.map((item, i) => toPoint(item.score, i))
  const projectedPts = items.map((item, i) => toPoint(item.projected, i))

  const drawPoly = (pts, fillRgb, strokeRgb) => {
    if (pts.length < 3) return
    doc.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2])
    doc.setDrawColor(strokeRgb[0], strokeRgb[1], strokeRgb[2])
    doc.setLineWidth(1)
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i]
      const p2 = pts[(i + 1) % pts.length]
      doc.triangle(cx, cy, p1.x, p1.y, p2.x, p2.y, 'FD')
    }
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i]
      const p2 = pts[(i + 1) % pts.length]
      doc.line(p1.x, p1.y, p2.x, p2.y)
    }
  }

  drawPoly(projectedPts, [BRAND.r, BRAND.g, BRAND.b], [BRAND.r, BRAND.g, BRAND.b])
  drawPoly(currentPts, [SLATE.r, SLATE.g, SLATE.b], [INK.r, INK.g, INK.b])

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  setMuted(doc)
  items.forEach((item, i) => {
    const a = -Math.PI / 2 + i * angleStep
    const lx = cx + Math.cos(a) * (radius + 14)
    const ly = cy + Math.sin(a) * (radius + 14)
    doc.text(item.label, lx, ly, { align: 'center' })
  })
}

function drawBeforeAfterPair(doc, y, beforeSrc, afterSrc, imgMaxH = 200) {
  const colW = (CONTENT_W - 20) / 2
  const labelY = y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text('BEFORE', MARGIN + colW / 2, labelY, { align: 'center' })
  doc.text('AFTER (PROJECTED)', MARGIN + colW + 20 + colW / 2, labelY, { align: 'center' })
  y += 14

  // Frame backgrounds
  doc.setFillColor(248, 250, 251)
  doc.roundedRect(MARGIN, y, colW, imgMaxH + 8, 4, 4, 'F')
  doc.roundedRect(MARGIN + colW + 20, y, colW, imgMaxH + 8, 4, 4, 'F')

  const pad = 4
  const innerW = colW - pad * 2
  const beforeProps = beforeSrc ? doc.getImageProperties(beforeSrc) : null
  const afterProps = afterSrc ? doc.getImageProperties(afterSrc) : null
  const beforeFit = beforeProps ? fitImage(beforeProps.width, beforeProps.height, innerW, imgMaxH) : { w: 0, h: 0 }
  const afterFit = afterProps ? fitImage(afterProps.width, afterProps.height, innerW, imgMaxH) : { w: 0, h: 0 }

  if (beforeSrc && beforeFit.w > 0) {
    doc.addImage(beforeSrc, 'JPEG', MARGIN + pad + (innerW - beforeFit.w) / 2, y + pad, beforeFit.w, beforeFit.h, undefined, 'FAST')
  }
  if (afterSrc && afterFit.w > 0) {
    doc.addImage(afterSrc, 'JPEG', MARGIN + colW + 20 + pad + (innerW - afterFit.w) / 2, y + pad, afterFit.w, afterFit.h, undefined, 'FAST')
  }
  const rowH = Math.max(beforeFit.h, afterFit.h, imgMaxH) + pad * 2 + 8
  return y + rowH
}

function getFeatureScores(cvReport) {
  return [
    { label: 'Symmetry', score: cvReport?.symmetry?.score },
    { label: 'Proportions', score: cvReport?.proportions?.score },
    { label: 'Face Shape', score: cvReport?.faceShape ? 82 : null },
    { label: 'Nose', score: cvReport?.nose?.score },
    { label: 'Lips', score: cvReport?.lips?.score },
    { label: 'Jaw & Chin', score: cvReport?.jawChin?.score },
    { label: 'Skin', score: cvReport?.skin?.score },
    { label: 'Hair', score: cvReport?.hair?.score },
    { label: 'Eyes', score: cvReport?.eyes?.score || cvReport?.eyebrows ? 80 : null },
  ].filter((f) => f.score != null)
}

function getMeasurements(cvReport, metrics) {
  const rows = []
  if (metrics?.harmonyScore) rows.push(['Harmony Score', `${metrics.harmonyScore}/100`])
  if (metrics?.symmetry) rows.push(['Symmetry Index', `${metrics.symmetry}%`])
  if (metrics?.proportionality) rows.push(['Proportionality', `${metrics.proportionality}%`])
  if (metrics?.visualAge) rows.push(['Visual Age Estimate', `${metrics.visualAge} years`])
  if (cvReport?.faceShape) {
    rows.push(['Face Shape', cvReport.faceShape.shape])
    rows.push(['Width / Height Ratio', cvReport.faceShape.widthHeightRatio])
  }
  if (cvReport?.proportions) {
    rows.push(['Upper Third', cvReport.proportions.upperThird])
    rows.push(['Middle Third', cvReport.proportions.middleThird])
    rows.push(['Lower Third', cvReport.proportions.lowerThird])
  }
  if (cvReport?.nose?.widthLengthRatio) rows.push(['Nasal W/L Ratio', cvReport.nose.widthLengthRatio])
  if (cvReport?.lips?.philtrumToLipRatio) rows.push(['Philtrum / Lip Ratio', cvReport.lips.philtrumToLipRatio])
  if (cvReport?.dimorphism?.overallScore) rows.push(['Dimorphism Index', `${cvReport.dimorphism.overallScore}/100`])
  if (cvReport?.averageness?.score) rows.push(['Averageness', `${cvReport.averageness.score}/100`])
  return rows
}

/**
 * Generate and download AuraScan Qoves-style aesthetic protocol PDF.
 */
export async function downloadAuraScanPdf({
  photo,
  cvReport,
  metrics,
  landmarks,
  protocolData,
  answers,
  eyeAnalysis,
  aiNarrative,
}) {
  if (!photo || !cvReport) throw new Error('Photo and analysis data required for PDF export')

  const photoJpeg = await normalizeToJpegDataUrl(photo)
  const featurePages = buildFeaturePages(cvReport, eyeAnalysis)

  const [afterFull, ...sectionPairs] = await Promise.all([
    projectFullFaceAfter(photoJpeg, landmarks, cvReport, metrics),
    ...featurePages.map(async (page) => {
      const [beforeJpeg, afterJpeg] = await Promise.all([
        cropFeatureBefore(photoJpeg, landmarks, page.projectionId),
        projectFeatureAfter(photoJpeg, landmarks, page.projectionId, cvReport, metrics),
      ])
      return { ...page, beforeJpeg, afterJpeg }
    }),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  let pageNum = 1
  let y = 0
  const clientName = getClientName(answers)
  const monthLabel = formatProtocolMonth()
  const editionLabel = formatProtocolEditionDate()
  const closingParagraphs = buildClosingRecommendations(aiNarrative, cvReport, clientName)
  const contents = buildProtocolContents(clientName)

  // ── Page 1: Cover (Qoves-style) ──
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('AURASCAN', MARGIN, 72)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(220, 220, 220)
  doc.text(`${clientName}  ${monthLabel}`, MARGIN, 110)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.setTextColor(255, 255, 255)
  doc.text('Aesthetic', MARGIN, 170)
  doc.text('Protocol', MARGIN, 210)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 180, 180)
  doc.text(`WRITTEN ${editionLabel} PROTOCOL EDITION`, MARGIN, 240)
  addPdfImage(doc, photoJpeg, PAGE_W - MARGIN - 160, 280, 160, 200)
  addFooter(doc, pageNum++)

  // ── Page 2: Disclaimer ──
  doc.addPage()
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text('PAGE / 02', MARGIN, 40)
  doc.setFontSize(20)
  setInk(doc)
  doc.text('Disclaimer Policy', MARGIN, 68)
  y = 92
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(doc)
  DISCLAIMER_PARAGRAPHS.forEach((para) => {
    y = wrapText(doc, para, MARGIN, y, CONTENT_W, 13) + 10
  })
  setMuted(doc)
  y = wrapText(
    doc,
    `The following report was commissioned for ${clientName} on ${monthLabel}.`,
    MARGIN,
    y + 8,
    CONTENT_W,
    13
  )
  addFooter(doc, pageNum++)

  // ── Page 3: Introduction + Contents ──
  doc.addPage()
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text('PAGE / 03', MARGIN, 40)
  doc.setFontSize(20)
  setInk(doc)
  doc.text('Introduction', MARGIN, 68)
  y = 92
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  INTRODUCTION_PARAGRAPHS.forEach((para) => {
    y = wrapText(doc, para, MARGIN, y, CONTENT_W, 13) + 10
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('Contents', MARGIN, y + 8)
  y += 24
  doc.setFont('helvetica', 'normal')
  contents.forEach((item) => {
    doc.text(item.label, MARGIN, y)
    doc.text(String(item.page).padStart(2, '0'), PAGE_W - MARGIN, y, { align: 'right' })
    y += 16
  })
  addFooter(doc, pageNum++)

  // ── Page 4: Understanding Your Results ──
  doc.addPage()
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text('PAGE / 04', MARGIN, 40)
  doc.setFontSize(20)
  setInk(doc)
  doc.text('Understanding Your Results', MARGIN, 68)
  y = 96
  UNDERSTANDING_RESULTS.forEach((item, idx) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setBrand(doc)
    doc.text(String(idx + 1).padStart(2, '0'), MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setInk(doc)
    y = wrapText(doc, item, MARGIN + 24, y - 2, CONTENT_W - 24, 13) + 14
  })
  addFooter(doc, pageNum++)

  // ── Page 5: Client protocol overview ──
  doc.addPage()
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text('PAGE / 05', MARGIN, 40)
  doc.setFontSize(20)
  setInk(doc)
  doc.text(`${clientName}'s Protocol`, MARGIN, 68)
  y = 92
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  y = wrapText(
    doc,
    protocolData?.summary ||
      'To help you achieve your aesthetic potential, this evidence-based protocol is grounded in your measured facial analysis. Projected images use region-specific corrections derived from anthropometric data.',
    MARGIN,
    y,
    CONTENT_W,
    13
  ) + 12
  y = drawBeforeAfterPair(doc, y, photoJpeg, afterFull, 170)
  y += 8
  const radarItems = getRadarData(cvReport)
  drawRadarChart(doc, PAGE_W / 2, y + 88, 68, radarItems)
  addFooter(doc, pageNum++)

  // ── Per-feature protocol pages (Qoves-style) ──
  let featurePageNum = 6
  for (const section of sectionPairs) {
    doc.addPage()
    doc.setFillColor(INK.r, INK.g, INK.b)
    doc.rect(0, 0, PAGE_W, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setMuted(doc)
    doc.text(`PAGE / ${String(featurePageNum).padStart(2, '0')}`, MARGIN, 40)
    doc.setFontSize(18)
    setInk(doc)
    doc.text(section.title, MARGIN, 68)
    y = 88

    section.subsections.forEach((sub) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      setInk(doc)
      doc.text(sub.title, MARGIN, y)
      y += 14
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setMuted(doc)
      y = wrapText(doc, sub.body, MARGIN, y, CONTENT_W, 12) + 10
    })

    y = drawBeforeAfterPair(doc, y, section.beforeJpeg, section.afterJpeg, 150)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setInk(doc)
    const summaryTitle = `${section.title.replace(' Recommendations', '')} Summary`
    doc.text(summaryTitle, MARGIN, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    setMuted(doc)
    wrapText(doc, section.summary, MARGIN, y, CONTENT_W, 12)
    addFooter(doc, pageNum++)
    featurePageNum += 1
  }

  // ── Closing Recommendations (admin AI narrative) ──
  doc.addPage()
  doc.setFillColor(INK.r, INK.g, INK.b)
  doc.rect(0, 0, PAGE_W, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  setMuted(doc)
  doc.text('PAGE / 16', MARGIN, 40)
  doc.setFontSize(20)
  setInk(doc)
  doc.text('Closing Recommendations', MARGIN, 68)
  y = 96
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setInk(doc)
  closingParagraphs.forEach((para) => {
    if (y > PAGE_H - 80) {
      addFooter(doc, pageNum++)
      doc.addPage()
      y = 72
    }
    y = wrapText(doc, para, MARGIN, y, CONTENT_W, 13) + 12
  })
  addFooter(doc, pageNum++)

  const safeName = clientName.replace(/[^\w\s-]/g, '').trim() || 'Client'
  doc.save(`AuraScan-Protocol-${safeName.replace(/\s+/g, '-')}.pdf`)
}
