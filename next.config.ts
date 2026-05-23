import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ['@react-pdf/renderer', 'bufferutil', 'utf-8-validate'],
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 300,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/api/health',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
    ]
  },
}

export default nextConfig
