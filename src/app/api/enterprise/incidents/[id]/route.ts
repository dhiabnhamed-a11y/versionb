import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'
import { notFound } from '@/modules/shared/errors'
import { updateIncident } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const { id } = await params
    const incident = await prisma.enterpriseIncident.findFirst({
      where: { id, companyId: user.companyId! },
      include: {
        department: { select: { id: true, name: true, code: true } },
        assignedTeam: { select: { id: true, name: true, code: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        reportedBy: { select: { id: true, name: true, email: true } },
        asset: { select: { id: true, name: true, assetTag: true, operationalStatus: true } },
        slaPolicy: { select: { id: true, name: true, responseMinutes: true, resolutionMinutes: true } },
        problem: { select: { id: true, title: true, status: true } },
        change: { select: { id: true, changeNumber: true, title: true, status: true } },
        notes: { where: { isPrivate: false }, orderBy: { createdAt: 'desc' }, take: 50 },
        timeEntries: { orderBy: { entryDate: 'desc' }, take: 50 },
        _count: { select: { maintenanceOrders: true, notes: true, timeEntries: true } },
      },
    })
    if (!incident) throw notFound('Incident not found')
    return apiData(incident)
  }, { auth: 'required', responseMode: 'canonical' })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user, requestId }) => {
      const { id } = await params
      const body = await parseJsonObject(req)
      return apiData(await updateIncident(user, id, body, requestId))
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
