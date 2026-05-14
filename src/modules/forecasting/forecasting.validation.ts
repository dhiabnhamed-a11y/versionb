import { z } from 'zod'

export const createForecastSchema = z.object({
  periodId: z.string().trim().min(1).max(128).optional().nullable(),
  name: z.string().trim().min(2).max(160),
  horizon: z.string().trim().min(2).max(80).optional(),
  currency: z.string().trim().length(3).optional().nullable(),
  startsAt: z.string().trim().min(1).optional().nullable(),
  endsAt: z.string().trim().min(1).optional().nullable(),
  assumptions: z.unknown().optional(),
  metrics: z.unknown().optional(),
})
