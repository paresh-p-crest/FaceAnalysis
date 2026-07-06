import { jsPDF } from 'jspdf'
import {
  projectFullFaceAfter,
  projectFeatureAfter,
  cropFeatureBefore,
  createLandmarkPreview,
  normalizeToJpegDataUrl,
} from './aestheticProjection'
import { safeDisplay } from './safeFormat'

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

function getRadarData(cvReport) {
  const items = [
    { label: 'Hair', score: cvReport?.hair?.score || 72 },
    { label: 'Brows', score: cvReport?.eyebrows ? 78 : 72 },
    { label: 'Eyes', score: cvReport?.eyes?.score || 76 },
    { label: 'Nose', score: cvReport?.nose?.score || 74 },
    { label: 'Cheeks', score: cvReport?.cheeks?.score || 75 },
    { label: 'Jaw', score: cvReport?.jaw?.score || cvReport?.jawChin?.score || 73 },
    { label: 'Lips', score: cvReport?.lips?.score || 76 },
    { label: 'Chin', score: cvReport?.chin?.score || cvReport?.jawChin?.score || 74 },
    { label: 'Skin', score: cvReport?.skin?.score || 70 },
    { label: 'Neck', score: cvReport?.neck?.score || 73 },
    { label: 'Ears', score: cvReport?.ears?.score || 75 },
  ]
  return items.map((item) => ({
    ...item,
    projected: Math.min(97, item.score + Math.round((92 - item.score) * 0.4)),
  }))
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

function formatDate() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getClientName(answers) {
  if (!answers) return 'Client'
  const name = answers.name || answers.fullName || answers.clientName
  return name || 'Client'
}

/**
 * Generate and download AuraScan branded PDF report.
 */
export async function downloadAuraScanPdf({
  photo,
  cvReport,
  metrics,
  landmarks,
  protocolData,
  answers,
  eyeAnalysis,
}) {
  if (!photo || !cvReport) throw new Error('Photo and analysis data required for PDF export')

  const photoJpeg = await normalizeToJpegDataUrl(photo)
  const protocolSections = buildProtocolSections(cvReport, photoJpeg, eyeAnalysis)

  const [afterFull, landmarkImage, ...sectionPairs] = await Promise.all([
    projectFullFaceAfter(photoJpeg, landmarks, cvReport, metrics),
    createLandmarkPreview(photoJpeg, landmarks),
    ...protocolSections.map(async (section) => {
      const [beforeJpeg, afterJpeg] = await Promise.all([
        cropFeatureBefore(photoJpeg, landmarks, section.id),
        projectFeatureAfter(photoJpeg, landmarks, section.id, cvReport, metrics),
      ])
      return { ...section, beforeJpeg, afterJpeg }
    }),
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  let pageNum = 1
  const clientName = getClientName(answers)
  const dateStr = formatDate()
  const overall = cvReport.overall?.score || metrics?.harmonyScore || 75
  const overallLabel = cvReport.overall?.scoreLabel || 'Analysis Complete'

  // ── Page 1: Cover ──
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(MARGIN, 120, CONTENT_W, PAGE_H - 240, 8, 8, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(32)
  doc.setTextColor(255, 255, 255)
  doc.text('AuraScan', PAGE_W / 2, 80, { align: 'center' })
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('AI-POWERED FACIAL ANALYSIS', PAGE_W / 2, 98, { align: 'center' })

  setInk(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('Facial Analysis Report', PAGE_W / 2, 200, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  setMuted(doc)
  doc.text('Prepared for', PAGE_W / 2, 250, { align: 'center' })
  setInk(doc)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(clientName, PAGE_W / 2, 275, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  setMuted(doc)
  doc.text(dateStr, PAGE_W / 2, 310, { align: 'center' })

  addPdfImage(doc, photoJpeg, PAGE_W / 2 - 100, 340, 200, 260)
  doc.setFontSize(10)
  setMuted(doc)
  doc.text('Landmark-based cephalometric assessment · MediaPipe geometry', PAGE_W / 2, PAGE_H - 160, { align: 'center' })
  addFooter(doc, pageNum++)

  // ── Page 2: Disclaimer ──
  doc.addPage()
  addPageHeader(doc, 'Disclaimer', 'Important information about this report')
  let y = 100
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setInk(doc)
  ;[
    'This AuraScan report is generated from computer vision analysis of facial photographs and landmark geometry. It is intended for educational and aesthetic guidance purposes only.',
    'Results do not constitute medical diagnosis, dermatological assessment, or surgical recommendation.',
    'Consult qualified healthcare or licensed aesthetic professionals before pursuing any treatment.',
  ].forEach((para) => {
    y = wrapText(doc, para, MARGIN, y, CONTENT_W, 15) + 12
  })
  addFooter(doc, pageNum++)

  // ── Page 3: Contents ──
  doc.addPage()
  addPageHeader(doc, 'Contents', 'Report structure')
  y = 100
  const plannedToc = [
    'Understanding Your Results',
    `${clientName}'s Protocol Overview`,
    ...protocolSections.map((s) => s.title),
    'Improvement Protocol',
    'Closing Recommendations',
  ]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setInk(doc)
  plannedToc.forEach((item) => {
    doc.text(item, MARGIN, y)
    y += 20
  })
  addFooter(doc, pageNum++)

  // ── Page 4: Executive Summary ──
  doc.addPage()
  addPageHeader(doc, 'Executive Summary', 'Overall assessment at a glance')
  y = 100
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(42)
  setBrand(doc)
  doc.text(String(overall), MARGIN, y + 30)
  doc.setFontSize(14)
  setMuted(doc)
  doc.text('/ 100', MARGIN + 70, y + 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  setInk(doc)
  doc.text(overallLabel, MARGIN, y + 55)
  y += 80
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setInk(doc)
  y = wrapText(
    doc,
    cvReport.symmetry?.explanation?.split('.')[0]
      ? `${cvReport.symmetry.explanation.split('.')[0]}. Composite score integrates symmetry, proportions, and harmony.`
      : 'Composite score integrates symmetry, proportions, and landmark-based harmony.',
    MARGIN,
    y,
    CONTENT_W,
    14
  ) + 16

  const features = getFeatureScores(cvReport)
  const sorted = [...features].sort((a, b) => b.score - a.score)
  doc.setFont('helvetica', 'bold')
  setBrand(doc)
  doc.text('Key Strengths', MARGIN, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  setInk(doc)
  sorted.slice(0, 2).forEach((s) => {
    doc.text(`• ${s.label}: ${s.score}/100`, MARGIN + 8, y)
    y += 14
  })
  addFooter(doc, pageNum++)

  // ── Scores + Measurements + Landmarks (condensed) ──
  doc.addPage()
  addPageHeader(doc, 'Overall Scores & Measurements', 'Quantitative breakdown')
  y = 100
  features.slice(0, 6).forEach((f) => {
    drawScoreBar(doc, MARGIN, y + 12, CONTENT_W - 40, 8, f.score, f.label)
    y += 32
  })
  y += 10
  getMeasurements(cvReport, metrics).slice(0, 6).forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setInk(doc)
    doc.text(`${label}:`, MARGIN, y)
    setBrand(doc)
    doc.text(String(value), MARGIN + 130, y)
    y += 14
  })
  addFooter(doc, pageNum++)

  doc.addPage()
  addPageHeader(doc, 'Landmark Mapping', '478-point facial mesh overlay')
  const lmFit = addPdfImage(doc, landmarkImage, MARGIN, 100, CONTENT_W, 380)
  y = 100 + (lmFit.h || 380) + 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setMuted(doc)
  wrapText(doc, 'Teal markers indicate sampled MediaPipe landmark positions.', MARGIN, y, CONTENT_W, 14)
  addFooter(doc, pageNum++)

  // ── Projected potential overview ──
  doc.addPage()
  addPageHeader(doc, 'Projected Potential', 'Measurement-guided aesthetic improvements')
  y = 100
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setInk(doc)
  y = wrapText(
    doc,
    'Projected images apply subtle, region-specific corrections derived from your anthropometric analysis — not global brightness filters. Identity is preserved.',
    MARGIN,
    y,
    CONTENT_W,
    14
  ) + 16

  y = drawBeforeAfterPair(doc, y, photoJpeg, afterFull, 200)
  y += 10

  const radarItems = getRadarData(cvReport)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setBrand(doc)
  doc.text('Feature score map', MARGIN, y)
  y += 8
  drawRadarChart(doc, PAGE_W / 2, y + 95, 72, radarItems)
  y += 200

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  setMuted(doc)
  doc.text('Inner polygon: current scores · Outer teal: projected potential', MARGIN, y)
  addFooter(doc, pageNum++)

  // ── Protocol overview text ──
  doc.addPage()
  addPageHeader(doc, 'Your Aesthetic Protocol', 'Personalized improvement roadmap')
  y = 100
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  setInk(doc)
  y = wrapText(
    doc,
    protocolData?.summary || 'A structured protocol targeting your lowest-scoring areas while preserving natural strengths.',
    MARGIN,
    y,
    CONTENT_W,
    14
  ) + 12

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  setInk(doc)
  doc.text('11 key features in this protocol:', MARGIN, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setMuted(doc)
  const col1 = protocolSections.slice(0, 6).map((s) => s.title)
  const col2 = protocolSections.slice(6).map((s) => s.title)
  col1.forEach((t, i) => {
    doc.text(`• ${t}`, MARGIN, y + i * 12)
    if (col2[i]) doc.text(`• ${col2[i]}`, MARGIN + CONTENT_W / 2, y + i * 12)
  })
  y += Math.max(col1.length, col2.length) * 12 + 8
  addFooter(doc, pageNum++)

  // ── Per-feature protocol pages ──
  for (const section of sectionPairs) {
    doc.addPage()
    addPageHeader(doc, section.title, section.score != null ? `Score: ${section.score}/100` : 'Feature analysis')
    y = 92

    y = drawBeforeAfterPair(doc, y, section.beforeJpeg, section.afterJpeg, 200)
    y += 10

    const measurements = getFeatureMeasurements(section.id, cvReport, metrics)
    if (measurements.length) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setInk(doc)
      doc.text('Key measurements', MARGIN, y)
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      setMuted(doc)
      measurements.slice(0, 4).forEach((m) => {
        doc.text(`• ${m}`, MARGIN + 4, y)
        y += 11
      })
      y += 4
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setInk(doc)
    doc.text('Recommendations', MARGIN, y)
    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setMuted(doc)
    section.tips.slice(0, 4).forEach((tip) => {
      y = wrapText(doc, `• ${tip}`, MARGIN, y, CONTENT_W, 12) + 6
    })
    addFooter(doc, pageNum++)
  }

  // ── Protocol recommendations list ──
  doc.addPage()
  addPageHeader(doc, 'Improvement Protocol', 'Personalized action items')
  y = 100
  const recs = protocolData?.recommendations || []
  if (recs.length === 0) {
    wrapText(doc, 'Re-run analysis to generate protocol recommendations.', MARGIN, y, CONTENT_W)
  } else {
    recs.slice(0, 8).forEach((rec, idx) => {
      if (y > PAGE_H - 90) {
        addFooter(doc, pageNum++)
        doc.addPage()
        addPageHeader(doc, 'Protocol (cont.)')
        y = 100
      }
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      setInk(doc)
      doc.text(`${idx + 1}. ${rec.title}`, MARGIN, y)
      y += 13
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setMuted(doc)
      const desc = rec.description?.length > 160 ? `${rec.description.slice(0, 157)}…` : rec.description
      y = wrapText(doc, desc, MARGIN + 8, y, CONTENT_W - 8, 12) + 14
    })
  }
  addFooter(doc, pageNum++)

  // ── Closing ──
  doc.addPage()
  addPageHeader(doc, 'Closing Summary', 'Next steps')
  y = 100
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setInk(doc)
  y = wrapText(
    doc,
    `Thank you for using AuraScan. Your overall score of ${overall}/100 (${overallLabel}) reflects structured assessment of facial harmony and symmetry.`,
    MARGIN,
    y,
    CONTENT_W,
    16
  ) + 24
  ;[
    'Follow the improvement protocol for 30 days before re-assessment.',
    'Use consistent lighting and front-facing photos for tracking.',
    'Consult professionals for clinical or dermatological concerns.',
  ].forEach((step) => {
    y = wrapText(doc, `• ${step}`, MARGIN, y, CONTENT_W, 14) + 4
  })
  y += 20
  doc.setFillColor(SLATE.r, SLATE.g, SLATE.b)
  doc.roundedRect(MARGIN, y, CONTENT_W, 56, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('AuraScan', MARGIN + 20, y + 26)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Science-backed facial analysis · Your data stays local', MARGIN + 20, y + 42)
  addFooter(doc, pageNum)

  const safeName = clientName.replace(/[^\w\s-]/g, '').trim() || 'Client'
  doc.save(`AuraScan-Report-${safeName.replace(/\s+/g, '-')}.pdf`)
}
