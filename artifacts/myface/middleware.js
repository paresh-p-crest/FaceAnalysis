import { NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const handleI18n = createMiddleware(routing)

/**
 * Replit Autoscale always probes GET `/` (previewPath is ignored for this check).
 * Probes are non-navigational (no sec-fetch-dest document/iframe, no Accept: text/html).
 * Return 200 JSON for those so next-intl / SSR cannot 307/500 the deploy healthcheck.
 *
 * Browsers (document) and the Preview iframe (iframe / text/html) always get the HTML app.
 */
export default function middleware(request) {
  const { pathname } = request.nextUrl
  if (pathname === '/' && request.method === 'GET') {
    const secFetchDest = request.headers.get('sec-fetch-dest') || ''
    const accept = request.headers.get('accept') || ''
    const isNavigation =
      secFetchDest === 'document'
      || secFetchDest === 'iframe'
      || accept.includes('text/html')

    if (!isNavigation) {
      return NextResponse.json({ ok: true }, { status: 200 })
    }
  }
  return handleI18n(request)
}

export const config = {
  matcher: ['/((?!api|healthz|_next|_vercel|.*\\..*).*)'],
}
