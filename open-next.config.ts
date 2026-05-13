import { defineCloudflareConfig, type OpenNextConfig } from '@opennextjs/cloudflare'

export default {
  ...defineCloudflareConfig(),
  buildCommand: 'prisma generate && next build',
} satisfies OpenNextConfig
