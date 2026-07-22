/** Which admin workspace resources each tab needs. */
export const ADMIN_TAB_RESOURCES = {
  overview: ['assessments', 'users', 'payments'],
  users: ['users'],
  review: ['assessments'],
  payments: ['payments'],
}

export function resourcesForAdminTab(tab) {
  return ADMIN_TAB_RESOURCES[tab] || []
}

export function isAdminResourceLoading(loadingMap, resources = []) {
  return resources.some((key) => loadingMap[key])
}
