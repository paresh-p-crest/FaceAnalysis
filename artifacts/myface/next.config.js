import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.js')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow the Replit dev proxy origin for HMR/cross-origin requests
  allowedDevOrigins: ['*.replit.dev', '*.pike.replit.dev', '*.repl.co'],

  // Proxy /api to Python backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },

  // Allow images from any domain (for user-uploaded photos)
  images: {
    unoptimized: true,
  },
}

export default withNextIntl(nextConfig)
