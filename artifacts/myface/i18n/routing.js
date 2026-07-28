import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'de',
  localePrefix: 'never',
  // Must stay true when localePrefix is 'never' — otherwise NEXT_LOCALE cookie is
  // ignored and the navbar LocaleSwitcher cannot persist a chosen language.
  localeDetection: true,
  alternateLinks: false,
})
