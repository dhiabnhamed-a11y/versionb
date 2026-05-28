import crypto from 'crypto'
import { prisma } from '@/lib/db'
import type { AuditLogEntry } from './types'

const PHI_FIELDS = new Set([
  'name', 'patientName', 'fullName', 'firstName', 'lastName',
  'ssn', 'socialSecurity', 'dob', 'birthDate', 'dateOfBirth',
  'phone', 'phoneNumber', 'mobile', 'email', 'emailAddress',
  'address', 'homeAddress', 'streetAddress',
  'medicalHistory', 'diagnosis', 'condition', 'symptoms',
  'medications', 'allergies', 'bloodType', 'genetic',
  'insuranceId', 'policyNumber', 'medicareId',
  'driverLicense', 'passportNumber',
])

export class AuditService {
  private companyId: string

  constructor(companyId: string) {
    this.companyId = companyId
  }

  static isPhiField(fieldName: string): boolean {
    const lower = fieldName.toLowerCase()
    return PHI_FIELDS.has(lower) || Array.from(PHI_FIELDS).some(phi => lower.includes(phi))
  }

  static detectPhiFields(data: Record<string, unknown>): string[] {
    return Object.keys(data).filter(key => AuditService.isPhiField(key))
  }

  private computeChecksum(entry: AuditLogEntry, previousLogId?: string): string {
    const data = JSON.stringify({ ...entry, previousLogId })
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  async log(entry: AuditLogEntry): Promise<void> {
    // Find previous log for chain
    const previousLog = await prisma.emsAuditLog.findFirst({
      where: { companyId: this.companyId },
      orderBy: { timestamp: 'desc' },
    })

    const checksum = this.computeChecksum(entry, previousLog?.id)

    await prisma.emsAuditLog.create({
      data: {
        companyId: this.companyId,
        integrationId: entry.integrationId,
        action: entry.action as any,
        actorId: entry.actorId,
        actorType: entry.actorType,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        containsPhi: entry.containsPhi,
        phiFields: entry.phiFields,
        description: entry.description,
        metadata: entry.metadata as any,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        success: entry.success,
        errorMessage: entry.errorMessage,
        checksum,
        previousLogId: previousLog?.id,
      },
    })
  }

  async logPhiAccess(params: {
    actorId?: string
    actorType?: 'user' | 'system' | 'integration'
    resourceType: string
    resourceId: string
    phiFields: string[]
    description: string
    ipAddress?: string
    userAgent?: string
  }): Promise<void> {
    await this.log({
      companyId: this.companyId,
      action: 'EMS_PATIENT_ACCESSED',
      actorId: params.actorId,
      actorType: params.actorType,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      containsPhi: true,
      phiFields: params.phiFields.join(', '),
      description: params.description,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      success: true,
    })
  }

  async logIntegrationAction(params: {
    integrationId: string
    action: string
    actorId?: string
    resourceType?: string
    resourceId?: string
    description: string
    success: boolean
    errorMessage?: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    await this.log({
      companyId: this.companyId,
      integrationId: params.integrationId,
      action: params.action,
      actorId: params.actorId,
      actorType: 'system',
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      containsPhi: false,
      description: params.description,
      metadata: params.metadata,
      success: params.success,
      errorMessage: params.errorMessage,
    })
  }

  async getAuditLog(params: {
    limit?: number
    offset?: number
    action?: string
    resourceType?: string
    containsPhi?: boolean
    integrationId?: string
    startDate?: Date
    endDate?: Date
  } = {}): Promise<unknown[]> {
    const where: Record<string, unknown> = { companyId: this.companyId }
    if (params.action) where.action = params.action
    if (params.resourceType) where.resourceType = params.resourceType
    if (params.containsPhi !== undefined) where.containsPhi = params.containsPhi
    if (params.integrationId) where.integrationId = params.integrationId
    if (params.startDate || params.endDate) {
      where.timestamp = {} as any
      if (params.startDate) (where.timestamp as any).gte = params.startDate
      if (params.endDate) (where.timestamp as any).lte = params.endDate
    }

    return prisma.emsAuditLog.findMany({
      where: where as any,
      orderBy: { timestamp: 'desc' },
      take: params.limit || 50,
      skip: params.offset || 0,
    })
  }

  async verifyChain(fromDate?: Date): Promise<{ valid: boolean; brokenAt?: string; totalLogs: number }> {
    const logs = await prisma.emsAuditLog.findMany({
      where: fromDate ? { timestamp: { gte: fromDate } } : {},
      orderBy: { timestamp: 'asc' },
    })

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      if (i > 0) {
        if (log.previousLogId !== logs[i - 1].id) {
          return { valid: false, brokenAt: log.id, totalLogs: logs.length }
        }
      }
      const expectedChecksum = this.computeChecksum(
        {
          companyId: log.companyId,
          integrationId: log.integrationId || undefined,
          action: log.action,
          actorId: log.actorId || undefined,
          actorType: (log.actorType as any) || undefined,
          resourceType: log.resourceType || undefined,
          resourceId: log.resourceId || undefined,
          containsPhi: log.containsPhi,
          phiFields: log.phiFields || undefined,
          description: log.description,
          metadata: log.metadata as any,
          ipAddress: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined,
          success: log.success,
          errorMessage: log.errorMessage || undefined,
        },
        i > 0 ? logs[i - 1].id : undefined
      )
      if (log.checksum !== expectedChecksum) {
        return { valid: false, brokenAt: log.id, totalLogs: logs.length }
      }
    }

    return { valid: true, totalLogs: logs.length }
  }
}
