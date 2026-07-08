export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ event: eventName, ...params })

  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', eventName, params)
  }
}

export function trackPageView(path) {
  trackEvent('PageView', { path })
}
