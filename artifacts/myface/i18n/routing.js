import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'de',
  localePrefix: 'never',
  // Must stay true when localePrefix is 'never' — otherwise NEXT_LOCALE cookie is
  // ignored and the navbar LocaleSwitcher cannot persist a chosen language.
  localeDetection: true,
  // Persist the chosen language across browser restarts (default is a session cookie).
  // Each switch overwrites the cookie, so this only fixes the lifetime, not the value.
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365, // 1 year
  },
  alternateLinks: false,
})
