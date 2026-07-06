/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

export default nextConfig
