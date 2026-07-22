import '../globals.css'
import { notFound } from 'next/navigation'
import { hasLocale } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { AnalyticsScripts } from '../../components/AnalyticsScripts'
import { ClientAppShell } from '../../components/ClientAppShell'
import { routing } from '../../i18n/routing'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }) {
  const { locale } = await params
  const messages = (await import(`../../messages/${locale}.json`)).default
  const meta = messages.Metadata || {}

  return {
    title: meta.title || 'MyFace - AI Facial Analysis',
    description:
      meta.description ||
      'AI-powered facial analysis for aesthetic insights and personalized recommendations.',
    icons: {
      icon: [{ url: '/favicon.png', type: 'image/png' }],
      shortcut: '/favicon.png',
      apple: '/favicon.png',
    },
  }
}

/**
 * Do NOT put manual <head> children here (font <link>s, theme <script>, etc.).
 * Replit Agent Preview injects `/__replco/static/devtools/injected.js` into <head>;
 * React then hydrates our font <link> against that <script> → Recoverable Error.
 * Inter is already loaded via `globals.css` @import.
 */
export default async function LocaleLayout({ children, params }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-surface text-ink font-sans antialiased" suppressHydrationWarning>
        <AnalyticsScripts />
        <ClientAppShell locale={locale} messages={messages}>
          {children}
        </ClientAppShell>
      </body>
    </html>
  )
}
