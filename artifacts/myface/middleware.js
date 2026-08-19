import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const handleI18n = createMiddleware(routing)

/**
 * Replit Autoscale probes GET `/` (custom health paths are ignored for deploy health).
 * Return a cheap 200 JSON only for *known* automated probes — never for browsers,
 * Agent Preview / Port Authority, or Next.js App Router flight/RSC traffic.
 *
 * Bug history: guessing "non-browser" from empty or star-Accept also matched:
 *   - RSC soft navigations (Accept: text/x-component, RSC: 1)
 *   - Replit Preview proxy fetches (star Accept, Sec-Fetch stripped, UA like Replit/…)
 * Those got {"ok":true} JSON instead of HTML/Flight → Invalid hook call + hydration failure
 * in Preview while a normal browser tab still worked.
 *
 * Rule: default pass-through. Opt in only for explicit probe signals.
 *
 * Note: never put the characters star-slash inside this block comment — it ends the comment early.
 */
function isExplicitHealthProbe(request) {
  // Next.js flight / soft-nav / prefetch — always pass through to the app.
  if (request.headers.get('rsc') != null) return false
  if (request.headers.get('next-router-state-tree') != null) return false
  if (request.headers.get('next-router-prefetch') != null) return false
  if (request.headers.get('next-url') != null) return false

  const accept = (request.headers.get('accept') || '').toLowerCase()
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase()
  const ua = (request.headers.get('user-agent') || '').toLowerCase()

  // Any document-like navigation → real app HTML (Preview iframe included).
  if (dest === 'document' || dest === 'iframe' || dest === 'embed') return false
  if (accept.includes('text/html') || accept.includes('text/x-component')) return false

  // Search Engine & Social Media Crawlers — always serve real app HTML for SEO/unfurling.
  if (/googlebot|bingbot|yandex|baiduspider|facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot|whatsapp/i.test(ua)) return false

  // Replit internal preview / port authority requests (not probes) — serve real app.
  if (/replit/i.test(ua) && !/health|probe|metasidecar/i.test(ua)) return false

  // Known automated probe UAs (Replit metasidecar / Go-http-client / K8s / CloudRun / Uptime).
  if (
    /kube-probe|googlehc|healthcheck|metasidecar|uptime|pingdom|go-http-client|wget\/|curl\//i.test(ua)
  ) {
    return true
  }

  // Explicit JSON preference from a non-browser monitoring client.
  if (accept.includes('application/json') && !accept.includes('text/html')) return true

  return false
}

export default function middleware(request) {
  const { pathname } = request.nextUrl
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    (pathname === '/healthz' || (pathname === '/' && isExplicitHealthProbe(request)))
  ) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // German is the product default. An explicitly selected NEXT_LOCALE cookie
  // still wins, but the browser's Accept-Language must not change the first
  // visit to English.
  const localeCookieName = routing.localeCookie?.name || 'NEXT_LOCALE'
  if (!request.cookies.get(localeCookieName)?.value) {
    request.cookies.set(localeCookieName, routing.defaultLocale)
  }

  return handleI18n(request)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
