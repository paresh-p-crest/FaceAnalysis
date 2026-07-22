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

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()

  // IMPORTANT: Do NOT inject a localStorage theme <script> here.
  // It caused Recoverable Error hydration mismatches in Replit Agent Preview
  // (server HTML had the script; client tree had empty __html).
  // Theme is applied after mount in ThemeProvider instead.
  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface text-ink font-sans antialiased" suppressHydrationWarning>
        <AnalyticsScripts />
        <ClientAppShell locale={locale} messages={messages}>
          {children}
        </ClientAppShell>
      </body>
    </html>
  )
}
