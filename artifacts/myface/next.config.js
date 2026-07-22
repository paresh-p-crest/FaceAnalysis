import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.js')

function stripReactRefresh(config) {
  config.plugins = (config.plugins || []).filter((plugin) => {
    const name = String(plugin?.constructor?.name || '')
    return !/reactrefresh/i.test(name)
  })
  return config
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  devIndicators: false,

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

  // Agent Preview iframe + Fast Refresh → Invalid hook call. Always strip.
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) stripReactRefresh(config)
    return config
  },
}

export default withNextIntl(nextConfig)
