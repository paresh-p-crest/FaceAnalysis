/** Client nav to home; hard-reloads when already on the target route. */
export function navigateHome(router, pathname, href) {
  if (pathname === href) {
    window.location.assign(href)
    return
  }
  router.push(href)
}
