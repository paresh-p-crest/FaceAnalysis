/** Landing package entitlements exposed on `/api/auth/me` user.entitlements.flags */

export const VISUAL_SECTION_ENTITLEMENT = {
  hair: 'ai_visuals_hair',
  outfit: 'ai_visuals_outfit',
  aging: 'ai_visuals_aging',
}

const PACKAGE_ANALYSIS_SLOTS = {
  analyse: 1,
  premium: 1,
  duo: 2,
}
const DEFAULT_ANALYSIS_SLOTS = 1

export function userHasEntitlement(user, flag) {
  if (!user) return false
  if (user.role === 'admin') return true
  return Boolean(user.entitlements?.flags?.[flag])
}

export function userHasAnyAiVisuals(user) {
  return (
    userHasEntitlement(user, VISUAL_SECTION_ENTITLEMENT.hair)
    || userHasEntitlement(user, VISUAL_SECTION_ENTITLEMENT.outfit)
    || userHasEntitlement(user, VISUAL_SECTION_ENTITLEMENT.aging)
  )
}

/** Submitted analysis cap from entitlements (analyse/premium=1, duo=2). */
export function userMaxAnalysisSlots(user) {
  if (!user) return DEFAULT_ANALYSIS_SLOTS
  if (user.role === 'admin') return 10000
  const ents = user.entitlements || {}
  const raw = Number(ents.analysisSlots)
  if (Number.isFinite(raw) && raw > 0) return raw
  const packages = Array.isArray(ents.packageIds) ? ents.packageIds : []
  let slots = DEFAULT_ANALYSIS_SLOTS
  for (const pid of packages) {
    slots = Math.max(slots, PACKAGE_ANALYSIS_SLOTS[pid] || DEFAULT_ANALYSIS_SLOTS)
  }
  return slots
}

export function filterVisualNavGroups(groups, user) {
  if (!user || user.role === 'admin') return groups
  return groups.map((group) => ({
    ...group,
    items: (group.items || []).filter((item) => userHasEntitlement(user, VISUAL_SECTION_ENTITLEMENT[item.id])),
  })).filter((group) => group.items.length > 0)
}

export function firstEntitledVisualSection(user, sections) {
  if (!user || user.role === 'admin') return sections[0]?.id || 'hair'
  const match = sections.find((section) => userHasEntitlement(user, VISUAL_SECTION_ENTITLEMENT[section.id]))
  return match?.id || sections[0]?.id || 'hair'
}
