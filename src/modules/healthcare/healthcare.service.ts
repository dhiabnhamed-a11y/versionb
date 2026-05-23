/**
 * Healthcare Operations Service
 * 
 * Provides healthcare-specific data operations for:
 * - Patient management
 * - Department operations
 * - Staff scheduling
 * - Biomedical asset management
 * - Facility operations
 * - Inventory management
 * - Compliance tracking
 * - Emergency operations
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db'

export interface HealthcareDashboardMetrics {
  // Patient metrics
  totalPatients: number
  admittedPatients: number
  edVisits: number
  bedOccupancy: number
  avgLengthOfStay: number
  
  // Staff metrics
  onDutyStaff: number
  onCallStaff: number
  staffPatientRatio: number
  
  // Asset metrics
  activeAssets: number
  assetsInMaintenance: number
  criticalAssetsDown: number
  assetUptime: number
  
  // Incident metrics
  openIncidents: number
  criticalIncidents: number
  avgResponseTime: number
  
  // Compliance metrics
  complianceScore: number
  upcomingAudits: number
  trainingCompliance: number
}

export interface PatientSummary {
  id: string
  patientId: string
  name: string
  age: number
  gender: string
  admissionDate?: Date
  dischargeDate?: Date
  department?: string
  status: 'registered' | 'admitted' | 'in-treatment' | 'discharged' | 'transferred'
  primaryPhysician?: string
  insuranceProvider?: string
}

export interface DepartmentSummary {
  id: string
  code: string
  name: string
  type: 'clinical' | 'diagnostic' | 'administrative' | 'support'
  headOfDepartment?: string
  staffCount: number
  bedCount?: number
  occupancyRate?: number
  activeIncidents: number
  assetCount: number
}

export interface AssetHealthSummary {
  id: string
  assetTag: string
  name: string
  category: string
  department?: string
  healthScore: number
  riskScore: number
  status: 'operational' | 'maintenance' | 'out-of-service' | 'calibration'
  nextMaintenanceAt?: Date
  lastMaintenanceAt?: Date
  assignedTo?: string
}

export interface StaffShiftSummary {
  id: string
  staffName: string
  role: string
  department: string
  shiftStart: Date
  shiftEnd: Date
  status: 'on-duty' | 'on-call' | 'off-duty' | 'on-leave'
}

export interface EmergencyAlert {
  id: string
  code: string
  type: 'code-blue' | 'code-red' | 'code-pink' | 'code-silver' | 'code-orange' | 'code-yellow' | 'code-green' | 'code-white' | 'code-black' | 'code-gray'
  title: string
  location: string
  reportedAt: Date
  status: 'active' | 'responding' | 'resolved' | 'cancelled'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assignedTeam?: string
}

export class HealthcareService {
  /**
   * Get comprehensive healthcare dashboard metrics
   */
  static async getDashboardMetrics(companyId: string): Promise<HealthcareDashboardMetrics> {
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const dueSoon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [assets, incidents, controls, shifts] = await Promise.all([
      prisma.enterpriseAsset.findMany({
        where: { companyId, deletedAt: null },
        select: { operationalStatus: true, riskScore: true },
      }),
      prisma.enterpriseIncident.findMany({
        where: { companyId },
        select: { status: true, priority: true, createdAt: true, firstRespondedAt: true },
      }),
      prisma.enterpriseComplianceControl.findMany({
        where: { companyId },
        select: { status: true, nextReviewAt: true },
      }),
      prisma.enterpriseShift.findMany({
        where: { companyId, startsAt: { lte: now }, endsAt: { gte: now } },
        select: { staffCount: true, type: true },
      }),
    ])

    const openIncidents = incidents.filter((incident) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(incident.status))
    const respondedIncidents = incidents.filter((incident) => incident.firstRespondedAt)
    const avgResponseTime = respondedIncidents.length
      ? Math.round(respondedIncidents.reduce((sum, incident) => sum + ((incident.firstRespondedAt?.getTime() ?? incident.createdAt.getTime()) - incident.createdAt.getTime()), 0) / respondedIncidents.length / 60000)
      : 0
    const compliantControls = controls.filter((control) => control.status === 'COMPLIANT').length

    return {
      totalPatients: 0,
      admittedPatients: 0,
      edVisits: incidents.filter((incident) => incident.createdAt >= dayAgo && ['P1', 'P2', 'CRITICAL', 'HIGH'].includes(incident.priority)).length,
      bedOccupancy: 0,
      avgLengthOfStay: 0,
      onDutyStaff: shifts.reduce((sum, shift) => sum + shift.staffCount, 0),
      onCallStaff: shifts.filter((shift) => shift.type === 'oncall').reduce((sum, shift) => sum + shift.staffCount, 0),
      staffPatientRatio: 0,
      activeAssets: assets.filter((asset) => asset.operationalStatus === 'OPERATIONAL').length,
      assetsInMaintenance: assets.filter((asset) => asset.operationalStatus === 'MAINTENANCE').length,
      criticalAssetsDown: assets.filter((asset) => asset.operationalStatus === 'OUT_OF_SERVICE' || asset.riskScore > 70).length,
      assetUptime: assets.length ? Math.round((assets.filter((asset) => asset.operationalStatus === 'OPERATIONAL').length / assets.length) * 100) : 100,
      openIncidents: openIncidents.length,
      criticalIncidents: openIncidents.filter((incident) => ['P1', 'CRITICAL'].includes(incident.priority)).length,
      avgResponseTime,
      complianceScore: controls.length ? Math.round((compliantControls / controls.length) * 100) : 100,
      upcomingAudits: controls.filter((control) => control.nextReviewAt && control.nextReviewAt <= dueSoon).length,
      trainingCompliance: controls.length ? Math.round((compliantControls / controls.length) * 100) : 100,
    }
  }

  /**
   * Get patient summaries for the dashboard
   */
  static async getPatientSummaries(companyId: string, limit: number = 10): Promise<PatientSummary[]> {
    void companyId; void limit
    // Patient storage is intentionally external until a clinical data connector is configured.
    return []
  }

  /**
   * Get department summaries with operational status
   */
  static async getDepartmentSummaries(companyId: string): Promise<DepartmentSummary[]> {
    const departments = await prisma.enterpriseDepartment.findMany({
      where: { companyId },
      include: {
        _count: {
          select: {
            assets: true,
            incidents: true,
          }
        },
        teams: {
          select: {
            _count: {
              select: {
                members: true,
              }
            }
          }
        }
      }
    })

    return departments.map((dept: any) => ({
      id: dept.id,
      code: dept.code,
      name: dept.name,
      type: dept.type as 'clinical' | 'diagnostic' | 'administrative' | 'support',
      headOfDepartment: dept.managerId || undefined,
      staffCount: dept.teams.reduce((sum: number, team: any) => sum + team._count.members, 0),
      activeIncidents: dept._count.incidents,
      assetCount: dept._count.assets,
    }))
  }

  /**
   * Get asset health summaries for critical medical equipment
   */
  static async getAssetHealthSummaries(companyId: string, limit: number = 20): Promise<AssetHealthSummary[]> {
    const assets = await prisma.enterpriseAsset.findMany({
      where: { companyId },
      include: {
        category: true,
        department: true,
        assignedUser: true,
      },
      orderBy: { healthScore: 'asc' },
      take: limit,
    })

    return assets.map((asset: any) => ({
      id: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category.name,
      department: asset.department?.name,
      healthScore: asset.healthScore,
      riskScore: asset.riskScore,
      status: asset.operationalStatus as 'operational' | 'maintenance' | 'out-of-service' | 'calibration',
      nextMaintenanceAt: asset.nextMaintenanceAt || undefined,
      lastMaintenanceAt: asset.lastMaintenanceAt || undefined,
      assignedTo: asset.assignedUser?.name,
    }))
  }

  /**
   * Get staff shift summaries for current operations
   */
  static async getStaffShiftSummaries(companyId: string): Promise<StaffShiftSummary[]> {
    // Try to read persisted shifts from EnterpriseShift (new Prisma model). If no shifts exist,
    // fall back to an empty array so callers can render fallback UI.
    try {
      const shifts = await prisma.enterpriseShift.findMany({
        where: { companyId },
        orderBy: { startsAt: 'asc' },
        take: 100,
      })

      return shifts.map((s: any) => ({
        id: s.id,
        staffName: s.name,
        role: s.department || 'General',
        department: s.department || 'General',
        shiftStart: s.startsAt,
        shiftEnd: s.endsAt,
        status: (s.type === 'oncall' ? 'on-call' : 'on-duty') as any,
      }))
    } catch {
      // If the EnterpriseShift model isn't present in the database yet, return an empty list.
      return []
    }
  }

  /**
   * List persisted enterprise shifts for a company
   */
  static async listShifts(companyId: string) {
    const where = { companyId }
    const rows = await prisma.enterpriseShift.findMany({ where, orderBy: { startsAt: 'asc' } })
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      department: r.department,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      type: r.type,
      staffCount: r.staffCount,
      coverage: r.coverage,
      metadata: r.metadata,
    }))
  }

  static async createShift(companyId: string, input: any) {
    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)
    if (!companyId) throw new Error('Company is required')
    if (!String(input.name || '').trim()) throw new Error('Shift name is required')
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new Error('Valid shift start and end times are required')
    if (endsAt.getTime() <= startsAt.getTime()) throw new Error('Shift end time must be after the start time')

    const payload = {
      companyId,
      name: String(input.name).trim(),
      department: input.department || null,
      startsAt,
      endsAt,
      type: input.type || 'day',
      staffCount: Number(input.staffCount || 0),
      coverage: Number(input.coverage ?? 100),
      metadata: input.metadata || null,
    }
    return prisma.enterpriseShift.create({ data: payload })
  }

  static async updateShift(companyId: string, id: string, input: any) {
    const existing = await prisma.enterpriseShift.findUnique({ where: { id } })
    if (!existing || existing.companyId !== companyId) throw new Error('Not found')
    const data: any = {}
    if (input.name !== undefined) data.name = String(input.name)
    if (input.department !== undefined) data.department = input.department
    if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt)
    if (input.endsAt !== undefined) data.endsAt = new Date(input.endsAt)
    if (input.type !== undefined) data.type = input.type
    if (input.staffCount !== undefined) data.staffCount = Number(input.staffCount)
    if (input.coverage !== undefined) data.coverage = Number(input.coverage)
    if (input.metadata !== undefined) data.metadata = input.metadata

    return prisma.enterpriseShift.update({ where: { id }, data })
  }

  static async deleteShift(companyId: string, id: string) {
    const existing = await prisma.enterpriseShift.findUnique({ where: { id } })
    if (!existing || existing.companyId !== companyId) throw new Error('Not found')
    await prisma.enterpriseShift.delete({ where: { id } })
    return { success: true }
  }

  /**
   * Get active emergency alerts
   */
  static async getActiveEmergencyAlerts(companyId: string): Promise<EmergencyAlert[]> {
    const incidents = await prisma.enterpriseIncident.findMany({
      where: {
        companyId,
        status: { in: ['REPORTED', 'INVESTIGATING', 'ESCALATED'] },
        priority: { in: ['CRITICAL', 'HIGH'] },
      },
      include: {
        assignedTeam: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return incidents.map((incident: any) => ({
      id: incident.id,
      code: incident.incidentNumber,
      type: this.mapIncidentToCodeType(incident.type),
      title: incident.title,
      location: incident.location || 'Unknown',
      reportedAt: incident.createdAt,
      status: this.mapIncidentStatus(incident.status),
      priority: this.mapIncidentPriority(incident.priority),
      assignedTeam: incident.assignedTeam?.name,
    }))
  }

  private static mapIncidentToCodeType(type: string): EmergencyAlert['type'] {
    const typeMap: Record<string, EmergencyAlert['type']> = {
      'medical-emergency': 'code-blue',
      'fire': 'code-red',
      'security': 'code-silver',
      'hazardous': 'code-orange',
      'missing-person': 'code-yellow',
    }
    return typeMap[type] || 'code-blue'
  }

  private static mapIncidentStatus(status: string): EmergencyAlert['status'] {
    const statusMap: Record<string, EmergencyAlert['status']> = {
      'REPORTED': 'active',
      'INVESTIGATING': 'responding',
      'ESCALATED': 'responding',
      'RESOLVED': 'resolved',
      'CLOSED': 'resolved',
      'CANCELLED': 'cancelled',
    }
    return statusMap[status] || 'active'
  }

  private static mapIncidentPriority(priority: string): EmergencyAlert['priority'] {
    const priorityMap: Record<string, EmergencyAlert['priority']> = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
    }
    return priorityMap[priority] || 'medium'
  }

  /**
   * Get compliance status overview
   */
  static async getComplianceOverview(companyId: string) {
    const complianceControls = await prisma.enterpriseComplianceControl.findMany({
      where: { companyId },
    })

    return {
      totalControls: complianceControls.length,
      compliantControls: complianceControls.filter((c: any) => c.status === 'COMPLIANT').length,
      nonCompliantControls: complianceControls.filter((c: any) => c.status === 'NON_COMPLIANT').length,
      pendingReviews: complianceControls.filter((c: any) => c.status === 'PENDING_REVIEW').length,
      upcomingAudits: complianceControls.filter((c: any) => {
        if (!c.nextReviewAt) return false
         
        const daysUntil = (new Date(c.nextReviewAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        return daysUntil <= 30 && daysUntil >= 0
      }).length,
    }
  }

  /**
   * Get inventory alerts for critical supplies
   */
  static async getInventoryAlerts(companyId: string) {
    void companyId
    // In production, query actual inventory data
    return {
      lowStockItems: 0,
      expiredItems: 0,
      outOfStockItems: 0,
      criticalMedications: 0,
    }
  }
}

export const healthcareService = HealthcareService
