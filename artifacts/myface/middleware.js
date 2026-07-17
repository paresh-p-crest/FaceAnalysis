import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

export default createMiddleware(routing)

export const config = {
  // healthz: Replit deploy probe — must bypass next-intl (else [locale] 404)
  matcher: ['/((?!api|healthz|_next|_vercel|.*\\..*).*)'],
}
