/** Protocol section ids/labels for admin review editing (mirrors backend schemas). */

export const PROTOCOL_SECTION_OPTIONS = [
  { id: 'overview', label: 'Protocol overview' },
  { id: 'closing', label: 'Closing recommendations' },
  { id: 'hair', label: 'Hair' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'nose', label: 'Nose' },
  { id: 'cheeks', label: 'Cheeks' },
  { id: 'jaw', label: 'Jaw' },
  { id: 'lips', label: 'Lips' },
  { id: 'chin', label: 'Chin' },
  { id: 'skin', label: 'Skin' },
  { id: 'neck', label: 'Neck' },
  { id: 'ears', label: 'Ears' },
  { id: 'smile', label: 'Smile' },
]

/** Fixed subsection titles per feature (backend FEATURE_SUBSECTION_TITLES). */
export const FEATURE_SUBSECTION_TITLES = {
  hair: ['Hair Style', 'Hair Loss', 'Hair Health'],
  eyes: ['Eyebrows', 'Eyelashes', 'Eyes', 'Under eye'],
  nose: ['Nose'],
  cheeks: ['Cheek Structure'],
  jaw: ['Jaw Structure', 'Further Enhancement'],
  lips: ['Lips'],
  chin: ['Chin'],
  skin: ['Skincare Protocol', 'Further Skin Enhancement'],
  neck: ['Neck Size', 'Neck Skin'],
  ears: ['Ear Structure'],
  smile: ['Smile Shape', 'Teeth & Gingiva'],
}

export function cloneProtocolDraft(assessment, locale = 'en') {
  if (locale === 'de') {
    const pn = assessment?.protocolNarrative || { summary: '', closing: [], features: {}, de: {} }
    const de = pn.de || {}
    const features = {}
    for (const [fid, entry] of Object.entries(assessment?.featureNarratives || {})) {
      const deFeat = entry?.de || {}
      features[fid] = {
        ...entry,
        summary: deFeat.summary ?? '',
        subsections: structuredClone(deFeat.subsections || []),
      }
    }
    return {
      protocolNarrative: {
        ...structuredClone(pn),
        summary: de.summary ?? '',
        closing: structuredClone(de.closing || []),
      },
      featureNarratives: features,
      editLocale: 'de',
    }
  }
  return {
    protocolNarrative: structuredClone(assessment?.protocolNarrative || { summary: '', closing: [], features: {} }),
    featureNarratives: structuredClone(assessment?.featureNarratives || {}),
    editLocale: 'en',
  }
}

/** Merge admin draft back into assessment shape for PATCH (locale-aware). */
export function draftToAssessmentPayload(draft, assessment) {
  const locale = draft.editLocale || 'en'
  if (locale !== 'de') {
    return {
      protocolNarrative: draft.protocolNarrative,
      featureNarratives: draft.featureNarratives,
      narrativeLocale: 'en',
    }
  }
  const basePn = structuredClone(assessment?.protocolNarrative || {})
  basePn.de = {
    ...(basePn.de || {}),
    summary: draft.protocolNarrative?.summary ?? '',
    closing: draft.protocolNarrative?.closing ?? [],
    origin: 'admin',
  }
  const baseFeatures = structuredClone(assessment?.featureNarratives || {})
  for (const [fid, edited] of Object.entries(draft.featureNarratives || {})) {
    const existing = baseFeatures[fid] || {}
    baseFeatures[fid] = {
      ...existing,
      de: {
        ...(existing.de || {}),
        summary: edited.summary ?? '',
        subsections: edited.subsections ?? [],
        origin: 'admin',
      },
    }
  }
  return {
    protocolNarrative: basePn,
    featureNarratives: baseFeatures,
    narrativeLocale: 'de',
  }
}

export function draftSnapshot(draft) {
  return JSON.stringify(draft)
}

export function setClosingParagraphs(protocolNarrative, paragraphs) {
  return { ...(protocolNarrative || {}), closing: paragraphs }
}

export function ensureFeatureDraft(featureNarratives, featureId) {
  const titles = FEATURE_SUBSECTION_TITLES[featureId] || []
  const existing = featureNarratives[featureId] || {}
  const byTitle = new Map(
    (existing.subsections || []).map((sub) => [sub.title, sub.body || ''])
  )
  return {
    ...existing,
    featureId,
    summary: existing.summary || '',
    subsections: titles.map((title) => ({
      title,
      body: byTitle.get(title) || '',
    })),
  }
}

/**
 * Upsert a single feature subsection body without emitting empty siblings.
 * Only the edited title is written; untouched subsections stay absent so
 * `mergeSubsections` keeps their CV-derived defaults instead of blanking them.
 */
export function upsertFeatureSubsection(featureNarratives, featureId, title, body) {
  const existing = featureNarratives?.[featureId] || {}
  const subs = Array.isArray(existing.subsections) ? existing.subsections.slice() : []
  const idx = subs.findIndex((s) => s.title === title)
  if (idx >= 0) subs[idx] = { ...subs[idx], title, body }
  else subs.push({ title, body })
  return {
    ...(featureNarratives || {}),
    [featureId]: { ...existing, featureId, subsections: subs },
  }
}

/** Set a feature summary, preserving any existing subsections/fields. */
export function setFeatureSummary(featureNarratives, featureId, summary) {
  const existing = featureNarratives?.[featureId] || {}
  return {
    ...(featureNarratives || {}),
    [featureId]: { ...existing, featureId, summary },
  }
}

/** Merge canonical featureNarratives into protocolNarrative.features for PDF generation. */
export function mergeNarrativesForPdf(protocolNarrative, featureNarratives) {
  const base = protocolNarrative || { summary: '', closing: [], features: {} }
  if (!featureNarratives || !Object.keys(featureNarratives).length) return base
  return {
    ...base,
    features: { ...(base.features || {}), ...featureNarratives },
  }
}
