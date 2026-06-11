import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'
import { notFound } from '@/modules/shared/errors'
import { updateMaintenanceWorkOrder } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const { id } = await params as { id: string }
    const order = await prisma.enterpriseMaintenanceWorkOrder.findFirst({
      where: { id, companyId: user.companyId! },
      include: {
        asset: { select: { id: true, name: true, assetTag: true, healthScore: true, riskScore: true } },
        department: { select: { id: true, name: true, code: true } },
        assignedTeam: { select: { id: true, name: true, code: true } },
        assignedTechnician: { select: { id: true, name: true, email: true } },
        incident: { select: { id: true, incidentNumber: true, title: true } },
        plan: { select: { id: true, name: true, type: true } },
      },
    })
    if (!order) throw notFound('Maintenance work order not found')
    return apiData(order)
  }, { auth: 'required', responseMode: 'canonical' })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user, requestId }) => {
      const { id } = await params as { id: string }
      const body = await parseJsonObject(req)
      return apiData(await updateMaintenanceWorkOrder(user, id, body, requestId))
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
