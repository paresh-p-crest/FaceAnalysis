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
  'These recommendations focus on key markers of facial health and harmony. The goal is not to change what makes the subject unique, but to understand what works best with the subject\'s existing features.',
  'MyFace does not rate attractiveness. The assessment highlights what works best for the subject\'s features using objective cephalometric measurements rather than a single universal standard.',
  'The protocol includes a mix of foundational and more advanced recommendations. Fundamentals such as SPF, sleep, and hydration support the effectiveness of more targeted guidance.',
  'All recommendations are for informational and aesthetic purposes only. Any in-clinic treatment or prescription product should be discussed with a qualified medical professional.',
]

export const DISCLAIMER_PARAGRAPHS = [
  'This report is provided for general informational and educational purposes only. It discusses topics related to facial aesthetics and wellness. It is not intended to constitute medical, clinical, or professional advice, diagnosis, or treatment of any kind.',
  'The information in this MyFace report is not a substitute for consultation with a qualified medical or healthcare professional. Readers should always seek appropriately licensed professional advice regarding any medical condition or treatment decision.',
  'MyFace makes no warranties regarding the accuracy or completeness of this report and disclaims liability arising from reliance on its contents. Any actions taken based on this report are at the reader\'s own risk.',
  'The purpose of this report is to help the reader understand facial features and how non-surgical recommendations could potentially impact appearance. Any reference to treatments is for informational context only.',
]

export const PRIVACY_PARAGRAPHS = [
  'The subject\'s facial images and questionnaire responses are processed solely to generate this personalised assessment report.',
  'MyFace does not sell biometric data. Access is restricted to authorised reviewers for quality assurance before the report is approved.',
  'The subject may request deletion of assessment data by contacting support.',
  'Read the full privacy policy at myface.club.',
]

export const INTRODUCTION_PARAGRAPHS = [
  'In this report, MyFace has approached the commissioned facial analysis from a cephalometric point of view, taking soft tissue measurements and comparing them with established scientific reference ranges for facial harmony and proportion.',
  'This approach makes the report\'s findings less subjective where recommendations may vary from person to person.',
]

export const LIMITATIONS_PARAGRAPH =
  'Limitations apply: neutral head position, lighting, camera quality, and the absence of radiographic imaging may influence measurements. This report is not a medical diagnosis. Recommendations throughout should be taken as empirical guidelines grounded in the subject\'s facial measurements.'

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

function isGenericGuardrailBody(body) {
  if (typeof body !== 'string') return false
  return (
    body.includes('evidence-aligned non-surgical care')
    || body.includes('Assessment of the')
    || body.includes('grounded in measured values')
  )
}

function isGenericSummary(summary) {
  if (typeof summary !== 'string' || !summary.trim()) return true
  const t = summary.toLowerCase()
  return (
    t.includes('non-surgical guidance for')
    || t.includes('based on stored measurements')
    || (t.includes('assessment reflects the measured values') && t.length < 160)
  )
}

function isGenericClosingParagraph(text) {
  if (typeof text !== 'string' || !text.trim()) return true
  const t = text.toLowerCase()
  if (isGenericSummary(text)) return true
  // Concatenated template dump
  if ((t.match(/non-surgical guidance for/g) || []).length >= 2) return true
  return false
}

/**
 * Convert second-person coaching copy to Qoves-style third person
 * ("the subject" as grammatical subject). Applied to stored narratives
 * so older assessments render correctly without force-regenerate.
 */
export function rewriteToSubjectVoice(text) {
  if (typeof text !== 'string' || !text.trim()) return text
  let out = text
  const pairs = [
    [/\bA practical 30-day plan for you\b/gi, 'A practical 30-day plan for the subject'],
    [/\bfrom your facial measurements\b/gi, "from the subject's facial measurements"],
    [/\bBased on your\b/g, "Based on the subject's"],
    [/\bbased on your\b/g, "based on the subject's"],
    [/\bPrioritize your\b/g, "Prioritize the subject's"],
    [/\bprioritize your\b/g, "prioritize the subject's"],
    [/\bYour feature-specific priorities\b/g, 'Feature-specific priorities for the subject'],
    [/\bYour measured strengths\b/g, 'Measured strengths for the subject'],
    [/\bYour primary opportunities\b/g, 'Primary opportunities for the subject'],
    [/\bYour assessment shows\b/g, "The subject's assessment shows"],
    [/\byourself\b/gi, 'themselves'],
    [/\bfor you\b/gi, 'for the subject'],
    [/\byou can\b/gi, 'the subject can'],
    [/\byou may\b/gi, 'the subject may'],
    [/\byou're\b/gi, 'the subject is'],
    [/\bYou've\b/g, 'The subject has'],
    [/\byou've\b/g, 'the subject has'],
    [/\bYour\b/g, "The subject's"],
    [/\byour\b/g, "the subject's"],
    [/\bYou\b/g, 'The subject'],
    [/\byou\b/g, 'the subject'],
  ]
  for (const [re, rep] of pairs) out = out.replace(re, rep)
  return out.replace(/the subject's's/gi, "the subject's")
}

function applySubjectVoiceToFeaturePage(page) {
  if (!page) return page
  return {
    ...page,
    summary: rewriteToSubjectVoice(page.summary),
    description: rewriteToSubjectVoice(page.description),
    subsections: (page.subsections || []).map((sub) => ({
      ...sub,
      body: rewriteToSubjectVoice(sub.body),
    })),
  }
}

function mergeSubsections(defaults, narrativeSubs) {
  if (!Array.isArray(narrativeSubs) || !narrativeSubs.length) return defaults
  const allGeneric = narrativeSubs.every((sub) => isGenericGuardrailBody(sub?.body))
  if (allGeneric) return defaults
  return defaults.map((def) => {
    const match = narrativeSubs.find((sub) => sub?.title === def.title)
    if (match?.body && !isGenericGuardrailBody(match.body)) {
      return { ...match, body: rewriteToSubjectVoice(match.body) }
    }
    return def
  })
}

function mergeFeaturePage(defaults, narrativeFeature) {
  if (!narrativeFeature) return applySubjectVoiceToFeaturePage(defaults)
  const summary = isGenericSummary(narrativeFeature.summary)
    ? defaults.summary
    : (narrativeFeature.summary || defaults.summary)
  return applySubjectVoiceToFeaturePage({
    ...defaults,
    subsections: mergeSubsections(defaults.subsections, narrativeFeature.subsections),
    summary,
    layoutHints: {
      ...defaults.layoutHints,
      ...(narrativeFeature.layoutHints || {}),
      ...(narrativeFeature.norwoodStage != null ? { norwoodStage: narrativeFeature.norwoodStage } : {}),
    },
  })
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
    { label: 'Understanding the Results', page: 4 },
    { label: `${clientName}'s Protocol`, page: 5 },
    ...QOVES_PROTOCOL_FEATURES.map((f) => ({ label: f.title, page: f.page })),
    { label: 'Closing Recommendations', page: 16 },
  ]
}

export function buildClosingRecommendations(aiNarrative, cvReport, clientName, protocolNarrative) {
  const stored = (protocolNarrative?.closing || [])
    .filter((p) => typeof p === 'string' && p.trim() && !isGenericClosingParagraph(p))
    .map(rewriteToSubjectVoice)
  if (stored.length >= 2) {
    return stored
  }

  const content = aiNarrative?.content || aiNarrative || {}
  const paragraphs = []

  if (content.summary && !isGenericClosingParagraph(content.summary)) {
    paragraphs.push(rewriteToSubjectVoice(content.summary))
  }

  const strengths = Array.isArray(content.strengths) ? content.strengths : []
  const focusAreas = Array.isArray(content.focusAreas) ? content.focusAreas : []
  const recommendations = Array.isArray(content.recommendations) ? content.recommendations : []

  if (strengths.length) {
    paragraphs.push(
      `The subject's assessment shows existing strengths including ${strengths.slice(0, 3).join('; ')}. Preserve these with consistent grooming, SPF, sleep, and hydration.`
    )
  }
  if (focusAreas.length) {
    paragraphs.push(
      `The subject's primary opportunities include ${focusAreas.slice(0, 3).join('; ')}. Address these with conservative topical care and lifestyle consistency for 30 days before reassessing.`
    )
  }
  recommendations.forEach((item) => {
    if (typeof item === 'string' && item.trim() && !isGenericClosingParagraph(item)) {
      paragraphs.push(rewriteToSubjectVoice(item.trim()))
    }
  })

  if (paragraphs.length < 2) {
    const overall = cvReport?.overall?.score
    const hair = cvReport?.hair || {}
    const hairBit = hair.norwoodStage != null
      ? ` Hair findings include estimated Norwood stage ${hair.norwoodStage} with ${String(hair.densityEstimate || 'moderate').toLowerCase()} density.`
      : ''
    paragraphs.push(
      overall != null
        ? `The subject's assessment shows an overall harmony score of ${overall}/100 from facial measurements.${hairBit} Focus on the lowest-scoring feature areas while maintaining grooming, skincare, and lifestyle fundamentals for the next 30 days.`
        : 'Follow the feature-specific recommendations in this protocol for 30 days, then repeat analysis under consistent lighting and a neutral expression for comparison.'
    )
    paragraphs.push(
      'A practical plan combines daily broad-spectrum SPF 50 outdoors, gentle cleansing, adequate sleep and hydration, and the feature-specific grooming notes on each protocol page. Studies on facial perception suggest that symmetry, clear skin, and proportional feature framing contribute to perceived attractiveness; treat this report as educational guidance, not a medical diagnosis.'
    )
  }

  if (content.disclaimer && !isGenericClosingParagraph(content.disclaimer)) {
    paragraphs.push(rewriteToSubjectVoice(content.disclaimer))
  } else {
    paragraphs.push(
      'This protocol is educational guidance from the subject\'s facial measurements, not medical diagnosis or treatment.'
    )
  }

  return paragraphs.filter((p, i, arr) => arr.findIndex((x) => x === p) === i).map(rewriteToSubjectVoice)
}

export function buildClosingColumns(paragraphs) {
  const items = paragraphs.filter(Boolean)
  const mid = Math.ceil(items.length / 2)
  return { left: items.slice(0, mid), right: items.slice(mid) }
}

export function buildFeaturePages(cvReport, eyeAnalysis, protocolNarrative) {
  const faceFallback = 'Measurements for this feature are drawn from the subject\'s stored facial analysis.'
  const narrativeFeatures = protocolNarrative?.features || {}
  const pendingBody =
    'Personalised protocol narrative for this section is being generated from the subject\'s stored measurements. ' +
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
            `Based on the subject's measured hairline and framing, choose styles that balance facial thirds. Gentle cleansing and lightweight styling products support a neat upper-face frame. ${faceFallback}`,
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
          cvReport?.hair?.norwoodStage != null
            ? `Hairline ${safeDisplay(cvReport.hair.hairline, 'measured')}, ${safeDisplay(cvReport.hair.densityEstimate, 'moderate').toLowerCase()} density, estimated Norwood stage ${cvReport.hair.norwoodStage}. Prioritize gentle scalp care and framing styles for 30 days.`
            : 'Optimizing hairstyle and scalp health supports a cleaner upper-face frame aligned with the subject\'s measured proportions.'
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
            'The subject\'s ocular structure assessment focuses on symmetry, tilt, and periorbital support.',
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
        'Refining brows, protecting lashes, and supporting the under-eye region keeps the gaze rested and balanced toward the subject\'s projected potential.',
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
        ...(cvReport?.nose?.nasofrontalAngleDeg != null || cvReport?.nose?.nasolabialAngleDeg != null
          ? [
              {
                title: 'Profile Angles',
                body: [
                  cvReport?.nose?.nasofrontalAngleDeg != null
                    ? `Nasofrontal angle ${cvReport.nose.nasofrontalAngleDeg}° (typical ~115–130°).`
                    : null,
                  cvReport?.nose?.nasolabialAngleDeg != null
                    ? `Nasolabial angle ${cvReport.nose.nasolabialAngleDeg}°${
                        cvReport.nose.nasolabialNormalRange
                          ? ` (typical ${cvReport.nose.nasolabialNormalRange})`
                          : ''
                      }.`
                    : null,
                  cvReport?.nose?.dorsalHumpLabel
                    ? `Dorsal hump ${cvReport.nose.dorsalHumpLabel}.`
                    : null,
                  cvReport?.nose?.facialConvexityDeg != null
                    ? `Facial convexity ${cvReport.nose.facialConvexityDeg}°.`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' '),
              },
            ]
          : []),
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
        'Improving cheek skin quality and support helps the subject\'s natural cheekbone structure read more clearly.',
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
      layoutHints: { profileImage: true, stackedImages: true },
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
        'A disciplined routine targeting the subject\'s measured skin profile supports clearer, more even facial skin over time.',
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
            (cvReport?.neck?.dataSource === 'measured'
              ? `Neck length and posture were measured from the subject's jaw and shoulder line (${safeDisplay(cvReport?.neck?.headPosture, 'neutral')} posture). Neck curls and extensions three times per week can support neck column strength toward the target image.`
              : 'Neck curls and extensions three times per week can improve neck column strength and jaw-neck transition toward the target image.'),
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
