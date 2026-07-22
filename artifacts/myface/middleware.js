import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const handleI18n = createMiddleware(routing)

/**
 * Replit Autoscale probes GET `/` (previewPath is ignored for deploy health).
 * Return a cheap 200 JSON only for *explicit* probes — never for browsers,
 * Preview iframes, or Next.js App Router flight/RSC traffic.
 *
 * Bug history: treating "not text/html" as a probe also matched:
 *   - RSC soft navigations (Accept: text/x-component, RSC: 1)
 *   - Replit Preview proxy fetches (Accept: star-slash-star with Sec-Fetch stripped)
 * Those got {"ok":true} JSON instead of HTML/Flight → Invalid hook call + hydration failure.
 */
function isExplicitHealthProbe(request) {
  // Next.js flight / soft-nav / prefetch — always pass through to the app.
  if (request.headers.get('rsc') != null) return false
  if (request.headers.get('next-router-state-tree') != null) return false
  if (request.headers.get('next-router-prefetch') != null) return false
  if (request.headers.get('next-url') != null) return false

  const accept = (request.headers.get('accept') || '').toLowerCase()
  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase()
  const mode = (request.headers.get('sec-fetch-mode') || '').toLowerCase()
  const ua = (request.headers.get('user-agent') || '').toLowerCase()

  if (dest === 'document' || dest === 'iframe') return false
  if (accept.includes('text/html') || accept.includes('text/x-component')) return false

  // Explicit JSON preference (monitors / Autoscale-style probes).
  if (accept.includes('application/json')) return true

  // Known probe UAs.
  if (/healthcheck|kube-probe|googlehc|uptime|pingdom|replit.*health|wget|curl\//i.test(ua)) {
    return true
  }

  // Empty / */* Accept with no browser Sec-Fetch signals and a non-browser UA.
  if (!mode && !dest && (accept === '' || accept === '*/*') && !/mozilla|chrome|safari|firefox|edge|opera/i.test(ua)) {
    return true
  }

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
