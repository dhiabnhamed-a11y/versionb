import { z } from 'zod'

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required.`)

export const createAlertSchema = z.object({
  type: z.string().trim().optional(),
  title: requiredText('Alert title'),
  message: requiredText('Alert message'),
  recipientId: requiredText('Alert recipient'),
})

export const markAlertReadSchema = z.object({
  alertId: requiredText('Alert id'),
})

export type CreateAlertInput = z.infer<typeof createAlertSchema>
export type MarkAlertReadInput = z.infer<typeof markAlertReadSchema>
