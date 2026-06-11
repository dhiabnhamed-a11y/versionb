import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { HealthcareService } from '@/modules/healthcare/healthcare.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const [metrics, alerts, compliance] = await Promise.all([
      HealthcareService.getDashboardMetrics(user.companyId!),
      HealthcareService.getInventoryAlerts(user.companyId!),
      HealthcareService.getComplianceOverview(user.companyId!),
    ])
    return apiData({ metrics, inventoryAlerts: alerts, compliance })
  }, { auth: 'required', requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'], responseMode: 'legacy', route: '/api/healthcare/metrics' })
}
