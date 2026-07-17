import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const handleI18n = createMiddleware(routing)

/**
 * Replit Autoscale always probes GET `/` (previewPath is ignored for this check).
 * Probes are non-browser (no sec-fetch-dest: document) — return 200 JSON immediately
 * so next-intl / SSR cannot 307/500 the deploy healthcheck.
 * Real browsers still get the normal locale-aware HTML app.
 */
export default function middleware(request) {
  const { pathname } = request.nextUrl
  if (pathname === '/' && request.method === 'GET') {
    const secFetchDest = request.headers.get('sec-fetch-dest')
    const accept = request.headers.get('accept') || ''
    const looksLikeBrowser =
      secFetchDest === 'document' || accept.includes('text/html')
    if (!looksLikeBrowser) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
  }
  return handleI18n(request)
}

export const config = {
  matcher: ['/((?!api|healthz|_next|_vercel|.*\\..*).*)'],
}
