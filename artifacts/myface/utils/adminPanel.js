export const ADMIN_TABS = ['overview', 'users', 'review', 'payments']

export const ADMIN_TAB_STORAGE_KEY = 'myface_admin_tab'

/** URL segment per tab, e.g. `/dashboard/admin-overview`. */
export const ADMIN_TAB_SEGMENTS = {
  overview: 'admin-overview',
  users: 'admin-users',
  review: 'admin-review',
  payments: 'admin-payments',
}

const SEGMENT_TO_TAB = Object.fromEntries(
  Object.entries(ADMIN_TAB_SEGMENTS).map(([tab, segment]) => [segment, tab]),
)

export function adminTabToPath(tab) {
  const normalized = tab === 'reports' ? 'review' : tab
  const segment = ADMIN_TAB_SEGMENTS[normalized] || ADMIN_TAB_SEGMENTS.overview
  return `/dashboard/${segment}`
}

export function adminTabFromPath(pathname) {
  if (!pathname?.startsWith('/dashboard/')) return null
  const segment = pathname.slice('/dashboard/'.length).split('/')[0]
  const tab = SEGMENT_TO_TAB[segment]
  return tab && ADMIN_TABS.includes(tab) ? tab : null
}

export function isAdminTabPath(pathname) {
  return adminTabFromPath(pathname) !== null
}

export function readAdminTab(pathname) {
  const fromPath = adminTabFromPath(pathname)
  if (fromPath) return fromPath

  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace(/^#/, '')
    if (hash.startsWith('admin-')) {
      const legacy = hash.slice(6)
      if (legacy === 'reports') return 'review'
      if (ADMIN_TABS.includes(legacy)) return legacy
    }
    const saved = localStorage.getItem(ADMIN_TAB_STORAGE_KEY)
    if (saved === 'reports') return 'review'
    if (saved && ADMIN_TABS.includes(saved)) return saved
  }

  return 'overview'
}

export function persistAdminTab(tab) {
  if (typeof window === 'undefined') return
  const normalized = tab === 'reports' ? 'review' : tab
  if (ADMIN_TABS.includes(normalized)) {
    localStorage.setItem(ADMIN_TAB_STORAGE_KEY, normalized)
  }
}

export function clearAdminTab() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_TAB_STORAGE_KEY)
}

export function resolveLegacyAdminHash() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith('admin-')) return null
  const legacy = hash.slice(6)
  if (legacy === 'reports') return adminTabToPath('review')
  if (ADMIN_TABS.includes(legacy)) return adminTabToPath(legacy)
  return null
}
