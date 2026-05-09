import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'bufferutil', 'utf-8-validate'],
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': [
      './node_modules/@sparticuz/chromium/bin/**/*',
      './node_modules/@fontsource/noto-naskh-arabic/files/*.woff2',
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
}

export default nextConfig
