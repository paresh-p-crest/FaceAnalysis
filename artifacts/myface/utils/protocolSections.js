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

export function cloneProtocolDraft(assessment) {
  return {
    protocolNarrative: structuredClone(assessment?.protocolNarrative || { summary: '', closing: [], features: {} }),
    featureNarratives: structuredClone(assessment?.featureNarratives || {}),
  }
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
