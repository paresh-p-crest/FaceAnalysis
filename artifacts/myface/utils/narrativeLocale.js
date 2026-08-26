/**
 * Pick narrative fields for the active UI locale.
 * German: stored .de / contentDe only — never fall back to English prose.
 */

function mergeDeFeatureEntry(enEntry) {
  if (!enEntry || typeof enEntry !== 'object') return null
  const de = enEntry.de
  if (!de || typeof de !== 'object') return null
  return {
    ...enEntry,
    summary: de.summary ?? '',
    subsections: Array.isArray(de.subsections) ? de.subsections : [],
    origin: de.origin ?? enEntry.origin,
  }
}

function mergeDeFeatures(featureNarratives) {
  if (!featureNarratives || typeof featureNarratives !== 'object') return {}
  const out = {}
  for (const [fid, entry] of Object.entries(featureNarratives)) {
    const merged = mergeDeFeatureEntry(entry)
    if (merged) out[fid] = merged
  }
  return out
}

function mergeDeProtocol(protocolNarrative, featureNarratives) {
  const base = protocolNarrative || { summary: '', closing: [], features: {} }
  const de = base.de
  if (!de || typeof de !== 'object') return null
  const dePhases = de.treatmentPhases
  const hasDePhase01 =
    dePhases
    && typeof dePhases === 'object'
    && dePhases.phase01
    && Array.isArray(dePhases.phase01.items)
    && dePhases.phase01.items.length > 0
  const merged = {
    ...base,
    summary: de.summary ?? '',
    closing: Array.isArray(de.closing) ? de.closing : [],
    // Never leak EN Merkmals bullets into DE UI — empty → locale CV fallback
    featureHighlights:
      Array.isArray(de.featureHighlights) && de.featureHighlights.length >= 2
        ? de.featureHighlights
        : [],
    treatmentPhases: hasDePhase01 ? dePhases : base.treatmentPhases,
  }
  const deFeatures = mergeDeFeatures(featureNarratives)
  if (Object.keys(deFeatures).length) {
    merged.features = { ...(base.features || {}), ...deFeatures }
  }
  return merged
}

function withDeAiNarrative(aiNarrative) {
  if (!aiNarrative || typeof aiNarrative !== 'object') return aiNarrative
  const contentDe = aiNarrative.contentDe
  if (!contentDe || typeof contentDe !== 'object') return null
  return {
    ...aiNarrative,
    content: contentDe,
    contentOrigin: aiNarrative.contentDeOrigin ?? 'llm',
  }
}

/**
 * @param {{ aiNarrative?, protocolNarrative?, featureNarratives? }} narratives
 * @param {string} locale
 */
export function pickLocalizedNarratives(
  { aiNarrative = null, protocolNarrative = null, featureNarratives = null },
  locale,
  { t } = {},
) {
  if (locale !== 'de') {
    return { aiNarrative, protocolNarrative, featureNarratives }
  }
  const overviewPending = t ? t('protocolModel.overviewPending') : ''
  const localizedAi = withDeAiNarrative(aiNarrative)
  const localizedProto = mergeDeProtocol(protocolNarrative, featureNarratives)
  const localizedFeatures = mergeDeFeatures(featureNarratives)
  return {
    aiNarrative: localizedAi ?? (overviewPending ? { content: { summary: overviewPending } } : null),
    protocolNarrative: localizedProto ?? {
      summary: overviewPending,
      closing: [],
      features: {},
    },
    featureNarratives: localizedFeatures,
  }
}

export function pickLocalizedFromAssessment(assessment, locale) {
  return pickLocalizedNarratives(
    {
      aiNarrative: assessment?.aiNarrative,
      protocolNarrative: assessment?.protocolNarrative,
      featureNarratives: assessment?.featureNarratives,
    },
    locale,
  )
}
