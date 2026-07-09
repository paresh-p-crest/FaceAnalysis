/** QOVES-style report navigation structure — single source of truth for sidebar + routing. */

export const INTRO_SECTIONS = [
  { id: 'intro', label: 'Introduction' },
  { id: 'disclaimer', label: 'Disclaimer' },
]

export const ASSESSMENT_SECTIONS = [
  { id: 'dimorphism', label: 'Dimorphism' },
  { id: 'averageness', label: 'Prototypicality' },
  { id: 'proportions', label: 'Proportions' },
  { id: 'symmetry', label: 'Symmetry' },
  { id: 'faceShape', label: 'Face Shape' },
]

export const FEATURE_SECTIONS = [
  { id: 'eyebrows', label: 'Eyebrows' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'nose', label: 'Nose' },
  { id: 'lips', label: 'Lips' },
  { id: 'cheeks', label: 'Cheeks' },
  { id: 'jaw', label: 'Jaw' },
  { id: 'chin', label: 'Chin' },
  { id: 'hair', label: 'Hair' },
  { id: 'smile', label: 'Smile' },
  { id: 'neck', label: 'Neck' },
  { id: 'ears', label: 'Ears' },
  { id: 'skin', label: 'Skin' },
]

export const PROTOCOL_SECTIONS = [
  { id: 'protocol', label: 'Protocol' },
]

export const TOOL_SECTIONS = [
  { id: 'aiVisuals', label: 'AI Visuals' },
  { id: 'beautyAssistant', label: 'Beauty Assistant' },
]

export const REPORT_NAV_GROUPS = [
  { id: 'introduction', label: 'Introduction', items: INTRO_SECTIONS },
  { id: 'assessments', label: 'Facial Assessments', items: ASSESSMENT_SECTIONS },
  { id: 'features', label: 'Features Analysis', items: FEATURE_SECTIONS },
  { id: 'protocol', label: 'Protocol', items: PROTOCOL_SECTIONS },
]

export const PUBLIC_SECTION_IDS = new Set([
  'intro',
  'disclaimer',
])

export function findNavGroupForSection(sectionId) {
  return REPORT_NAV_GROUPS.find((group) => group.items.some((item) => item.id === sectionId))?.id
    || (TOOL_SECTIONS.some((item) => item.id === sectionId) ? 'tools' : null)
}

export function isPublicSection(sectionId) {
  return PUBLIC_SECTION_IDS.has(sectionId)
}
