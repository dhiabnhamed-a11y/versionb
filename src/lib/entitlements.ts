import { prisma } from '@/lib/db'

export const WORKSPACE_FEATURES: Record<string, string[]> = {
  erp:              ['erp', 'accounting', 'payroll', 'procurement'],
  ems:              ['ems', 'dispatch', 'fleet_gps'],
  healthcare_ops:   ['healthcare', 'patient_management'],
  hospital_command: ['healthcare', 'patient_management', 'hospital_command'],
  enterprise_ops:   ['enterprise', 'sla_management', 'asset_lifecycle'],
  it_ops:           ['enterprise', 'service_desk'],
  agency_studio:    ['agency', 'client_portal', 'briefs'],
  content_studio:   ['social_analytics', 'content_planning'],
  standard:         ['projects', 'tasks', 'calendar'],
  operations:       ['projects', 'tasks', 'rooms'],
}

export const PREMIUM_FEATURES = new Set([
  'erp', 'accounting', 'payroll', 'procurement',
  'ems', 'dispatch', 'fleet_gps',
  'healthcare', 'patient_management', 'hospital_command',
  'enterprise', 'sla_management', 'asset_lifecycle',
  'service_desk',
  'ai_chat',
])

export const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/erp':         'erp',
  '/nexus-erp':   'erp',
  '/dashboard/accounting': 'accounting',
  '/dashboard/payroll':    'payroll',
  '/dashboard/healthcare': 'healthcare',
  '/dashboard/ems':        'ems',
  '/api/erp':     'erp',
  '/api/payroll': 'payroll',
  '/api/healthcare': 'healthcare',
  '/api/ems':     'ems',
  '/api/ai/chat': 'ai_chat',
}

export async function hasFeature(companyId: string, feature: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { planId: true, subscriptionStatus: true },
  })

  if (!company || company.subscriptionStatus !== 'ACTIVE') {
    return !PREMIUM_FEATURES.has(feature)
  }

  const workspaceId = company.planId ?? 'standard'
  const allowedFeatures = WORKSPACE_FEATURES[workspaceId] ?? []
  return allowedFeatures.includes(feature)
}
