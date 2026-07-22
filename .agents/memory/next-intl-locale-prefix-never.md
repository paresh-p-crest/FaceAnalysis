---
name: next-intl localePrefix 'never' hydration fix
description: Why NextIntlClientProvider needs an explicit locale prop when localePrefix is 'never'
---

When `defineRouting` sets `localePrefix: 'never'`, the locale is never visible in the URL (e.g. `/auth` not `/en/auth`). next-intl cannot infer the active locale from the URL on the client side. If `NextIntlClientProvider` does not receive an explicit `locale` prop, `useLocale()` returns different values on server vs client, causing React hydration mismatches. Any component that renders the locale string (e.g. `LocaleSwitcher`'s `<span>{locale}</span>`) will differ between SSR HTML and the first client render.

**Why:** The URL is locale-free by design, so the only source of truth for the client is what the server explicitly passes down.

**How to apply:** In `app/[locale]/layout.jsx`, always pass `locale={locale}` to `NextIntlClientProvider`:

```jsx
<NextIntlClientProvider locale={locale} messages={messages}>
  {children}
</NextIntlClientProvider>
```

Secondary fixes applied at the same time:
- Added `data-scroll-behavior="smooth"` to `<html>` to silence Next.js scroll-behavior warning.
- Added `'use client'` to `Report.jsx`, `FeatureAnalysisPage.jsx`, `PrototypicalityShapeAnalysis.jsx` — these use React hooks and need the directive even though they're dynamically imported with `ssr:false`.
