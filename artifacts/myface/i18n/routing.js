import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'never',
  // Avoid 307 x-default redirect loop on `/` — Replit Autoscale probes `/` and needs 2xx.
  localeDetection: false,
  alternateLinks: false,
})
