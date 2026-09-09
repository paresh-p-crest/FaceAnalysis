/** Landing package entitlements exposed on `/api/auth/me` user.entitlements.flags */

export const VISUAL_SECTION_ENTITLEMENT = {
  hair: 'ai_visuals_hair',
  outfit: 'ai_visuals_outfit',
  aging: 'ai_visuals_aging',
}

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
