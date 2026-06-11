import type { NextRequest } from 'next/server'
import { apiData as _apiData, handleApiRoute } from '@/lib/api'
import { prisma } from '@/lib/db'
import { EmsService } from '@/modules/ems/ems.service'
import { EmsAiService } from '@/modules/ems/ai/ems-ai-agent'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

function apiData(data: any, opts?: any) {
  return _apiData(data, opts)
}

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(req, undefined, async ({ user }: any) => {
const companyId = user.companyId || ''
await EmsService.getOrCreateEmsCompany(companyId)
const { searchParams } = new URL(req.url)
const section = searchParams.get('section') || 'overview'

if (section === 'overview') {
  const metrics = await EmsService.getDashboardMetrics(companyId)
  const recentIncidents = await prisma.emsIncident.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { severity: true, status: true, createdAt: true, patientCount: true },
  })
  const avgResponseTime = await prisma.emsDispatchLog.aggregate({
    where: { incident: { companyId } },
    _avg: { responseTime: true },
  })
  return apiData({ ...metrics, avgResponseTime: avgResponseTime._avg.responseTime, recentIncidents })
}

if (section === 'demand') {
  const zones = await EmsAiService.predictDemandZones(companyId)
  return apiData(zones)
}

if (section === 'timeline') {
  const days = parseInt(searchParams.get('days') || '7')
  const since = new Date(Date.now() - days * 86400000)
  const incidents = await prisma.emsIncident.findMany({
    where: { companyId, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, severity: true, status: true },
  })
  const byDay: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}
  for (const inc of incidents) {
    const day = inc.createdAt.toISOString().slice(0, 10)
    byDay[day] = (byDay[day] || 0) + 1
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1
  }
  return apiData({ byDay, bySeverity, total: incidents.length })
}

return apiData({ message: 'Unknown section' }, { status: 400 })
}, { auth: 'required', responseMode: 'legacy', route: '/api/ems/analytics' })
}, { auth: 'required' });
