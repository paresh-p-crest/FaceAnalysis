import { STAGES } from './constants'
import { adminTabFromPath, adminTabToPath, isAdminTabPath } from './adminPanel'

/** Only these four app routes (+ home redirect). */
export const ROUTES = {
  home: '/',
  analysis: '/analysis',
  dashboard: '/dashboard',
  history: '/history',
  billing: '/billing',
}

export const NAVBAR_PATHS = new Set([
  ROUTES.dashboard,
  ROUTES.history,
  ROUTES.billing,
])

/** All app routes require an authenticated session. */
export const PROTECTED_PATHS = new Set([
  ROUTES.dashboard,
  ROUTES.history,
  ROUTES.billing,
  ROUTES.analysis,
])

export function hasSiteNavbar(pathname) {
  if (NAVBAR_PATHS.has(pathname)) return true
  return isAdminTabPath(pathname)
}

export function requiresAuth(pathname) {
  if (!pathname || pathname === ROUTES.home) return true
  if (PROTECTED_PATHS.has(pathname)) return true
  return isAdminTabPath(pathname)
}

export const RESTORABLE_PATHS = new Set([
  ROUTES.dashboard,
  ROUTES.history,
  ROUTES.billing,
  ROUTES.analysis,
])

export const ANALYSIS_STEPS = {
  WELCOME: 'welcome',
  QUESTIONNAIRE: 'questionnaire',
  CONFIRM: 'confirm',
  UPLOAD: 'upload',
  SCANNING: 'scanning',
  PREPARING: 'preparing',
}

const LEGACY_REDIRECTS = {
  '/admin': adminTabToPath('overview'),
  '/payment-success': ROUTES.billing,
  '/report': ROUTES.history,
}

const LOCALE_PREFIX = /^\/(en|de)(?=\/|$)/

/** Strip /en or /de prefix from a raw browser pathname (bookmarks, cold load). */
export function stripLocaleFromPath(pathname) {
  if (!pathname) return ROUTES.home
  const stripped = pathname.replace(LOCALE_PREFIX, '')
  return stripped || ROUTES.home
}

export function resolveLegacyPath(pathname) {
  if (!pathname) return null
  if (LEGACY_REDIRECTS[pathname]) return LEGACY_REDIRECTS[pathname]
  if (pathname.startsWith('/report/')) return ROUTES.history
  if (pathname.startsWith('/analysis/')) return ROUTES.analysis
  return null
}

export function isKnownAppPath(pathname) {
  if (!pathname) return false
  if (pathname === ROUTES.home) return true
  if (Object.values(ROUTES).includes(pathname)) return true
  return isAdminTabPath(pathname)
}

export function logoPathForUser(user) {
  if (!user) return ROUTES.analysis
  if (user.role === 'admin') return adminTabToPath('overview')
  return ROUTES.dashboard
}

export function dashboardPathForUser(user) {
  if (user?.role === 'admin') return adminTabToPath('overview')
  return ROUTES.dashboard
}

export const STAGE_TO_ROUTE = {
  [STAGES.LANDING]: ROUTES.analysis,
  [STAGES.QUESTIONNAIRE]: ROUTES.analysis,
  [STAGES.UPLOAD]: ROUTES.analysis,
  [STAGES.SCANNING]: ROUTES.analysis,
  [STAGES.REPORT]: ROUTES.history,
  [STAGES.HISTORY]: ROUTES.history,
  [STAGES.BILLING]: ROUTES.billing,
  [STAGES.DASHBOARD]: ROUTES.dashboard,
  [STAGES.ADMIN]: adminTabToPath('overview'),
  [STAGES.PAYMENT_SUCCESS]: ROUTES.billing,
}

export function stageToPath(stage) {
  return STAGE_TO_ROUTE[stage] || ROUTES.analysis
}

export function parseAppPath(pathname) {
  if (!pathname || pathname === ROUTES.home) {
    return { stage: STAGES.LANDING, assessmentId: null }
  }
  if (pathname === ROUTES.analysis) {
    return { stage: STAGES.LANDING, assessmentId: null }
  }
  if (isAdminTabPath(pathname)) {
    return { stage: STAGES.ADMIN, assessmentId: null }
  }
  const stageEntry = Object.entries(STAGE_TO_ROUTE).find(([, path]) => path === pathname)
  if (stageEntry) {
    return { stage: stageEntry[0], assessmentId: null }
  }
  return { stage: null, assessmentId: null }
}

export const APP_PATHS = STAGE_TO_ROUTE

export { adminTabFromPath, adminTabToPath, isAdminTabPath }
