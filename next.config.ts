import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer', 'bufferutil', 'utf-8-validate'],
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
}

export default nextConfig
