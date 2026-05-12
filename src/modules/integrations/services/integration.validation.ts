import { z } from 'zod'
import { SOCIAL_PROVIDER_SLUGS } from '@/modules/integrations/core/types'

export const providerSlugSchema = z.enum(SOCIAL_PROVIDER_SLUGS)

export const manualSyncSchema = z.object({
  syncMode: z.enum(['incremental', 'full']).optional().default('incremental'),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
})

export const analyticsQuerySchema = z.object({
  provider: providerSlugSchema.optional(),
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
})

export type ManualSyncInput = z.infer<typeof manualSyncSchema>
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>
