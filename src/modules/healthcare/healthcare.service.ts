/**
 * Healthcare Operations Service
 *
 * Real data from:
 * - HospitalPatient  — patient census, admissions, discharges
 * - HospitalBed      — bed occupancy and availability
 * - HospitalMedicalSupply — supply / medication inventory alerts
 * - EnterpriseAsset  — biomedical equipment health
 * - EnterpriseIncident — emergency alerts
 * - EnterpriseShift  — staff on-duty counts
 * - EnterpriseComplianceControl — compliance score
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db'
import { badRequest, notFound } from '@/modules/shared/errors'

export interface HealthcareDashboardMetrics {
  totalPatients: number
  admittedPatients: number
  edVisits: number
  bedOccupancy: number          // percentage 0-100
  avgLengthOfStay: number       // days
  onDutyStaff: number
  onCallStaff: number
  staffPatientRatio: number
  activeAssets: number
  assetsInMaintenance: number
  criticalAssetsDown: number
  assetUptime: number
  openIncidents: number
  criticalIncidents: number
  avgResponseTime: number
  complianceScore: number
  upcomingAudits: number
  trainingCompliance: number
}

export interface PatientSummary {
  id: string
  patientNumber: string
  name: string
  age: number | null
  gender: string | null
  admissionDate: Date | null
  dischargeDate: Date | null
  department: string | null
  status: string
  primaryPhysician: string | null
  insuranceProvider: string | null
  bedNumber: string | null
}

export interface BedSummary {
  id: string
  bedNumber: string
  ward: string
  department: string | null
  type: string
  status: string
  patientName: string | null
}

export interface InventoryAlertSummary {
  lowStockItems: number
  expiredItems: number
  outOfStockItems: number
  criticalMedications: number
}

export interface SupplySummary {
  id: string
  name: string
  category: string
  unit: string
  currentStock: number
  minimumStock: number
  reorderPoint: number
  expiresAt: Date | null
  isCritical: boolean
  department: string | null
  alertLevel: 'ok' | 'low' | 'critical' | 'out' | 'expiring'
}

export interface DepartmentSummary {
  id: string
  code: string
  name: string
  type: string
  headOfDepartment: string | undefined
  staffCount: number
  bedCount: number
  occupancyRate: number
  activeIncidents: number
  assetCount: number
}

export interface AssetHealthSummary {
  id: string
  assetTag: string
  name: string
  category: string
  department: string | undefined
  healthScore: number
  riskScore: number
  status: string
  nextMaintenanceAt: Date | undefined
  lastMaintenanceAt: Date | undefined
  assignedTo: string | undefined
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
  type: string
  title: string
  location: string
  reportedAt: Date
  status: string
  priority: string
  assignedTeam: string | undefined
}

export class HealthcareService {
  static async getDashboardMetrics(companyId: string): Promise<HealthcareDashboardMetrics> {
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const dueSoon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [patients, beds, assets, incidents, controls, shifts] = await Promise.all([
      prisma.hospitalPatient.findMany({
        where: { companyId },
        select: { status: true, admissionDate: true, dischargeDate: true, department: true },
      }),
      prisma.hospitalBed.findMany({
        where: { companyId },
        select: { status: true },
      }),
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

    const admittedPatients = patients.filter((p) => p.status === 'ADMITTED' || p.status === 'IN_TREATMENT')
    const dischargedInLast30d = patients.filter(
      (p) => p.dischargeDate && p.admissionDate && p.status === 'DISCHARGED'
    )
    const avgLengthOfStay = dischargedInLast30d.length
      ? dischargedInLast30d.reduce((sum, p) => {
          const days = (p.dischargeDate!.getTime() - p.admissionDate!.getTime()) / 86400000
          return sum + days
        }, 0) / dischargedInLast30d.length
      : 0

    const totalBeds = beds.length
    const occupiedBeds = beds.filter((b) => b.status === 'OCCUPIED').length
    const bedOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

    const onDutyStaff = shifts.reduce((sum, s) => sum + s.staffCount, 0)
    const onCallStaff = shifts.filter((s) => s.type === 'oncall').reduce((sum, s) => sum + s.staffCount, 0)
    const staffPatientRatio = admittedPatients.length > 0 && onDutyStaff > 0
      ? Math.round((onDutyStaff / admittedPatients.length) * 10) / 10
      : 0

    const openIncidents = incidents.filter((i) => !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(i.status))
    const respondedIncidents = incidents.filter((i) => i.firstRespondedAt)
    const avgResponseTime = respondedIncidents.length
      ? Math.round(respondedIncidents.reduce((sum, i) => {
          return sum + ((i.firstRespondedAt?.getTime() ?? i.createdAt.getTime()) - i.createdAt.getTime())
        }, 0) / respondedIncidents.length / 60000)
      : 0

    const compliantControls = controls.filter((c) => c.status === 'COMPLIANT').length

    return {
      totalPatients: patients.length,
      admittedPatients: admittedPatients.length,
      edVisits: incidents.filter(
        (i) => i.createdAt >= dayAgo && ['P1', 'P2', 'CRITICAL', 'HIGH'].includes(i.priority)
      ).length,
      bedOccupancy,
      avgLengthOfStay: Math.round(avgLengthOfStay * 10) / 10,
      onDutyStaff,
      onCallStaff,
      staffPatientRatio,
      activeAssets: assets.filter((a) => a.operationalStatus === 'OPERATIONAL').length,
      assetsInMaintenance: assets.filter((a) => a.operationalStatus === 'MAINTENANCE').length,
      criticalAssetsDown: assets.filter(
        (a) => a.operationalStatus === 'OUT_OF_SERVICE' || a.riskScore > 70
      ).length,
      assetUptime: assets.length
        ? Math.round((assets.filter((a) => a.operationalStatus === 'OPERATIONAL').length / assets.length) * 100)
        : 100,
      openIncidents: openIncidents.length,
      criticalIncidents: openIncidents.filter((i) => ['P1', 'CRITICAL'].includes(i.priority)).length,
      avgResponseTime,
      complianceScore: controls.length ? Math.round((compliantControls / controls.length) * 100) : 100,
      upcomingAudits: controls.filter(
        (c) => c.nextReviewAt && c.nextReviewAt <= dueSoon
      ).length,
      trainingCompliance: controls.length ? Math.round((compliantControls / controls.length) * 100) : 100,
    }
  }

  static async getPatientSummaries(companyId: string, limit = 50): Promise<PatientSummary[]> {
    const patients = await prisma.hospitalPatient.findMany({
      where: { companyId },
      include: { bed: { select: { bedNumber: true } } },
      orderBy: { admissionDate: 'desc' },
      take: limit,
    })

    return patients.map((p: any) => {
      const age = p.dateOfBirth
        ? Math.floor((Date.now() - p.dateOfBirth.getTime()) / 31557600000)
        : null
      return {
        id: p.id,
        patientNumber: p.patientNumber,
        name: `${p.firstName} ${p.lastName}`,
        age,
        gender: p.gender,
        admissionDate: p.admissionDate,
        dischargeDate: p.dischargeDate,
        department: p.department,
        status: p.status,
        primaryPhysician: p.primaryPhysician,
        insuranceProvider: p.insuranceProvider,
        bedNumber: p.bed?.bedNumber ?? null,
      }
    })
  }

  static async getPatientById(companyId: string, id: string): Promise<PatientSummary | null> {
    const p = await prisma.hospitalPatient.findFirst({
      where: { id, companyId },
      include: { bed: { select: { bedNumber: true } } },
    }) as any
    if (!p) return null
    const age = p.dateOfBirth
      ? Math.floor((Date.now() - p.dateOfBirth.getTime()) / 31557600000)
      : null
    return {
      id: p.id,
      patientNumber: p.patientNumber,
      name: `${p.firstName} ${p.lastName}`,
      age,
      gender: p.gender,
      admissionDate: p.admissionDate,
      dischargeDate: p.dischargeDate,
      department: p.department,
      status: p.status,
      primaryPhysician: p.primaryPhysician,
      insuranceProvider: p.insuranceProvider,
      bedNumber: p.bed?.bedNumber ?? null,
    }
  }

  static async createPatient(companyId: string, input: any) {
    if (!input.firstName?.trim()) throw badRequest('First name is required')
    if (!input.lastName?.trim()) throw badRequest('Last name is required')
    if (!input.patientNumber?.trim()) throw badRequest('Patient number (MRN) is required')

    const existing = await prisma.hospitalPatient.findFirst({
      where: { companyId, patientNumber: input.patientNumber.trim() },
    })
    if (existing) throw badRequest('Patient number already exists for this facility')

    return prisma.hospitalPatient.create({
      data: {
        companyId,
        patientNumber: input.patientNumber.trim(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        gender: input.gender ?? undefined,
        admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
        expectedDischarge: input.expectedDischarge ? new Date(input.expectedDischarge) : undefined,
        status: input.status ?? 'REGISTERED',
        department: input.department ?? undefined,
        bedId: input.bedId ?? undefined,
        primaryPhysician: input.primaryPhysician ?? undefined,
        admissionReason: input.admissionReason ?? undefined,
        diagnosisCode: input.diagnosisCode ?? undefined,
        insuranceProvider: input.insuranceProvider ?? undefined,
        insurancePolicyNo: input.insurancePolicyNo ?? undefined,
        contactPhone: input.contactPhone ?? undefined,
        contactName: input.contactName ?? undefined,
        notes: input.notes ?? undefined,
      },
    })
  }

  static async updatePatient(companyId: string, id: string, input: any) {
    const existing = await prisma.hospitalPatient.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Patient not found')

    const data: any = {}
    const strFields = ['firstName', 'lastName', 'patientNumber', 'gender', 'department', 'primaryPhysician',
      'admissionReason', 'diagnosisCode', 'insuranceProvider', 'insurancePolicyNo',
      'contactPhone', 'contactName', 'notes', 'status', 'bedId']
    for (const f of strFields) {
      if (input[f] !== undefined) data[f] = input[f] || null
    }
    const dateFields = ['dateOfBirth', 'admissionDate', 'dischargeDate', 'expectedDischarge']
    for (const f of dateFields) {
      if (input[f] !== undefined) data[f] = input[f] ? new Date(input[f]) : null
    }

    return prisma.hospitalPatient.update({ where: { id }, data })
  }

  static async dischargePatient(companyId: string, id: string) {
    const existing = await prisma.hospitalPatient.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Patient not found')
    return prisma.hospitalPatient.update({
      where: { id },
      data: { status: 'DISCHARGED', dischargeDate: new Date(), bedId: null },
    })
  }

  static async deletePatient(companyId: string, id: string) {
    const existing = await prisma.hospitalPatient.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Patient not found')
    await prisma.hospitalPatient.delete({ where: { id } })
    return { success: true }
  }

  // ── Bed Management ────────────────────────────────────────────────────────

  static async getBeds(companyId: string): Promise<BedSummary[]> {
    const beds = await prisma.hospitalBed.findMany({
      where: { companyId },
      include: {
        patients: {
          where: { status: { in: ['ADMITTED', 'IN_TREATMENT'] } },
          select: { firstName: true, lastName: true },
          take: 1,
        },
      },
      orderBy: [{ ward: 'asc' }, { bedNumber: 'asc' }],
    }) as any[]

    return beds.map((b) => ({
      id: b.id,
      bedNumber: b.bedNumber,
      ward: b.ward,
      department: b.department,
      type: b.type,
      status: b.status,
      patientName: b.patients[0] ? `${b.patients[0].firstName} ${b.patients[0].lastName}` : null,
    }))
  }

  static async createBed(companyId: string, input: any) {
    if (!input.bedNumber?.trim()) throw badRequest('Bed number is required')
    if (!input.ward?.trim()) throw badRequest('Ward is required')
    return prisma.hospitalBed.create({
      data: {
        companyId,
        bedNumber: input.bedNumber.trim(),
        ward: input.ward.trim(),
        department: input.department ?? undefined,
        floor: input.floor ?? undefined,
        roomNumber: input.roomNumber ?? undefined,
        type: input.type ?? 'GENERAL',
        status: input.status ?? 'AVAILABLE',
        notes: input.notes ?? undefined,
      },
    })
  }

  static async updateBed(companyId: string, id: string, input: any) {
    const existing = await prisma.hospitalBed.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Bed not found')
    const data: any = {}
    for (const f of ['bedNumber', 'ward', 'department', 'floor', 'roomNumber', 'type', 'status', 'notes']) {
      if (input[f] !== undefined) data[f] = input[f] || null
    }
    return prisma.hospitalBed.update({ where: { id }, data })
  }

  static async deleteBed(companyId: string, id: string) {
    const existing = await prisma.hospitalBed.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Bed not found')
    await prisma.hospitalBed.delete({ where: { id } })
    return { success: true }
  }

  // ── Inventory / Medical Supplies ─────────────────────────────────────────

  static async getInventoryAlerts(companyId: string): Promise<InventoryAlertSummary> {
    const now = new Date()
    const soonExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const supplies = await prisma.hospitalMedicalSupply.findMany({
      where: { companyId },
      select: { currentStock: true, minimumStock: true, isCritical: true, expiresAt: true },
    }) as any[]

    let lowStockItems = 0
    let expiredItems = 0
    let outOfStockItems = 0
    let criticalMedications = 0

    for (const s of supplies) {
      const stock = Number(s.currentStock)
      const min = Number(s.minimumStock)
      if (stock === 0) {
        outOfStockItems++
        if (s.isCritical) criticalMedications++
      } else if (stock <= min) {
        lowStockItems++
        if (s.isCritical) criticalMedications++
      }
      if (s.expiresAt && s.expiresAt <= now) expiredItems++
    }

    return { lowStockItems, expiredItems, outOfStockItems, criticalMedications }
  }

  static async getSupplies(companyId: string, category?: string): Promise<SupplySummary[]> {
    const now = new Date()
    const soonExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const supplies = await prisma.hospitalMedicalSupply.findMany({
      where: { companyId, ...(category ? { category } : {}) },
      orderBy: [{ isCritical: 'desc' }, { currentStock: 'asc' }],
    }) as any[]

    return supplies.map((s) => {
      const stock = Number(s.currentStock)
      const min = Number(s.minimumStock)
      let alertLevel: SupplySummary['alertLevel'] = 'ok'
      if (stock === 0) alertLevel = 'out'
      else if (stock <= min * 0.5) alertLevel = 'critical'
      else if (stock <= min) alertLevel = 'low'
      else if (s.expiresAt && s.expiresAt <= soonExpiry) alertLevel = 'expiring'

      return {
        id: s.id,
        name: s.name,
        category: s.category,
        unit: s.unit,
        currentStock: stock,
        minimumStock: min,
        reorderPoint: Number(s.reorderPoint),
        expiresAt: s.expiresAt,
        isCritical: s.isCritical,
        department: s.department,
        alertLevel,
      }
    })
  }

  static async createSupply(companyId: string, input: any) {
    if (!input.name?.trim()) throw badRequest('Supply name is required')
    if (!input.category?.trim()) throw badRequest('Category is required')
    return prisma.hospitalMedicalSupply.create({
      data: {
        companyId,
        name: input.name.trim(),
        sku: input.sku ?? undefined,
        category: input.category,
        unit: input.unit ?? 'units',
        currentStock: Number(input.currentStock ?? 0),
        minimumStock: Number(input.minimumStock ?? 0),
        reorderPoint: Number(input.reorderPoint ?? 0),
        maximumStock: input.maximumStock != null ? Number(input.maximumStock) : undefined,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        batchNumber: input.batchNumber ?? undefined,
        department: input.department ?? undefined,
        location: input.location ?? undefined,
        isCritical: Boolean(input.isCritical),
        supplierId: input.supplierId ?? undefined,
        unitCost: input.unitCost != null ? Number(input.unitCost) : undefined,
        notes: input.notes ?? undefined,
      },
    })
  }

  static async updateSupply(companyId: string, id: string, input: any) {
    const existing = await prisma.hospitalMedicalSupply.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Supply not found')

    const data: any = {}
    for (const f of ['name', 'sku', 'category', 'unit', 'batchNumber', 'department', 'location', 'supplierId', 'notes']) {
      if (input[f] !== undefined) data[f] = input[f] || null
    }
    for (const f of ['currentStock', 'minimumStock', 'reorderPoint', 'maximumStock', 'unitCost']) {
      if (input[f] !== undefined) data[f] = input[f] != null ? Number(input[f]) : null
    }
    if (input.isCritical !== undefined) data.isCritical = Boolean(input.isCritical)
    if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null
    if (input.lastRestockedAt !== undefined) data.lastRestockedAt = input.lastRestockedAt ? new Date(input.lastRestockedAt) : null

    return prisma.hospitalMedicalSupply.update({ where: { id }, data })
  }

  static async restockSupply(companyId: string, id: string, quantity: number) {
    if (!quantity || quantity <= 0) throw badRequest('Quantity must be positive')
    const existing = await prisma.hospitalMedicalSupply.findFirst({ where: { id, companyId } }) as any
    if (!existing) throw notFound('Supply not found')
    return prisma.hospitalMedicalSupply.update({
      where: { id },
      data: {
        currentStock: Number(existing.currentStock) + quantity,
        lastRestockedAt: new Date(),
      },
    })
  }

  static async deleteSupply(companyId: string, id: string) {
    const existing = await prisma.hospitalMedicalSupply.findFirst({ where: { id, companyId } })
    if (!existing) throw notFound('Supply not found')
    await prisma.hospitalMedicalSupply.delete({ where: { id } })
    return { success: true }
  }

  // ── Department Summaries ──────────────────────────────────────────────────

  static async getDepartmentSummaries(companyId: string): Promise<DepartmentSummary[]> {
    const [departments, beds, patients] = await Promise.all([
      prisma.enterpriseDepartment.findMany({
        where: { companyId },
        include: {
          _count: { select: { assets: true, incidents: true } },
          teams: { select: { _count: { select: { members: true } } } },
        },
      }) as any,
      prisma.hospitalBed.findMany({ where: { companyId }, select: { department: true, status: true } }),
      prisma.hospitalPatient.findMany({
        where: { companyId, status: { in: ['ADMITTED', 'IN_TREATMENT'] } },
        select: { department: true },
      }),
    ])

    return departments.map((dept: any) => {
      const deptBeds = beds.filter((b: any) => b.department === dept.name)
      const deptPatients = patients.filter((p: any) => p.department === dept.name)
      const occupiedBeds = deptBeds.filter((b: any) => b.status === 'OCCUPIED').length
      const bedCount = deptBeds.length
      const occupancyRate = bedCount > 0 ? Math.round((occupiedBeds / bedCount) * 100) : 0

      return {
        id: dept.id,
        code: dept.code,
        name: dept.name,
        type: dept.type,
        headOfDepartment: dept.managerId ?? undefined,
        staffCount: dept.teams.reduce((sum: number, t: any) => sum + t._count.members, 0),
        bedCount,
        occupancyRate,
        activeIncidents: dept._count.incidents,
        assetCount: dept._count.assets,
      }
    })
  }

  // ── Asset Health ──────────────────────────────────────────────────────────

  static async getAssetHealthSummaries(companyId: string, limit = 20): Promise<AssetHealthSummary[]> {
    const assets = await prisma.enterpriseAsset.findMany({
      where: { companyId },
      include: { category: true, department: true, assignedUser: true },
      orderBy: { healthScore: 'asc' },
      take: limit,
    }) as any[]

    return assets.map((a) => ({
      id: a.id,
      assetTag: a.assetTag,
      name: a.name,
      category: a.category.name,
      department: a.department?.name,
      healthScore: a.healthScore,
      riskScore: a.riskScore,
      status: a.operationalStatus,
      nextMaintenanceAt: a.nextMaintenanceAt ?? undefined,
      lastMaintenanceAt: a.lastMaintenanceAt ?? undefined,
      assignedTo: a.assignedUser?.name,
    }))
  }

  // ── Staff Shifts ──────────────────────────────────────────────────────────

  static async getStaffShiftSummaries(companyId: string): Promise<StaffShiftSummary[]> {
    try {
      const shifts = await prisma.enterpriseShift.findMany({
        where: { companyId },
        orderBy: { startsAt: 'asc' },
        take: 100,
      }) as any[]

      return shifts.map((s) => ({
        id: s.id,
        staffName: s.name,
        role: s.department || 'General',
        department: s.department || 'General',
        shiftStart: s.startsAt,
        shiftEnd: s.endsAt,
        status: (s.type === 'oncall' ? 'on-call' : 'on-duty') as any,
      }))
    } catch {
      return []
    }
  }

  static async listShifts(companyId: string) {
    const rows = await prisma.enterpriseShift.findMany({ where: { companyId }, orderBy: { startsAt: 'asc' } }) as any[]
    return rows.map((r) => ({
      id: r.id, name: r.name, department: r.department, startsAt: r.startsAt,
      endsAt: r.endsAt, type: r.type, staffCount: r.staffCount, coverage: r.coverage, metadata: r.metadata,
    }))
  }

  static async createShift(companyId: string, input: any) {
    if (!companyId) throw badRequest('Company is required')
    if (!String(input.name || '').trim()) throw badRequest('Shift name is required')
    const startsAt = new Date(input.startsAt)
    const endsAt = new Date(input.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw badRequest('Valid shift start and end times are required')
    if (endsAt.getTime() <= startsAt.getTime()) throw badRequest('Shift end time must be after start time')
    return prisma.enterpriseShift.create({
      data: { companyId, name: String(input.name).trim(), department: input.department || null, startsAt, endsAt, type: input.type || 'day', staffCount: Number(input.staffCount || 0), coverage: Number(input.coverage ?? 100), metadata: input.metadata || null },
    })
  }

  static async updateShift(companyId: string, id: string, input: any) {
    const existing = await prisma.enterpriseShift.findUnique({ where: { id } }) as any
    if (!existing || existing.companyId !== companyId) throw notFound('Shift not found')
    const data: any = {}
    for (const f of ['name', 'department', 'type']) { if (input[f] !== undefined) data[f] = input[f] }
    for (const f of ['staffCount', 'coverage']) { if (input[f] !== undefined) data[f] = Number(input[f]) }
    for (const f of ['startsAt', 'endsAt']) { if (input[f] !== undefined) data[f] = new Date(input[f]) }
    if (input.metadata !== undefined) data.metadata = input.metadata
    return prisma.enterpriseShift.update({ where: { id }, data })
  }

  static async deleteShift(companyId: string, id: string) {
    const existing = await prisma.enterpriseShift.findUnique({ where: { id } }) as any
    if (!existing || existing.companyId !== companyId) throw notFound('Shift not found')
    await prisma.enterpriseShift.delete({ where: { id } })
    return { success: true }
  }

  // ── Emergency Alerts ──────────────────────────────────────────────────────

  static async getActiveEmergencyAlerts(companyId: string): Promise<EmergencyAlert[]> {
    const incidents = await prisma.enterpriseIncident.findMany({
      where: { companyId, status: { in: ['REPORTED', 'INVESTIGATING', 'ESCALATED'] }, priority: { in: ['CRITICAL', 'HIGH'] } },
      include: { assignedTeam: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }) as any[]

    return incidents.map((i) => ({
      id: i.id,
      code: i.incidentNumber,
      type: i.type || 'general',
      title: i.title,
      location: i.location || 'Unknown',
      reportedAt: i.createdAt,
      status: i.status,
      priority: i.priority,
      assignedTeam: i.assignedTeam?.name,
    }))
  }

  // ── Compliance ────────────────────────────────────────────────────────────

  static async getComplianceOverview(companyId: string) {
    const controls = await prisma.enterpriseComplianceControl.findMany({ where: { companyId } }) as any[]
    return {
      totalControls: controls.length,
      compliantControls: controls.filter((c) => c.status === 'COMPLIANT').length,
      nonCompliantControls: controls.filter((c) => c.status === 'NON_COMPLIANT').length,
      pendingReviews: controls.filter((c) => c.status === 'PENDING_REVIEW').length,
      upcomingAudits: controls.filter((c) => {
        if (!c.nextReviewAt) return false
        const daysUntil = (new Date(c.nextReviewAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        return daysUntil <= 30 && daysUntil >= 0
      }).length,
    }
  }
}

export const healthcareService = HealthcareService
