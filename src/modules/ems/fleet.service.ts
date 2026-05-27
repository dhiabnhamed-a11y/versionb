// @ts-nocheck — depends on prisma generate for Ems* models
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/db'
import { badRequest, notFound } from '@/modules/shared/errors'
import { emitEmsEvent } from './ems-realtime'
import { DispatchEngine } from './dispatch-engine'

export class FleetService {
  static async registerUnit(
    companyId: string,
    input: {
      unitNumber: string
      type: string
      stationId?: string
      crewCapacity?: number
      patientCapacity?: number
      equipment?: Record<string, any>
      capabilities?: string[]
    }
  ) {
    const existing = await prisma.emsUnit.findFirst({
      where: { companyId, unitNumber: input.unitNumber },
    })
    if (existing) throw badRequest(`Unit ${input.unitNumber} already exists`)

    return prisma.emsUnit.create({
      data: {
        companyId,
        unitNumber: input.unitNumber,
        type: input.type as any,
        stationId: input.stationId,
        crewCapacity: input.crewCapacity || 2,
        patientCapacity: input.patientCapacity || 1,
        equipment: input.equipment || {},
        capabilities: input.capabilities || [],
        status: 'AVAILABLE',
      },
    })
  }

  static async updateUnitStatus(companyId: string, unitId: string, status: string, reason?: string) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')

    const previousStatus = unit.status
    const updateData: any = { status }

    if (status === 'AVAILABLE') {
      updateData.currentIncidentId = null
    }

    const updated = await prisma.emsUnit.update({
      where: { id: unitId },
      data: updateData,
    })

    await emitEmsEvent(companyId, 'ems:unit:status', {
      unitId,
      unitNumber: unit.unitNumber,
      previousStatus,
      newStatus: status,
      reason,
    })

    return updated
  }

  static async getNearestUnits(
    companyId: string,
    lat: number,
    lng: number,
    radiusKm = 20,
    limit = 5
  ) {
    const units = await prisma.emsUnit.findMany({
      where: {
        companyId,
        status: 'AVAILABLE',
        isOnline: true,
        lat: { not: null },
        lng: { not: null },
      },
    })

    const withDistance = units.map((u) => ({
      ...u,
      distanceKm: DispatchEngine.haversineDistance(lat, lng, u.lat!, u.lng!),
    }))

    return withDistance
      .filter((u) => u.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
  }

  static async recordMaintenance(
    companyId: string,
    unitId: string,
    input: { type: string; description: string; notes?: string }
  ) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')

    const [log] = await prisma.$transaction([
      prisma.emsUnitMaintenance.create({
        data: { unitId, type: input.type, description: input.description, notes: input.notes, status: 'pending' },
      }),
      prisma.emsUnit.update({
        where: { id: unitId },
        data: { status: 'MAINTENANCE' },
      }),
    ])

    return log
  }

  static async getUnitMaintenanceHistory(companyId: string, unitId: string) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')
    return prisma.emsUnitMaintenance.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getUnitLocationHistory(companyId: string, unitId: string, since: Date = new Date(Date.now() - 86400000)) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')
    return prisma.emsUnitLocation.findMany({
      where: { unitId, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
    })
  }

  static async updateUnitSupplies(
    companyId: string,
    unitId: string,
    supplies: Array<{ itemName: string; category: string; quantity: number; expiryDate?: string }>
  ) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')

    const results = []
    for (const s of supplies) {
      const existing = await prisma.emsSupplyStock.findFirst({
        where: { unitId, itemName: s.itemName },
      })
      if (existing) {
        results.push(
          await prisma.emsSupplyStock.update({
            where: { id: existing.id },
            data: { quantity: s.quantity, expiryDate: s.expiryDate ? new Date(s.expiryDate) : undefined },
          })
        )
      } else {
        results.push(
          await prisma.emsSupplyStock.create({
            data: {
              companyId,
              unitId,
              itemName: s.itemName,
              category: s.category,
              quantity: s.quantity,
              expiryDate: s.expiryDate ? new Date(s.expiryDate) : undefined,
            },
          })
        )
      }
    }
    return results
  }

  static async getUnitSupplies(companyId: string, unitId: string) {
    const unit = await prisma.emsUnit.findFirst({ where: { id: unitId, companyId } })
    if (!unit) throw notFound('Unit not found')
    return prisma.emsSupplyStock.findMany({ where: { unitId } })
  }

  static async getLowSupplyAlerts(companyId: string) {
    return prisma.emsSupplyStock.findMany({
      where: { companyId, quantity: { lte: prisma.emsSupplyStock.fields.minQuantity } },
      include: { unit: { select: { unitNumber: true } } },
    })
  }
}
