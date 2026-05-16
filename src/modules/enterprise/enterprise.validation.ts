import { z } from 'zod'

const optionalDateString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .nullable()

export const createEnterpriseAssetSchema = z.object({
  categoryId: z.string().min(1),
  departmentId: z.string().min(1).optional().nullable(),
  assignedTeamId: z.string().min(1).optional().nullable(),
  assignedUserId: z.string().min(1).optional().nullable(),
  name: z.string().trim().min(1),
  assetTag: z.string().trim().min(1),
  qrCode: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  serialNumber: z.string().trim().optional().nullable(),
  vendor: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  warrantyExpiresAt: optionalDateString,
  purchaseDate: optionalDateString,
  purchaseCost: z.coerce.number().nonnegative().optional().nullable(),
  lifecycleState: z.string().trim().optional(),
  operationalStatus: z.string().trim().optional(),
  healthScore: z.coerce.number().int().min(0).max(100).optional(),
  riskScore: z.coerce.number().int().min(0).max(100).optional(),
})

export const createEnterpriseIncidentSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  type: z.string().trim().min(1),
  priority: z.string().trim().default('P3'),
  severity: z.string().trim().default('MEDIUM'),
  impact: z.string().trim().default('MEDIUM'),
  urgency: z.string().trim().default('MEDIUM'),
  source: z.string().trim().default('MANUAL'),
  departmentId: z.string().min(1).optional().nullable(),
  assignedTeamId: z.string().min(1).optional().nullable(),
  assignedToId: z.string().min(1).optional().nullable(),
  assetId: z.string().min(1).optional().nullable(),
})

export const updateEnterpriseIncidentSchema = z.object({
  status: z.string().trim().optional(),
  assignedTeamId: z.string().min(1).optional().nullable(),
  assignedToId: z.string().min(1).optional().nullable(),
  firstRespondedAt: optionalDateString,
  rootCause: z.string().trim().optional().nullable(),
  resolution: z.string().trim().optional().nullable(),
  escalationState: z.string().trim().optional(),
  approvalState: z.string().trim().optional(),
})

export const createMaintenanceWorkOrderSchema = z.object({
  type: z.string().trim().default('PREVENTIVE'),
  priority: z.string().trim().default('P3'),
  assetId: z.string().min(1).optional().nullable(),
  planId: z.string().min(1).optional().nullable(),
  incidentId: z.string().min(1).optional().nullable(),
  departmentId: z.string().min(1).optional().nullable(),
  assignedTeamId: z.string().min(1).optional().nullable(),
  assignedTechnicianId: z.string().min(1).optional().nullable(),
  scheduledFor: optionalDateString,
  dueAt: optionalDateString,
})

export const updateMaintenanceWorkOrderSchema = z.object({
  status: z.string().trim().optional(),
  assignedTeamId: z.string().min(1).optional().nullable(),
  assignedTechnicianId: z.string().min(1).optional().nullable(),
  startedAt: optionalDateString,
  completedAt: optionalDateString,
  completionReport: z.record(z.string(), z.unknown()).optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
})

export type CreateEnterpriseAssetInput = z.infer<typeof createEnterpriseAssetSchema>
export type CreateEnterpriseIncidentInput = z.infer<typeof createEnterpriseIncidentSchema>
export type UpdateEnterpriseIncidentInput = z.infer<typeof updateEnterpriseIncidentSchema>
export type CreateMaintenanceWorkOrderInput = z.infer<typeof createMaintenanceWorkOrderSchema>
export type UpdateMaintenanceWorkOrderInput = z.infer<typeof updateMaintenanceWorkOrderSchema>
