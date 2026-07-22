import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const handleI18n = createMiddleware(routing)

/**
 * i18n only — do NOT short-circuit GET `/` with JSON.
 *
 * Replit Autoscale probes `/` and accepts any HTTP 200 (HTML is fine).
 * Returning `{"ok":true}` for “probe-like” requests repeatedly matched
 * Agent Preview / Port Authority / RSC traffic → Invalid hook call + hydration failure.
 *
 * Explicit liveness: GET `/healthz` (see app/healthz/route.js).
 */
export default function middleware(request) {
  return handleI18n(request)
}

export const config = {
  matcher: ['/((?!api|healthz|_next|_vercel|.*\\..*).*)'],
}
