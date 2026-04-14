import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow Socket.io to work with the custom server
  webpack: (config) => {
    config.externals = [...(config.externals || []), { bufferutil: 'bufferutil', 'utf-8-validate': 'utf-8-validate' }]
    return config
  },
}

export default nextConfig
