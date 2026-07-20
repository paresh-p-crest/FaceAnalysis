import '../globals.css'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { AnalyticsScripts } from '../../components/AnalyticsScripts'
import { Providers } from '../../components/providers/Providers'
import { RouteLayout } from '../../components/RouteLayout'
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
    description: meta.description || 'AI-powered facial analysis for aesthetic insights and personalized recommendations.',
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

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('myface_theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-surface text-ink font-sans antialiased">
        <AnalyticsScripts />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <RouteLayout>{children}</RouteLayout>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
