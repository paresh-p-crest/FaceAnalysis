import './globals.css'
import { AnalyticsScripts } from '../components/AnalyticsScripts'
import { Providers } from '../components/providers/Providers'
import { RouteLayout } from '../components/RouteLayout'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'MyFace - AI Facial Analysis',
  description: 'AI-powered facial analysis for aesthetic insights and personalized recommendations.',
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
        <Providers>
          <RouteLayout>{children}</RouteLayout>
        </Providers>
      </body>
    </html>
  )
}
