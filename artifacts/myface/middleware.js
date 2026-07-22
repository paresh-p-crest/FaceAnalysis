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

  // Browser / WebView UAs — never short-circuit (covers Agent Preview Chromium).
  if (/mozilla|chrome|safari|firefox|edg\/|opera|crios|fxios/i.test(ua)) return false

  // Replit product UAs that are NOT Autoscale healthchecks (Preview / Agent / Port Authority).
  if (/replit/i.test(ua) && !/health|kube-probe|googlehc/i.test(ua)) return false

  // Known automated probe UAs (Autoscale / k8s / curl smoke).
  if (
    /kube-probe|googlehc|healthcheck|uptime|pingdom|go-http-client|wget\/|curl\//i.test(ua)
  ) {
    return true
  }

  // Explicit JSON preference from a non-browser client (monitors).
  if (accept.includes('application/json')) return true

  // Default: serve the real app. Never guess from empty or star-only Accept alone.
  return false
}

export default function middleware(request) {
  const { pathname } = request.nextUrl
  if (pathname === '/' && request.method === 'GET' && isExplicitHealthProbe(request)) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }
  return handleI18n(request)
}

export const config = {
  matcher: ['/((?!api|healthz|_next|_vercel|.*\\..*).*)'],
}
