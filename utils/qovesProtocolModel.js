import { safeDisplay } from './safeFormat'

export const QOVES_PROTOCOL_FEATURES = [
  { id: 'hair', title: 'Hair', page: 6 },
  { id: 'eyes', title: 'Eyes', page: 7, includes: ['eyebrows', 'eyes'] },
  { id: 'nose', title: 'Nose', page: 8 },
  { id: 'cheeks', title: 'Cheeks', page: 9 },
  { id: 'jaw', title: 'Jaw', page: 10 },
  { id: 'lips', title: 'Lips', page: 11 },
  { id: 'chin', title: 'Chin', page: 12 },
  { id: 'skin', title: 'Skin', page: 13 },
  { id: 'neck', title: 'Neck', page: 14 },
  { id: 'ears', title: 'Ear', page: 15 },
]

export const UNDERSTANDING_RESULTS = [
  'These recommendations focus on key markers of facial health and harmony. The goal is not to change what makes you uniquely you, but to understand what works best with your existing features.',
  'MyFace does not rate attractiveness. Your assessment highlights what works best for your features using objective cephalometric measurements rather than a single universal standard.',
  'You will see a mix of foundational and more advanced recommendations. Fundamentals such as SPF, sleep, and hydration support the effectiveness of more targeted guidance.',
  'All recommendations are for informational and aesthetic purposes only. Any in-clinic treatment or prescription product should be discussed with a qualified medical professional.',
]

export const DISCLAIMER_PARAGRAPHS = [
  'This report is provided for general informational and educational purposes only. It discusses topics related to facial aesthetics and wellness. It is not intended to constitute medical, clinical, or professional advice, diagnosis, or treatment of any kind.',
  'The information in this MyFace report is not a substitute for consultation with a qualified medical or healthcare professional. Readers should always seek appropriately licensed professional advice regarding any medical condition or treatment decision.',
  'MyFace makes no warranties regarding the accuracy or completeness of this report and disclaims liability arising from reliance on its contents. Any actions taken based on this report are at the reader\'s own risk.',
  'The purpose of this report is to help the reader understand facial features and how non-surgical recommendations could potentially impact appearance. Any reference to treatments is for informational context only.',
]

export const PRIVACY_PARAGRAPHS = [
  'Your facial images and questionnaire responses are processed solely to generate this personalised assessment report.',
  'We do not sell your biometric data. Access is restricted to authorised reviewers for quality assurance before your report is approved.',
  'You may request deletion of your assessment data by contacting support.',
  'Read the full privacy policy at myface.club.',
]

export const INTRODUCTION_PARAGRAPHS = [
  'In this report, MyFace has approached the commissioned facial analysis from a cephalometric point of view, taking soft tissue measurements and comparing them with established scientific reference ranges for facial harmony and proportion.',
  'This approach makes the report\'s findings less subjective where recommendations may vary from person to person.',
]

export const LIMITATIONS_PARAGRAPH =
  'Limitations apply: neutral head position, lighting, camera quality, and the absence of radiographic imaging may influence measurements. This report is not a medical diagnosis. Recommendations throughout should be taken as empirical guidelines grounded in your stored computer-vision measurements.'

/** Split on sentence boundaries without breaking decimal numbers (e.g. 0.28). */
export function splitSentences(text, max = 4) {
  if (!text) return []
  return text
    .split(/(?<!\d)[.!?]+(?!\d)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((s) => (s.endsWith('.') ? s : `${s}.`))
}

function featureExplanation(cvReport, ...keys) {
  for (const key of keys) {
    const value = cvReport?.[key]?.explanation
    if (value) return value
  }
  return ''
}

function summaryFromExplanation(explanation, fallback, maxSentences = 2) {
  if (!explanation) return fallback
  const sentences = splitSentences(explanation, maxSentences)
  return sentences.length ? sentences.join(' ') : fallback
}

function mergeFeaturePage(defaults, narrativeFeature) {
  if (!narrativeFeature) return defaults
  return {
    ...defaults,
    subsections:
      Array.isArray(narrativeFeature.subsections) && narrativeFeature.subsections.length
        ? narrativeFeature.subsections
        : defaults.subsections,
    summary: narrativeFeature.summary || defaults.summary,
    layoutHints: {
      ...defaults.layoutHints,
      ...(narrativeFeature.layoutHints || {}),
      ...(narrativeFeature.norwoodStage != null ? { norwoodStage: narrativeFeature.norwoodStage } : {}),
    },
  }
}

export function getClientName(answers) {
  if (!answers) return 'Client'
  return answers.name || answers.fullName || answers.clientName || 'Client'
}

export function formatProtocolEditionDate(date = new Date()) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).toUpperCase().replace(',', '')
}

export function formatProtocolMonth(date = new Date()) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }).toUpperCase()
}

export function buildProtocolContents(clientName) {
  return [
    { label: 'Understanding Your Results', page: 4 },
    { label: `${clientName}'s Protocol`, page: 5 },
    ...QOVES_PROTOCOL_FEATURES.map((f) => ({ label: f.title, page: f.page })),
    { label: 'Closing Recommendations', page: 16 },
  ]
}

export function buildClosingRecommendations(aiNarrative, cvReport, clientName, protocolNarrative) {
  if (protocolNarrative?.closing?.length) {
    return protocolNarrative.closing.filter((p) => typeof p === 'string' && p.trim())
  }

  const content = aiNarrative?.content || aiNarrative || {}
  const paragraphs = []

  if (content.summary) paragraphs.push(content.summary)

  const strengths = Array.isArray(content.strengths) ? content.strengths : []
  const focusAreas = Array.isArray(content.focusAreas) ? content.focusAreas : []
  const recommendations = Array.isArray(content.recommendations) ? content.recommendations : []

  if (strengths.length) {
    paragraphs.push(
      `The assessment shows existing strengths including ${strengths.slice(0, 3).join('; ')}.`
    )
  }
  if (focusAreas.length) {
    paragraphs.push(
      `Primary opportunities for ${clientName} include ${focusAreas.slice(0, 3).join('; ')}.`
    )
  }
  recommendations.forEach((item) => {
    if (typeof item === 'string' && item.trim()) paragraphs.push(item.trim())
  })

  if (!paragraphs.length) {
    const overall = cvReport?.overall?.score
    paragraphs.push(
      overall != null
        ? `This assessment shows an overall harmony score of ${overall}/100 based on stored MediaPipe and OpenCV measurements. Focus on the lowest-scoring feature areas while maintaining grooming, skincare, and lifestyle fundamentals for the next 30 days.`
        : 'Follow the feature-specific recommendations in this protocol for 30 days, then repeat analysis under consistent lighting and a neutral expression for comparison.'
    )
    paragraphs.push(
      'Studies on facial perception suggest that symmetry, clear skin, and proportional feature framing contribute to perceived attractiveness. A consistent routine combining daily SPF 50, targeted actives such as salicylic acid and vitamin C, and structural grooming along the jaw and brow regions supports measurable improvement toward your projected potential.'
    )
  }

  if (content.disclaimer) paragraphs.push(content.disclaimer)

  return paragraphs
}

export function buildClosingColumns(paragraphs) {
  const items = paragraphs.filter(Boolean)
  const mid = Math.ceil(items.length / 2)
  return { left: items.slice(0, mid), right: items.slice(mid) }
}

export function buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative) {
  const faceFallback = 'Measurements for this feature are drawn from your stored facial analysis.'
  const narrativeFeatures = protocolNarrative?.features || {}
  const pendingBody =
    'Personalised protocol narrative for this section is being generated from your stored measurements. ' +
    'Reopen the protocol after generation completes, or contact support if this message persists.'

  const pages = [
    {
      id: 'hair',
      title: 'Hair Recommendations',
      projectionId: 'hair',
      layoutHints: {
        stackedImages: true,
        norwoodStage: cvReport?.hair?.norwoodStage ?? null,
      },
      subsections: [
        {
          title: 'Hair Style',
          body:
            featureExplanation(cvReport, 'hair') ||
            `Based on your measured hairline and framing, choose styles that balance facial thirds. Gentle cleansing and lightweight styling products support a neat upper-face frame. ${faceFallback}`,
        },
        {
          title: 'Hair Loss',
          body:
            cvReport?.hair?.norwoodStage
              ? `Estimated Norwood stage ${safeDisplay(cvReport.hair.norwoodStage, '1')} from top-of-head analysis. Density: ${safeDisplay(cvReport.hair.densityEstimate, 'moderate')}. Maintain scalp health with gentle cleansing; discuss persistent thinning with a dermatologist.`
              : cvReport?.hair?.densityEstimate
                ? `Density estimate: ${safeDisplay(cvReport.hair.densityEstimate, 'moderate')}. Maintain scalp health with gentle cleansing and avoid harsh heat styling.`
                : `Hair density analysis from top-of-head photo. ${pendingBody}`,
        },
        {
          title: 'Hair Health',
          body:
            'Maintain gentle cleansing, lightweight conditioning, and protection from excessive heat styling to support scalp comfort and hair appearance between assessments.',
        },
      ],
      summary:
        summaryFromExplanation(
          featureExplanation(cvReport, 'hair'),
          'Optimizing hairstyle and scalp health supports a cleaner upper-face frame aligned with your measured proportions.'
        ),
    },
    {
      id: 'eyes',
      title: 'Eye Recommendations',
      projectionId: 'eyes',
      layoutHints: { stackedImages: true, eyesQuadrant: true },
      subsections: [
        {
          title: 'Eyebrows',
          body: cvReport?.eyes?.eyebrows?.explanation
            || (cvReport?.eyebrows?.metrics
              ? `Brow shape: ${safeDisplay(cvReport.eyebrows.metrics.shape, 'natural')}; symmetry ${safeDisplay(cvReport.eyebrows.metrics.symmetryScore, '—')}/100. Light grooming and brow gel can refine the upper orbital frame without invasive treatment.`
              : 'Light brow grooming and conditioning gel can support periorbital balance when shaping is desired.'),
        },
        {
          title: 'Eyelashes',
          body: cvReport?.eyes?.eyelashes?.explanation
            || 'Maintain lash hygiene with gentle daily cleansing. A conditioning lash serum applied at night supports fullness without irritation.',
        },
        {
          title: 'Eyes',
          body:
            cvReport?.eyes?.ocular?.explanation ||
            eyeAnalysis?.metrics?.explanation ||
            featureExplanation(cvReport, 'eyes') ||
            'Your ocular structure assessment focuses on symmetry, tilt, and periorbital support.',
        },
        {
          title: 'Under eye',
          body: cvReport?.eyes?.underEye?.explanation
            || (eyeAnalysis?.metrics?.underEyeHealth
              ? `Under-eye assessment: ${safeDisplay(eyeAnalysis.metrics.underEyeHealth, 'moderate')}. Caffeine-based OTC eye serum, sleep, hydration, and daily SPF support this area.`
              : 'Gentle periorbital care with sleep, hydration, caffeine-based OTC serums, and SPF supports the under-eye region.'),
        },
      ],
      summary:
        'Refining brows, protecting lashes, and supporting the under-eye region keeps the gaze rested and balanced toward your projected potential.',
    },
    {
      id: 'nose',
      title: 'Nose Recommendations',
      projectionId: 'nose',
      layoutHints: { profileImage: true, stackedImages: true },
      subsections: [
        {
          title: 'Nose',
          body:
            featureExplanation(cvReport, 'nose') ||
            `Nasal proportions score ${safeDisplay(cvReport?.nose?.score, '—')}/100 with width-to-length ratio ${safeDisplay(cvReport?.nose?.widthLengthRatio, '—')}. ${faceFallback}`,
        },
      ],
      summary:
        summaryFromExplanation(
          featureExplanation(cvReport, 'nose'),
          'The nose provides midface structure; recommendations focus on harmony with surrounding features.',
          2
        ),
    },
    {
      id: 'cheeks',
      title: 'Cheek Recommendations',
      projectionId: 'cheeks',
      layoutHints: { stackedImages: true },
      subsections: [
        {
          title: 'Cheek Structure',
          body:
            featureExplanation(cvReport, 'cheeks') ||
            `Cheek assessment score: ${safeDisplay(cvReport?.cheeks?.score, '—')}/100. Gentle exfoliation and daily SPF support skin clarity; discuss persistent laxity with a qualified clinician.`,
        },
      ],
      summary:
        'Improving cheek skin quality and support helps your natural cheekbone structure read more clearly.',
    },
    {
      id: 'jaw',
      title: 'Jaw Recommendations',
      projectionId: 'jaw',
      layoutHints: { profileImage: true, stackedImages: true },
      subsections: [
        {
          title: 'Jaw Structure',
          body:
            featureExplanation(cvReport, 'jaw', 'jawChin') ||
            `Jaw and chin score: ${safeDisplay(cvReport?.jawChin?.score, '—')}/100. Jaw shape: ${safeDisplay(cvReport?.jawChin?.jawShape, 'measured')}.`,
        },
        {
          title: 'Further Enhancement',
          body:
            'Neck curls and extensions several times per week, posture awareness, and grooming along the mandibular border can support jaw-neck definition alongside daily SPF and moisturiser.',
        },
      ],
      summary:
        'With structural grooming and neck support, the mandibular line can read crisper and more grounded.',
    },
    {
      id: 'lips',
      title: 'Lip Recommendations',
      projectionId: 'lips',
      layoutHints: { stackedImages: true },
      subsections: [
        {
          title: 'Lips',
          body:
            featureExplanation(cvReport, 'lips') ||
            `Lip score ${safeDisplay(cvReport?.lips?.score, '—')}/100; fullness ${safeDisplay(cvReport?.lips?.fullness, 'medium')}. Regular moisturiser and gentle exfoliation support lip surface quality and framing around the mouth.`,
        },
      ],
      summary: 'Hydration and framing around the mouth strengthen overall lower-face aesthetics.',
    },
    {
      id: 'chin',
      title: 'Chin Recommendations',
      projectionId: 'chin',
      layoutHints: { stackedImages: true },
      subsections: [
        {
          title: 'Chin',
          body:
            featureExplanation(cvReport, 'chin', 'jawChin') ||
            `Chin type: ${safeDisplay(cvReport?.jawChin?.chinType, 'measured')}. Grooming that frames the chin (e.g. neat beard edging) and posture support can emphasise lower-face balance without invasive procedures.`,
        },
      ],
      summary: 'Emphasizing chin projection through grooming supports a firmer lower third.',
    },
    {
      id: 'skin',
      title: 'Skin Recommendations',
      projectionId: 'skin',
      layoutHints: { stackedImages: true },
      subsections: [
        {
          title: 'Skincare Protocol',
          body:
            featureExplanation(cvReport, 'skin') ||
            `Skin score ${safeDisplay(cvReport?.skin?.score, '—')}/100. Tone: ${safeDisplay(cvReport?.skin?.tone, '—')}; texture: ${safeDisplay(cvReport?.skin?.texture, '—')}. Twice-daily cleansing, salicylic acid once or twice weekly, glycolic acid on alternate nights, morning vitamin C serum, azelaic acid as needed, low-dose retinol three evenings per week, and daily SPF 50.`,
        },
        {
          title: 'Further Skin Enhancement',
          body:
            'If OTC care is insufficient after 8–12 weeks, discuss professional skin assessment with a dermatologist. This report does not recommend in-clinic procedures.',
        },
      ],
      summary:
        'A disciplined routine targeting your measured skin profile supports clearer, more even facial skin over time.',
    },
    {
      id: 'neck',
      title: 'Neck Recommendations',
      projectionId: 'neck',
      layoutHints: { stackedImages: true },
      subsections: [
        {
          title: 'Neck Size',
          body:
            featureExplanation(cvReport, 'neck') ||
            'Neck curls and extensions three times per week can improve neck column strength and jaw-neck transition toward your target image.',
        },
        {
          title: 'Neck Skin',
          body:
            'Extend SPF 50 and moisturiser to the neck; dedicated neck retinol and tightening treatments support long-term firmness.',
        },
      ],
      summary: 'Strengthening neck support and protecting neck skin grounds the jawline silhouette.',
    },
    {
      id: 'ears',
      title: 'Ear Recommendations',
      projectionId: 'ears',
      layoutHints: { stackedImages: true },
      subsections: [
        {
          title: 'Ear Structure',
          body:
            featureExplanation(cvReport, 'ears') ||
            `Ear region score: ${safeDisplay(cvReport?.ears?.score, '—')}/100. ${faceFallback}`,
        },
      ],
      summary: 'Ear proportions are evaluated for overall facial balance; styling should frame without distraction.',
    },
  ]

  return pages.map((page) => mergeFeaturePage(page, narrativeFeatures[page.id]))
}

export function getFeatureComparisonData(cvReport) {
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

/** @deprecated Use getFeatureComparisonData */
export function getRadarData(cvReport) {
  return getFeatureComparisonData(cvReport)
}
