export const ADMIN_TABS = ['overview', 'users', 'review', 'payments', 'settings']



export const ADMIN_TAB_STORAGE_KEY = 'aurascan_admin_tab'



export function readAdminTab() {

  if (typeof window === 'undefined') return 'overview'

  const hash = window.location.hash.replace(/^#/, '')

  if (hash.startsWith('admin-')) {

    const tab = hash.slice(6)

    if (tab === 'reports') return 'review'

    if (ADMIN_TABS.includes(tab)) return tab

  }

  const saved = localStorage.getItem(ADMIN_TAB_STORAGE_KEY)

  if (saved === 'reports') return 'review'

  if (saved && ADMIN_TABS.includes(saved)) return saved

  return 'overview'

}



export function persistAdminTab(tab) {

  if (typeof window === 'undefined') return

  const normalized = tab === 'reports' ? 'review' : tab

  localStorage.setItem(ADMIN_TAB_STORAGE_KEY, normalized)

  const base = `${window.location.pathname}${window.location.search}`

  window.history.replaceState({}, '', `${base}#admin-${normalized}`)

}



export function clearAdminTab() {

  if (typeof window === 'undefined') return

  localStorage.removeItem(ADMIN_TAB_STORAGE_KEY)

}

