/** Which admin workspace resources each tab needs. */
export const ADMIN_LIST_PAGE_SIZE = 50

export const ADMIN_TAB_RESOURCES = {
  overview: ['assessments', 'users'],
  users: ['users'],
  review: ['assessments'],
}

export function resourcesForAdminTab(tab) {
  return ADMIN_TAB_RESOURCES[tab] || []
}

export function isAdminResourceLoading(loadingMap, resources = []) {
  return resources.some((key) => loadingMap[key])
}
