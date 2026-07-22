import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.js')

/** Replit Agent chat webview embeds the app in a cross-origin iframe. */
const disableReactRefresh = Boolean(
  process.env.NEXT_DISABLE_REACT_REFRESH === '1' ||
    process.env.REPL_ID ||
    process.env.REPLIT_DEV_DOMAIN,
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode double-invoke amplifies iframe hydration races in Agent Preview.
  reactStrictMode: !disableReactRefresh,

  // Allow Replit proxy / Agent Preview / Open-dev-URL hosts to hit /_next/* in dev.
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

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },

  images: {
    unoptimized: true,
  },

  // Agent chat Preview is an iframe: Fast Refresh often corrupts React there
  // (Invalid hook call) while Open URL still works. Disable on Replit / when flagged.
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && disableReactRefresh) {
      config.plugins = (config.plugins || []).filter(
        (plugin) => plugin?.constructor?.name !== 'ReactRefreshWebpackPlugin',
      )
    }
    return config
  },
}

export default withNextIntl(nextConfig)
