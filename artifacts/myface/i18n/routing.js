import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'de',
  localePrefix: 'never',
  // Must stay true when localePrefix is 'never' — otherwise NEXT_LOCALE cookie is
  // ignored and the navbar LocaleSwitcher cannot persist a chosen language.
  localeDetection: true,
  alternateLinks: false,
  // Session cookies die on browser restart; keep the user's choice for a year.
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  },
})
