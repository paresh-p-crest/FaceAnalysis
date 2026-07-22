/** QOVES-style report navigation structure — single source of truth for sidebar + routing. */

export const INTRO_SECTIONS = [
  { id: 'intro', labelKey: 'nav.intro' },
  { id: 'disclaimer', labelKey: 'nav.disclaimer' },
]

export const ASSESSMENT_SECTIONS = [
  { id: 'dimorphism', labelKey: 'nav.dimorphism' },
  { id: 'averageness', labelKey: 'nav.averageness' },
  { id: 'proportions', labelKey: 'nav.proportions' },
  { id: 'symmetry', labelKey: 'nav.symmetry' },
  { id: 'faceShape', labelKey: 'nav.faceShape' },
]

export const FEATURE_SECTIONS = [
  { id: 'eyebrows', labelKey: 'nav.eyebrows' },
  { id: 'eyes', labelKey: 'nav.eyes' },
  { id: 'nose', labelKey: 'nav.nose' },
  { id: 'lips', labelKey: 'nav.lips' },
  { id: 'cheeks', labelKey: 'nav.cheeks' },
  { id: 'jaw', labelKey: 'nav.jaw' },
  { id: 'chin', labelKey: 'nav.chin' },
  { id: 'hair', labelKey: 'nav.hair' },
  { id: 'smile', labelKey: 'nav.smile' },
  { id: 'neck', labelKey: 'nav.neck' },
  { id: 'ears', labelKey: 'nav.ears' },
  { id: 'skin', labelKey: 'nav.skin' },
]

export const PROTOCOL_SECTIONS = [
  { id: 'protocol', labelKey: 'nav.protocol' },
]

/** Standalone `/ai-visuals` page — three preview categories in report-style sidebar. */
export const AI_VISUAL_SECTIONS = [
  { id: 'hair', labelKey: 'sections.hair' },
  { id: 'outfit', labelKey: 'sections.outfit' },
  { id: 'aging', labelKey: 'sections.aging' },
]

export const AI_VISUAL_NAV_GROUPS = [
  { id: 'visuals', labelKey: 'navGroup', items: AI_VISUAL_SECTIONS },
]

export const REPORT_NAV_GROUPS = [
  { id: 'introduction', labelKey: 'nav.introduction', items: INTRO_SECTIONS },
  { id: 'assessments', labelKey: 'nav.facialAssessments', items: ASSESSMENT_SECTIONS },
  { id: 'features', labelKey: 'nav.featuresAnalysis', items: FEATURE_SECTIONS },
  { id: 'protocol', labelKey: 'nav.protocol', items: PROTOCOL_SECTIONS },
]

export const PUBLIC_SECTION_IDS = new Set([
  'intro',
  'disclaimer',
])

export function findNavGroupForSection(sectionId, groups = REPORT_NAV_GROUPS) {
  return groups.find((group) => group.items.some((item) => item.id === sectionId))?.id || null
}

export function isPublicSection(sectionId) {
  return PUBLIC_SECTION_IDS.has(sectionId)
}
