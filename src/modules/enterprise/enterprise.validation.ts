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

export const createEnterpriseProblemSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  category: z.string().trim().default('PROCESS'),
  priority: z.string().trim().default('P3'),
  incidentId: z.string().min(1).optional().nullable(),
  assignedToId: z.string().min(1).optional().nullable(),
  rootCause: z.string().trim().optional().nullable(),
  workaround: z.string().trim().optional().nullable(),
})

export const updateEnterpriseProblemSchema = z.object({
  status: z.string().trim().optional(),
  rootCause: z.string().trim().optional().nullable(),
  workaround: z.string().trim().optional().nullable(),
  permanentFix: z.string().trim().optional().nullable(),
  resolutionDate: optionalDateString,
  knownError: z.boolean().optional(),
  assignedToId: z.string().min(1).optional().nullable(),
})

export const createEnterpriseChangeSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  type: z.string().trim().default('NORMAL'),
  priority: z.string().trim().default('P3'),
  riskScore: z.coerce.number().int().min(0).max(100).default(0),
  impact: z.string().trim().default('LOW'),
  justification: z.string().trim().optional().nullable(),
  rollbackPlan: z.record(z.string(), z.unknown()).optional().nullable(),
  implementationPlan: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledStart: optionalDateString,
  scheduledEnd: optionalDateString,
})

export const updateEnterpriseChangeSchema = z.object({
  status: z.string().trim().optional(),
  riskScore: z.coerce.number().int().min(0).max(100).optional(),
  justification: z.string().trim().optional().nullable(),
  rollbackPlan: z.record(z.string(), z.unknown()).optional().nullable(),
  implementationPlan: z.record(z.string(), z.unknown()).optional().nullable(),
  scheduledStart: optionalDateString,
  scheduledEnd: optionalDateString,
  actualStart: optionalDateString,
  actualEnd: optionalDateString,
  cabMeetingId: z.string().trim().optional().nullable(),
  approvalState: z.string().trim().optional(),
})

export const createTimeEntrySchema = z.object({
  minutes: z.coerce.number().int().min(1).max(1440),
  billable: z.boolean().default(true),
  description: z.string().trim().optional().nullable(),
  entryDate: optionalDateString,
})

export const incidentStatusTransitionSchema = z.object({
  status: z.enum(['OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']),
  resolution: z.string().trim().optional().nullable(),
  rootCause: z.string().trim().optional().nullable(),
})

export const approvedStatuses = ['OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const

export const INCIDENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['TRIAGED', 'CANCELLED'],
  TRIAGED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
}

export function isValidIncidentTransition(from: string, to: string): boolean {
  const allowed = INCIDENT_STATUS_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

export const CHANGE_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_CAB', 'CANCELLED'],
  PENDING_CAB: ['SCHEDULED', 'DRAFT', 'CANCELLED'],
  SCHEDULED: ['IMPLEMENTING', 'CANCELLED'],
  IMPLEMENTING: ['COMPLETED', 'ROLLED_BACK', 'CANCELLED'],
  COMPLETED: [],
  ROLLED_BACK: ['DRAFT', 'CANCELLED'],
  CANCELLED: [],
}

export function isValidChangeTransition(from: string, to: string): boolean {
  const allowed = CHANGE_STATUS_TRANSITIONS[from]
  if (!allowed) return false
  return allowed.includes(to)
}

export type CreateEnterpriseAssetInput = z.infer<typeof createEnterpriseAssetSchema>
export type CreateEnterpriseIncidentInput = z.infer<typeof createEnterpriseIncidentSchema>
export type UpdateEnterpriseIncidentInput = z.infer<typeof updateEnterpriseIncidentSchema>
export type CreateMaintenanceWorkOrderInput = z.infer<typeof createMaintenanceWorkOrderSchema>
export type UpdateMaintenanceWorkOrderInput = z.infer<typeof updateMaintenanceWorkOrderSchema>
export type CreateEnterpriseProblemInput = z.infer<typeof createEnterpriseProblemSchema>
export type UpdateEnterpriseProblemInput = z.infer<typeof updateEnterpriseProblemSchema>
export type CreateEnterpriseChangeInput = z.infer<typeof createEnterpriseChangeSchema>
export type UpdateEnterpriseChangeInput = z.infer<typeof updateEnterpriseChangeSchema>
export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>
