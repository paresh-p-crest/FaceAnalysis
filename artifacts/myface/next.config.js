import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.js')

/** Replit Agent chat webview embeds the app in a cross-origin iframe. */
const isReplit = Boolean(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow Replit proxy / Agent Preview / Open-dev-URL hosts to hit /_next/* in dev.
  // Without this, HMR and flight requests from *.replit.dev are blocked → broken hydrate.
  allowedDevOrigins: [
    '127.0.0.1',
    'localhost',
    '*.replit.dev',
    '*.pike.replit.dev',
    '*.worf.replit.dev',
    '*.kirk.replit.dev',
    '*.picard.replit.dev',
    '*.riker.replit.dev',
    '*.repl.co',
    '*.replit.app',
    'replit.com',
    '*.replit.com',
  ],

  // Proxy /api to Python backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },

  // Allow Agent / workspace iframes to embed the app (Open URL is top-level; chat Preview is iframe).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://replit.com https://*.replit.com https://*.replit.dev https://*.repl.co",
          },
        ],
      },
    ]
  },

  images: {
    unoptimized: true,
  },

  // Agent chat Preview is an iframe: Fast Refresh after edits often leaves a corrupted
  // React dispatcher → "Invalid hook call" + hydration failure, while Open URL (top-level)
  // still works. Disable React Refresh on Replit only; full reload still picks up changes.
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && isReplit) {
      config.plugins = (config.plugins || []).filter(
        (plugin) => plugin?.constructor?.name !== 'ReactRefreshWebpackPlugin',
      )
    }
    return config
  },
}

export default withNextIntl(nextConfig)
