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

export const UNDERSTANDING_RESULTS_KEYS = [
  'protocolModel.understandingResults.p1',
  'protocolModel.understandingResults.p2',
  'protocolModel.understandingResults.p3',
  'protocolModel.understandingResults.p4',
]

/** @deprecated Use UNDERSTANDING_RESULTS_KEYS with useTranslations('Report') */
export const UNDERSTANDING_RESULTS = UNDERSTANDING_RESULTS_KEYS

export const DISCLAIMER_PARAGRAPH_KEYS = [
  'disclaimer.paragraphs.p1',
  'disclaimer.paragraphs.p2',
  'disclaimer.paragraphs.p3',
  'disclaimer.paragraphs.p4',
]

/** @deprecated Use DISCLAIMER_PARAGRAPH_KEYS with useTranslations('Report') */
export const DISCLAIMER_PARAGRAPHS = DISCLAIMER_PARAGRAPH_KEYS

export const PRIVACY_PARAGRAPH_KEYS = [
  'disclaimer.privacy.p1',
  'disclaimer.privacy.p2',
  'disclaimer.privacy.p3',
  'disclaimer.privacy.p4',
]

/** @deprecated Use PRIVACY_PARAGRAPH_KEYS with useTranslations('Report') */
export const PRIVACY_PARAGRAPHS = PRIVACY_PARAGRAPH_KEYS

export const INTRODUCTION_PARAGRAPH_KEYS = [
  'intro.paragraphs.p1',
  'intro.paragraphs.p2',
]

/** @deprecated Use INTRODUCTION_PARAGRAPH_KEYS with useTranslations('Report') */
export const INTRODUCTION_PARAGRAPHS = INTRODUCTION_PARAGRAPH_KEYS

export const LIMITATIONS_PARAGRAPH_KEY = 'protocolModel.limitations'

/** @deprecated Use LIMITATIONS_PARAGRAPH_KEY with useTranslations('Report') */
export const LIMITATIONS_PARAGRAPH = LIMITATIONS_PARAGRAPH_KEY

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

export function getClientName(answers, user = null, assessmentOwner = null) {
  const fromAnswers = [answers?.name, answers?.fullName, answers?.clientName]
    .find((v) => typeof v === 'string' && v.trim())
  if (fromAnswers) return fromAnswers.trim()

  // Prefer the assessment subject (owner), not the viewer — admins open other users' reports
  const owner = assessmentOwner && typeof assessmentOwner === 'object' ? assessmentOwner : null
  if (owner) {
    const fromOwner = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim()
    if (fromOwner) return fromOwner
    if (typeof owner.name === 'string' && owner.name.trim()) return owner.name.trim()
    if (typeof owner.email === 'string' && owner.email.includes('@')) {
      return owner.email.split('@')[0]
    }
  }

  // Session user only when they own the assessment (or owner unknown / same id)
  const ownerId = owner?.id || null
  const sessionIsOwner = !ownerId || !user?.id || String(ownerId) === String(user.id)
  if (sessionIsOwner && user) {
    const fromUser = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    if (fromUser) return fromUser
    if (typeof user.name === 'string' && user.name.trim()) return user.name.trim()
    if (typeof user.email === 'string' && user.email.includes('@')) {
      return user.email.split('@')[0]
    }
  }

  return 'Client'
}

/** Resolve static protocol copy keys via next-intl translate function. */
export function translateProtocolKeys(keys, t) {
  return keys.map((key) => (typeof key === 'string' && key.includes('.') ? t(key) : key))
}

/** Static edition label for cover (no date). */
export function formatProtocolEditionLabel() {
  return 'PROTOCOL'
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
  if (stored.length >= 1) {
    return stored
  }

  // Do not synthesize durable closing on the client — server persists closing with the protocol bundle.
  return [
    'Closing recommendations for this protocol are being prepared from the subject\'s stored measurements. '
      + 'Reopen the protocol after generation completes, or contact support if this message persists.',
  ]
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

const REVIEW_THRESHOLD = 75

function zoneScore(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null
}

function pickScoreLabel(obj) {
  if (!obj) return null
  return obj.scoreLabel || obj.classification || obj.shape || null
}

/** Reject CV explanation sentences — mini-cards show short metrics only. */
function isProseMetric(text) {
  const s = String(text || '').trim()
  if (!s) return true
  if (s.length > 42) return true
  if (/^(the subject|your |the client's|the patient)/i.test(s)) return true
  if (/\.\s+[A-Z]/.test(s)) return true
  return false
}

/** Left-rail cards: lowest-scoring protocol features (interactive nav + PDF page links). */
export const DASHBOARD_PRIORITY_FEATURE_LIMIT = 5

/** @deprecated Prefer buildPriorityFeatureMiniCards — kept for older callers. */
export const DASHBOARD_MINI_CARDS = [
  { id: 'skin', pdfPage: 13 },
  { id: 'hair', pdfPage: 6 },
  { id: 'eyes', pdfPage: 7 },
]

/** MediaPipe Face Mesh landmark count shown on the protocol dashboard KPI. */
export const DASHBOARD_EVALUATED_POINTS = '468+'

/** Coerce CV values to short preview text (avoid "[object Object]"). */
function asPreviewText(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const s = String(value).trim()
    return s || null
  }
  if (Array.isArray(value)) {
    const parts = value.map(asPreviewText).filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }
  if (typeof value === 'object') {
    const preferred = value.label || value.name || value.title || value.scoreLabel
      || value.classification || value.shape || value.value || value.text
    if (preferred != null) return asPreviewText(preferred)
    if (value.score != null) return `${value.score}/100`
    return null
  }
  return null
}

function featureNumericScore(cvReport, eyeAnalysis, sectionId) {
  switch (sectionId) {
    case 'hair':
      return zoneScore(cvReport?.hair?.score)
    case 'eyes':
      return zoneScore(cvReport?.eyes?.score ?? eyeAnalysis?.overallScore)
    case 'nose':
      return zoneScore(cvReport?.nose?.score)
    case 'cheeks':
      return zoneScore(cvReport?.cheeks?.score)
    case 'jaw':
      return zoneScore(cvReport?.jaw?.score ?? cvReport?.jawChin?.score)
    case 'lips':
      return zoneScore(cvReport?.lips?.score)
    case 'chin':
      return zoneScore(cvReport?.chin?.score ?? cvReport?.jawChin?.score)
    case 'skin':
      return zoneScore(cvReport?.skin?.score)
    case 'neck':
      return zoneScore(cvReport?.neck?.score)
    case 'ears':
      return zoneScore(cvReport?.ears?.score)
    default:
      return null
  }
}

/** Dynamic findings for left mini-cards (metric title + detail). Metrics only — no prose. */
export function buildLeftMiniCardFindings(cvReport, eyeAnalysis, sectionId) {
  const findings = []
  const add = (title, detail) => {
    if (findings.length >= 3) return
    const t = asPreviewText(title)
    if (!t || isProseMetric(t)) return
    const rawDetail = asPreviewText(detail)
    const d = rawDetail && !isProseMetric(rawDetail) ? rawDetail : null
    if (findings.some((f) => f.title === t)) return
    findings.push({ title: t, detail: d })
  }

  switch (sectionId) {
    case 'skin': {
      const s = cvReport?.skin
      if (!s) break
      add(s.texture, [asPreviewText(s.hydration), asPreviewText(s.tone)].filter(Boolean).join(' · ') || null)
      add(s.scoreLabel || s.clarity, s.pigmentation || null)
      if (s.redness && !/^normal$/i.test(String(asPreviewText(s.redness) || ''))) {
        add(s.redness, s.skinTone || s.tone || null)
      } else {
        add(s.pigmentation || s.skinTone, s.tone || (s.uniformity != null ? `Uniformity ${s.uniformity}` : null))
      }
      break
    }
    case 'hair': {
      const h = cvReport?.hair
      if (!h) break
      add(h.textureType || h.scoreLabel, h.hairColor || null)
      add(h.hairline, h.density || h.recession || null)
      add(h.density, h.score != null ? `${h.score}/100` : null)
      break
    }
    case 'eyes': {
      const e = cvReport?.eyes
      const ea = eyeAnalysis
      add(pickScoreLabel(e) || pickScoreLabel(ea) || e?.shape || ea?.eyeShape, e?.canthalTilt || ea?.canthalTilt || null)
      add(e?.symmetry || ea?.symmetryLabel, e?.spacing || ea?.spacing || null)
      add(ea?.underEyeHealth || e?.underEye, ea?.overallScore != null ? `${ea.overallScore}/100` : null)
      break
    }
    case 'nose': {
      const n = cvReport?.nose
      if (!n) break
      add(n.widthClassification || n.scoreLabel || n.shape, n.widthLengthRatio != null ? `Ratio ${n.widthLengthRatio}` : null)
      add(n.tip || n.shape, n.idealRatio != null ? `Ideal ${n.idealRatio}` : null)
      break
    }
    case 'cheeks': {
      const c = cvReport?.cheeks
      if (!c) break
      add(c.scoreLabel || c.fullness, c.hollowing || null)
      add(c.prominence, c.score != null ? `${c.score}/100` : null)
      break
    }
    case 'jaw': {
      const j = cvReport?.jaw || cvReport?.jawChin
      if (!j) break
      add(
        j.jawWidthClass || j.scoreLabel || j.jawShape || j.shape,
        j.jawWidth != null ? `${j.jawWidth}% width` : null,
      )
      add(
        j.mandibularDefinition || j.definition || j.jawlineDefinition,
        j.jawAngle != null ? `${j.jawAngle}°` : (j.angle != null ? `${j.angle}°` : null),
      )
      add(j.jawLengthClass, j.jawLength != null ? `${j.jawLength}% length` : null)
      break
    }
    case 'lips': {
      const l = cvReport?.lips
      if (!l) break
      add(l.scoreLabel || l.fullness, l.ratio || l.cupidBow || null)
      add(l.shape, l.score != null ? `${l.score}/100` : null)
      break
    }
    case 'chin': {
      const c = cvReport?.chin || cvReport?.jawChin
      if (!c) break
      add(c.scoreLabel || c.projection || c.shape, c.width || null)
      add(c.profile, c.score != null ? `${c.score}/100` : null)
      break
    }
    case 'neck': {
      const n = cvReport?.neck
      if (!n) break
      add(n.scoreLabel || n.definition, n.laxity || null)
      add(n.contour, n.score != null ? `${n.score}/100` : null)
      break
    }
    case 'ears': {
      const e = cvReport?.ears
      if (!e) break
      add(e.scoreLabel || e.prominence, e.symmetry || null)
      add(e.projection, e.score != null ? `${e.score}/100` : null)
      break
    }
    default:
      break
  }

  return findings.slice(0, 3)
}

/** @deprecated Prefer buildLeftMiniCardFindings */
export function buildLeftMiniCardLines(cvReport, eyeAnalysis, sectionId) {
  return buildLeftMiniCardFindings(cvReport, eyeAnalysis, sectionId).map((f) => f.title)
}

function miniCardScoreMeta(cvReport, eyeAnalysis, sectionId) {
  const scoreNum = featureNumericScore(cvReport, eyeAnalysis, sectionId)
  const score = scoreNum != null ? `${scoreNum}/100` : null
  switch (sectionId) {
    case 'skin':
      return { score, scoreLabel: asPreviewText(cvReport?.skin?.scoreLabel) }
    case 'hair':
      return { score, scoreLabel: asPreviewText(cvReport?.hair?.scoreLabel) || asPreviewText(cvReport?.hair?.textureType) }
    case 'eyes':
      return {
        score,
        scoreLabel: asPreviewText(pickScoreLabel(cvReport?.eyes)) || asPreviewText(pickScoreLabel(eyeAnalysis)),
      }
    case 'nose':
      return { score, scoreLabel: asPreviewText(cvReport?.nose?.scoreLabel) || asPreviewText(cvReport?.nose?.shape) }
    case 'cheeks':
      return { score, scoreLabel: asPreviewText(cvReport?.cheeks?.scoreLabel) || asPreviewText(cvReport?.cheeks?.fullness) }
    case 'jaw':
      return {
        score,
        scoreLabel: asPreviewText(cvReport?.jaw?.scoreLabel)
          || asPreviewText(cvReport?.jaw?.jawShape)
          || asPreviewText(cvReport?.jawChin?.jawShape),
      }
    case 'lips':
      return { score, scoreLabel: asPreviewText(cvReport?.lips?.scoreLabel) || asPreviewText(cvReport?.lips?.fullness) }
    case 'chin':
      return {
        score,
        scoreLabel: asPreviewText(cvReport?.chin?.scoreLabel)
          || asPreviewText(cvReport?.chin?.projection)
          || asPreviewText(cvReport?.jawChin?.scoreLabel),
      }
    case 'neck':
      return { score, scoreLabel: asPreviewText(cvReport?.neck?.scoreLabel) || asPreviewText(cvReport?.neck?.definition) }
    case 'ears':
      return { score, scoreLabel: asPreviewText(cvReport?.ears?.scoreLabel) || asPreviewText(cvReport?.ears?.prominence) }
    default:
      return { score, scoreLabel: null }
  }
}

/** Top N lowest-scoring features for dashboard priority cards. */
export function buildPriorityFeatureMiniCards(cvReport, eyeAnalysis, limit = DASHBOARD_PRIORITY_FEATURE_LIMIT) {
  const ranked = QOVES_PROTOCOL_FEATURES
    .map((f) => ({
      id: f.id,
      pdfPage: f.page,
      title: f.title,
      scoreNum: featureNumericScore(cvReport, eyeAnalysis, f.id),
    }))
    .filter((f) => f.scoreNum != null)
    .sort((a, b) => a.scoreNum - b.scoreNum)
    .slice(0, limit)

  return ranked.map((f) => {
    const findings = buildLeftMiniCardFindings(cvReport, eyeAnalysis, f.id)
    return {
      ...f,
      ...miniCardScoreMeta(cvReport, eyeAnalysis, f.id),
      findings,
    }
  })
}

/** Best available crop for a dashboard mini-card preview (stored CV crops, else full photo). */
export function resolveMiniCardPreviewSrc(sectionId, { photo, cvReport, eyeAnalysis } = {}) {
  switch (sectionId) {
    case 'skin':
      return cvReport?.cheeks?.imageSrc || cvReport?.skin?.imageSrc || photo || null
    case 'hair': {
      const hair = cvReport?.hair
      if (hair?.photoSource === 'topHead') return hair?.imageSrcFront || photo || null
      return hair?.imageSrcFront || hair?.imageSrc || photo || null
    }
    case 'eyes':
      return eyeAnalysis?.eyesCrop
        || cvReport?.eyes?.ocular?.imageSrc
        || cvReport?.eyebrows?.crop
        || photo
        || null
    case 'nose':
      return cvReport?.nose?.imageSrc || photo || null
    case 'cheeks':
      return cvReport?.cheeks?.imageSrc || photo || null
    case 'jaw':
      return cvReport?.jaw?.imageSrcFront || cvReport?.jaw?.imageSrc || cvReport?.jawChin?.imageSrc || photo || null
    case 'lips':
      return cvReport?.lips?.imageSrc || photo || null
    case 'chin':
      return cvReport?.chin?.imageSrcFront || cvReport?.chin?.imageSrc || cvReport?.jawChin?.imageSrc || photo || null
    case 'neck':
      return cvReport?.neck?.imageSrc || photo || null
    case 'ears':
      return cvReport?.ears?.imageSrc || photo || null
    default:
      return photo || null
  }
}

/** CV-driven finding/reference for dashboard feature rows (i18n fallback in UI/PDF). */
export function buildFeatureRowDisplay(cvReport, eyeAnalysis, zoneKey) {
  const sym = cvReport?.symmetry
  const foreheadRegion = sym?.regions?.find((r) => /forehead|brow/i.test(String(r.label || r.id || '')))

  switch (zoneKey) {
    case 'forehead':
      return {
        finding: foreheadRegion?.score != null
          ? `${Math.round(foreheadRegion.score)}/100`
          : pickScoreLabel(sym),
        ref: sym?.scaleLeft || null,
      }
    case 'eyes':
      return {
        finding: pickScoreLabel(cvReport?.eyes) || pickScoreLabel(eyeAnalysis),
        ref: cvReport?.eyes?.reference || null,
      }
    case 'nose':
      return {
        finding: cvReport?.nose?.widthLengthRatio
          ? `Ratio ${cvReport.nose.widthLengthRatio}`
          : pickScoreLabel(cvReport?.nose),
        ref: cvReport?.nose?.idealRatio || cvReport?.nose?.reference || null,
      }
    case 'lips':
      return {
        finding: pickScoreLabel(cvReport?.lips),
        ref: cvReport?.lips?.reference || null,
      }
    case 'jawline':
      return {
        finding: pickScoreLabel(cvReport?.jaw) || pickScoreLabel(cvReport?.jawChin),
        ref: cvReport?.jaw?.reference || null,
      }
    default:
      return { finding: null, ref: null }
  }
}

/** Canonical client-facing overall harmony score (matches dashboard KPI / score ring). */
export function resolveOverallHarmonyScore(analysisOrParts) {
  const cvReport = analysisOrParts?.cvReport ?? analysisOrParts?.analysis?.cvReport
  const metrics = analysisOrParts?.metrics ?? analysisOrParts?.analysis?.metrics
  const raw =
    cvReport?.overall?.score ??
    metrics?.harmonyScore ??
    null
  if (raw == null || raw === '') return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : null
}

/** Days between assessment createdAt and updatedAt (min 1 when positive span). */
export function computeAnalysisDurationDays(createdAt, updatedAt) {
  if (!createdAt || !updatedAt) return null
  const startMs = Date.parse(createdAt)
  const endMs = Date.parse(updatedAt)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null
  return Math.max(1, Math.round((endMs - startMs) / 86_400_000))
}

/** @deprecated Use computeAnalysisDurationDays */
export function computeAnalysisDurationSec(createdAt, updatedAt) {
  const days = computeAnalysisDurationDays(createdAt, updatedAt)
  return days == null ? null : days * 86_400
}

/** Midpoint of questionnaire ageRange (`25-34` → 30, `55+` → 55) for scale/diff math. */
export function parseAgeRangeMidpoint(ageRange) {
  const bounds = parseAgeRangeBounds(ageRange)
  if (!bounds) return null
  return Math.round((bounds.lo + bounds.hi) / 2)
}

/** Inclusive age band from questionnaire (`25-34` → {lo:25,hi:34}, `55+` → {lo:55,hi:70}). */
export function parseAgeRangeBounds(ageRange) {
  if (ageRange == null || ageRange === '') return null
  const s = String(ageRange).trim()
  if (s.endsWith('+')) {
    const n = parseInt(s, 10)
    if (!Number.isFinite(n)) return null
    return { lo: n, hi: n + 15 }
  }
  const m = s.match(/^(\d+)\s*[-–]\s*(\d+)$/)
  if (!m) return null
  const lo = parseInt(m[1], 10)
  const hi = parseInt(m[2], 10)
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return null
  return { lo, hi }
}

/** Display form of ageRange (`25-34` → `25–34`). */
export function formatAgeRangeDisplay(ageRange) {
  if (ageRange == null || ageRange === '') return null
  return String(ageRange).trim().replace(/-/g, '–')
}

export function buildProtocolDashboardData({ cvReport, metrics, answers, eyeAnalysis, createdAt, updatedAt }) {
  const overall = cvReport?.overall || {}
  const faceAge = metrics?.visualAge ?? overall?.visualAge ?? null
  const ageRange = answers?.ageRange || null
  // Prefer questionnaire age band; numeric mid only for scale/diff
  const ageNum = (() => {
    if (answers?.age == null || answers?.age === '') return null
    const n = typeof answers.age === 'number' ? answers.age : parseInt(String(answers.age), 10)
    return Number.isFinite(n) ? n : null
  })()
  const bioAgeBounds = parseAgeRangeBounds(ageRange)
  const bioAge = parseAgeRangeMidpoint(ageRange)
    ?? ageNum
    ?? overall?.chronologicalAge
    ?? null
  const bioAgeLabel = formatAgeRangeDisplay(ageRange)
    ?? (bioAge != null ? String(bioAge) : null)
  const overallScore = resolveOverallHarmonyScore({ cvReport, metrics })
  // Protocol dashboard cites MediaPipe Face Mesh density (468 landmarks).
  const evaluatedPoints = cvReport ? DASHBOARD_EVALUATED_POINTS : null

  const radarScores = {
    symmetry: zoneScore(metrics?.symmetryScore ?? cvReport?.symmetry?.score),
    smoothness: zoneScore(cvReport?.skin?.uniformity ?? cvReport?.skin?.score),
    jawline: zoneScore(metrics?.jawlineScore ?? cvReport?.jaw?.score ?? cvReport?.structure?.score),
    skin: zoneScore(metrics?.skinScore ?? cvReport?.skin?.score),
    volume: zoneScore(metrics?.proportionsScore ?? cvReport?.proportions?.score),
    harmony: zoneScore(overall?.score ?? metrics?.harmonyScore),
  }

  const foreheadRegion = cvReport?.symmetry?.regions?.find((r) => /forehead|brow/i.test(String(r.label || r.id || '')))
  const featureRows = [
    { zoneKey: 'forehead', score: zoneScore(foreheadRegion?.score ?? cvReport?.symmetry?.score) },
    { zoneKey: 'eyes', score: zoneScore(cvReport?.eyes?.score ?? eyeAnalysis?.overallScore) },
    { zoneKey: 'nose', score: zoneScore(cvReport?.nose?.score) },
    { zoneKey: 'lips', score: zoneScore(cvReport?.lips?.score) },
    { zoneKey: 'jawline', score: zoneScore(cvReport?.jaw?.score ?? cvReport?.jawChin?.score) },
  ].map((row) => {
    const display = buildFeatureRowDisplay(cvReport, eyeAnalysis, row.zoneKey)
    return {
      ...row,
      ...display,
      isOk: row.score != null ? row.score >= REVIEW_THRESHOLD : null,
    }
  })

  return {
    overallScore,
    evaluatedPoints,
    analysisTimeDays: computeAnalysisDurationDays(createdAt, updatedAt),
    /** @deprecated Prefer analysisTimeDays */
    analysisTimeSec: computeAnalysisDurationDays(createdAt, updatedAt),
    faceAge,
    bioAge,
    bioAgeLabel,
    bioAgeBounds,
    radarScores,
    featureRows,
    miniCards: buildPriorityFeatureMiniCards(cvReport, eyeAnalysis),
  }
}

export function formatProtocolId(assessmentId) {
  if (!assessmentId) return '—'
  const raw = String(assessmentId).replace(/\D/g, '')
  if (raw.length >= 5) return raw.slice(-5)
  return raw.padStart(5, '0') || '—'
}

/** Dashboard / report row label — prefers backend scanId, else protocol id suffix. */
export function formatAssessmentRef(assessment) {
  const scan = assessment?.scanId && String(assessment.scanId).trim()
  if (scan) {
    const compact = scan.replace(/[^a-zA-Z0-9]/g, '')
    return compact.length > 8 ? compact.slice(-8).toUpperCase() : compact.toUpperCase()
  }
  return formatProtocolId(assessment?.id)
}

export const TREATMENT_PHASE_KEYS = ['phase01', 'phase02', 'phase03']

/** Approximate face-region anchors for overview feature-preview portrait (0–1). */
export const FEATURE_PREVIEW_CALLOUTS = [
  { id: 'forehead', x: 0.5, y: 0.22 },
  { id: 'eyes', x: 0.62, y: 0.36 },
  { id: 'nose', x: 0.5, y: 0.48 },
  { id: 'mouth', x: 0.5, y: 0.62 },
]

/** MediaPipe indices for feature-preview callouts (viewer-right / subject-left preferred). */
const FEATURE_PREVIEW_LANDMARK_IDS = {
  forehead: 10,
  eyes: 263, // left eye outer (appears on viewer's right)
  nose: 1,
  mouth: 13, // upper lip mid
}

/**
 * Resolve callout anchors in normalized image space (0–1).
 * Prefers MediaPipe landmarks when present; else static FEATURE_PREVIEW_CALLOUTS.
 */
export function resolveFeaturePreviewCallouts(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 10) {
    return FEATURE_PREVIEW_CALLOUTS.map((c) => ({ ...c }))
  }
  const byIndex = (idx) => {
    const pt = landmarks[idx]
    if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) return pt
    // Sparse / id-keyed lists
    const found = landmarks.find((p) => p && (p.id === idx || p.index === idx))
    if (found && Number.isFinite(found.x) && Number.isFinite(found.y)) return found
    return null
  }
  return FEATURE_PREVIEW_CALLOUTS.map((c) => {
    const pt = byIndex(FEATURE_PREVIEW_LANDMARK_IDS[c.id])
    if (!pt) return { ...c }
    return {
      id: c.id,
      x: Math.min(0.92, Math.max(0.08, pt.x)),
      y: Math.min(0.92, Math.max(0.08, pt.y)),
    }
  })
}

/**
 * Map normalized image coords → container fraction under object-fit:cover + object-position:top center.
 */
export function mapCoverTopCenter(nx, ny, imgW, imgH, boxW, boxH) {
  if (!imgW || !imgH || !boxW || !boxH) return { x: nx, y: ny }
  const scale = Math.max(boxW / imgW, boxH / imgH)
  const dispW = imgW * scale
  const dispH = imgH * scale
  const ox = (boxW - dispW) / 2
  const oy = 0
  return {
    x: (nx * imgW * scale + ox) / boxW,
    y: (ny * imgH * scale + oy) / boxH,
  }
}

function normalizeTreatmentItem(item) {
  if (!item) return { name: '—', detail: '' }
  if (typeof item === 'string') return { name: item, detail: '' }
  return {
    name: item.name || '—',
    detail: item.detail || '',
  }
}

function phaseHasContent(phase) {
  return Boolean(phase?.title && Array.isArray(phase?.items) && phase.items.length > 0)
}

function attachPhaseLabels(phases, t) {
  const out = {}
  TREATMENT_PHASE_KEYS.forEach((key) => {
    const phase = phases[key]
    if (!phase) return
    out[key] = {
      ...phase,
      label: t(`executiveSummary.phases.${key}.label`),
      items: (phase.items || []).map(normalizeTreatmentItem),
    }
  })
  return out
}

function buildTreatmentPhaseFallback(dash, t) {
  const miniCards = dash?.miniCards || []
  const zoneLabels = miniCards.slice(0, 3).map((card) => t(`nav.${card.id}`))

  const phase01Items = miniCards.slice(0, 3).map((card) => {
    const finding = (card.findings || []).find((f) => f?.title)
    return {
      name: finding?.title || t(`nav.${card.id}`),
      detail: finding?.detail || card.scoreLabel || t('executiveSummary.phases.fallback.itemDetailDefault'),
    }
  })
  if (phase01Items.length === 0) {
    phase01Items.push({
      name: t('executiveSummary.phases.fallback.phase01.items.0.name'),
      detail: t('executiveSummary.phases.fallback.phase01.items.0.detail'),
    })
  }

  const phases = {
    phase01: {
      title: t('executiveSummary.phases.fallback.phase01.title'),
      duration: t('executiveSummary.phases.fallback.phase01.duration'),
      items: phase01Items,
    },
  }

  const summary = t('executiveSummary.phases.fallback.summary', {
    zones: zoneLabels.length ? zoneLabels.join(', ') : t('executiveSummary.phases.fallback.zonesDefault'),
    score: dash?.overallScore != null ? String(dash.overallScore) : '—',
  })

  return { phases: attachPhaseLabels(phases, t), summary, source: 'fallback' }
}

/**
 * LLM treatment phases from protocolNarrative, or CV-driven clinical fallback
 * when phase01 is missing (favorable baseline + priority-region refinements).
 */
export function resolveTreatmentPhases({ protocolNarrative, dash, t }) {
  const stored = protocolNarrative?.treatmentPhases
  if (stored && phaseHasContent(stored.phase01)) {
    return {
      phases: attachPhaseLabels(stored, t),
      summary: stored.summary || null,
      source: 'llm',
    }
  }
  return buildTreatmentPhaseFallback(dash, t)
}
