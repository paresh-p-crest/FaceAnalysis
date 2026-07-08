/** Collapse duplicate assessment rows (same user + scanId) for admin/client lists. */
export function dedupeAssessments(items = []) {
  const byKey = new Map()

  for (const item of items) {
    const key = item.scanId && item.userId ? `${item.userId}:${item.scanId}` : item.id
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, item)
      continue
    }
    const keepExisting = new Date(existing.createdAt) <= new Date(item.createdAt)
    byKey.set(key, keepExisting ? existing : item)
  }

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}
