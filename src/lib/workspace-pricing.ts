import { normalizeCompanyType, type CompanyType } from '@/lib/company-types'

export type WorkspaceBillingType = 'per-seat' | 'flat'
export type BillingCycle = 'monthly' | 'annual'

export type WorkspacePlan = {
  id: string
  name: string
  price: number
  unit: 'free' | 'seat/month' | 'month'
  seats?: number
  featured?: boolean
  features: string[]
  isolation: boolean
  isolationLocked?: boolean
  isolationDefault?: boolean
  isolationCost?: number
  isolationUnit?: 'seat' | 'month'
  isolationIncluded?: boolean
}

export type WorkspacePricing = {
  billing: WorkspaceBillingType
  trial: '14 days'
  hipaa?: boolean
  plans: WorkspacePlan[]
}

export type WorkspacePricingKey =
  | 'operations'
  | 'agency-studio'
  | 'content-studio'
  | 'hospital-operations'
  | 'enterprise-operations'
  | 'hospital-command'
  | 'it-operations'
  | 'erp'
  | 'ems'
  | 'standard'

export const COMPANY_TYPE_TO_PRICING_KEY: Record<CompanyType, WorkspacePricingKey> = {
  INDUSTRY: 'operations',
  DIGITAL_AGENCY: 'agency-studio',
  CONTENT_CREATION_AGENCY: 'content-studio',
  HEALTHCARE: 'hospital-operations',
  ENTERPRISE_OPERATIONS: 'enterprise-operations',
  CLINIC_HOSPITAL: 'hospital-command',
  CORPORATE_IT_OPERATIONS: 'it-operations',
  ERP_WORKSPACE: 'erp',
  EMS_AGENCY: 'ems',
  OTHER: 'standard',
}

export const WORKSPACE_PRICING: Record<WorkspacePricingKey, WorkspacePricing> = {
  operations: {
    billing: 'per-seat',
    trial: '14 days',
    plans: [
      { id: 'ops_starter', name: 'Starter', price: 0, unit: 'free', seats: 3, features: ['3 rooms', '5 projects', 'Basic tasks'], isolation: false, isolationLocked: true },
      { id: 'ops_growth', name: 'Growth', price: 9, unit: 'seat/month', features: ['Unlimited rooms', 'Unlimited projects', 'Task dependencies', 'File uploads', 'Basic analytics'], isolation: true, isolationCost: 2, isolationUnit: 'seat' },
      { id: 'ops_pro', name: 'Pro', price: 18, unit: 'seat/month', featured: true, features: ['Everything in Growth', 'Custom workflows', 'Advanced analytics', 'Priority support', 'API access'], isolation: true, isolationCost: 3, isolationUnit: 'seat' },
      { id: 'ops_enterprise', name: 'Enterprise', price: 35, unit: 'seat/month', features: ['Everything in Pro', 'SSO & SAML', 'Audit logs', 'Dedicated CSM', 'Custom SLA'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  'agency-studio': {
    billing: 'per-seat',
    trial: '14 days',
    plans: [
      { id: 'agency_starter', name: 'Starter', price: 0, unit: 'free', seats: 2, features: ['3 clients', '5 campaigns', 'Basic briefs'], isolation: false, isolationLocked: true },
      { id: 'agency_studio', name: 'Studio', price: 14, unit: 'seat/month', features: ['20 clients', 'Unlimited campaigns', 'File uploads 10GB', 'Approval flows'], isolation: true, isolationCost: 3, isolationUnit: 'seat' },
      { id: 'agency_pro', name: 'Pro', price: 28, unit: 'seat/month', featured: true, features: ['Unlimited clients', 'Unlimited uploads', 'Custom branding', 'Advanced approvals', 'Analytics'], isolation: true, isolationCost: 4, isolationUnit: 'seat' },
      { id: 'agency_plus', name: 'Agency+', price: 55, unit: 'seat/month', features: ['Everything in Pro', 'White-label portal', 'Client login access', 'Dedicated support', 'SSO'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  'content-studio': {
    billing: 'flat',
    trial: '14 days',
    plans: [
      { id: 'content_free', name: 'Free', price: 0, unit: 'free', features: ['1 channel', '3 campaigns', 'Basic stats'], isolation: false, isolationLocked: true },
      { id: 'content_creator', name: 'Creator', price: 29, unit: 'month', features: ['5 channels', 'Unlimited campaigns', 'Channel analytics', 'Release planner'], isolation: true, isolationCost: 3, isolationUnit: 'month' },
      { id: 'content_studio', name: 'Studio', price: 79, unit: 'month', featured: true, features: ['20 channels', 'Cross-channel stats', 'AI release timing', 'Deliverable tracker', 'Priority support'], isolation: true, isolationCost: 5, isolationUnit: 'month' },
      { id: 'content_label', name: 'Label', price: 199, unit: 'month', features: ['Unlimited channels', 'Full analytics suite', 'Custom integrations', 'Dedicated account mgr', 'Audit logs'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  'hospital-operations': {
    billing: 'flat',
    trial: '14 days',
    hipaa: true,
    plans: [
      { id: 'hospops_clinic', name: 'Clinic', price: 149, unit: 'month', features: ['1 department', 'Patient admissions', 'Basic asset tracking', 'Incident logging'], isolation: true, isolationDefault: true, isolationCost: 10, isolationUnit: 'month' },
      { id: 'hospops_network', name: 'Network', price: 399, unit: 'month', featured: true, features: ['10 departments', 'Full biomedical assets', 'Predictive maintenance', 'Compliance reports', 'Shift management'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
      { id: 'hospops_enterprise', name: 'Enterprise', price: 899, unit: 'month', features: ['Unlimited departments', 'Full clinical ops', 'HL7/FHIR integration', 'Executive dashboards', 'Dedicated support'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  'enterprise-operations': {
    billing: 'flat',
    trial: '14 days',
    plans: [
      { id: 'esm_team', name: 'Team', price: 99, unit: 'month', features: ['5 departments', 'Service queues', 'Basic SLAs', 'Asset tracking'], isolation: true, isolationCost: 5, isolationUnit: 'month' },
      { id: 'esm_business', name: 'Business', price: 249, unit: 'month', featured: true, features: ['20 departments', 'Advanced SLAs', 'Approval workflows', 'Analytics dashboard', 'Integrations'], isolation: true, isolationCost: 10, isolationUnit: 'month' },
      { id: 'esm_enterprise', name: 'Enterprise', price: 599, unit: 'month', features: ['Unlimited departments', 'CAB change management', 'Executive BI dashboard', 'Custom workflows', 'SSO & audit logs'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  'hospital-command': {
    billing: 'flat',
    trial: '14 days',
    hipaa: true,
    plans: [
      { id: 'hospcmd_clinic', name: 'Clinic', price: 199, unit: 'month', features: ['Patient admissions', 'QR asset tracking', 'Staff scheduling', 'Compliance checklists'], isolation: true, isolationDefault: true, isolationCost: 10, isolationUnit: 'month' },
      { id: 'hospcmd_hospital', name: 'Hospital', price: 499, unit: 'month', featured: true, features: ['Full clinical ops', 'Shift management', 'Medical device tracking', 'Incident response', 'Analytics'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
      { id: 'hospcmd_network', name: 'Network', price: 1199, unit: 'month', features: ['Multi-facility', 'Cross-facility analytics', 'HL7/FHIR integration', 'Dedicated CSM', 'Custom SLA'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  'it-operations': {
    billing: 'per-seat',
    trial: '14 days',
    plans: [
      { id: 'it_free', name: 'Free', price: 0, unit: 'free', seats: 3, features: ['1 queue', '10 assets', 'Basic incidents'], isolation: false, isolationLocked: true },
      { id: 'it_pro', name: 'Pro', price: 22, unit: 'seat/month', features: ['Unlimited queues', '500 assets', 'SLA enforcement', 'Change management', 'Integrations'], isolation: true, isolationCost: 4, isolationUnit: 'seat' },
      { id: 'it_business', name: 'Business', price: 45, unit: 'seat/month', featured: true, features: ['Unlimited assets', 'Advanced SLAs', 'Security incidents', 'Audit-ready logs', 'API access'], isolation: true, isolationCost: 6, isolationUnit: 'seat' },
      { id: 'it_enterprise', name: 'Enterprise', price: 89, unit: 'seat/month', features: ['Everything in Business', 'SSO & SAML', 'Executive dashboards', 'Dedicated support', 'Custom workflows'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  erp: {
    billing: 'flat',
    trial: '14 days',
    plans: [
      { id: 'erp_starter', name: 'Starter', price: 199, unit: 'month', features: ['GL & journal entries', 'AR/AP management', 'Basic inventory', '5 users'], isolation: true, isolationDefault: true, isolationCost: 10, isolationUnit: 'month' },
      { id: 'erp_business', name: 'Business', price: 499, unit: 'month', featured: true, features: ['Full ERP suite', 'Procurement module', 'HR & payroll', '20 users', 'Custom reports'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
      { id: 'erp_enterprise', name: 'Enterprise', price: 1199, unit: 'month', features: ['Unlimited users', 'Multi-entity accounting', 'Advanced compliance', 'Dedicated support', 'Custom integrations'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  ems: {
    billing: 'flat',
    trial: '14 days',
    plans: [
      { id: 'ems_agency', name: 'Agency', price: 299, unit: 'month', features: ['Dispatch management', 'Fleet tracking GPS', 'Incident logging', 'Hospital coordination', 'Mobile app'], isolation: true, isolationDefault: true, isolationCost: 10, isolationUnit: 'month' },
      { id: 'ems_network', name: 'Network', price: 699, unit: 'month', featured: true, features: ['Multi-agency', 'AI-assisted dispatch', 'Predictive analytics', 'Real-time dashboards', 'Priority support'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
      { id: 'ems_enterprise', name: 'Enterprise', price: 1499, unit: 'month', features: ['Unlimited agencies', 'Custom integrations', 'Executive command view', 'Dedicated support', 'Custom SLA'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
  standard: {
    billing: 'per-seat',
    trial: '14 days',
    plans: [
      { id: 'std_free', name: 'Free', price: 0, unit: 'free', seats: 5, features: ['3 projects', 'Basic tasks', 'File sharing'], isolation: false, isolationLocked: true },
      { id: 'std_plus', name: 'Plus', price: 7, unit: 'seat/month', features: ['Unlimited projects', 'Task dependencies', '10GB storage', 'Integrations'], isolation: true, isolationCost: 2, isolationUnit: 'seat' },
      { id: 'std_pro', name: 'Pro', price: 14, unit: 'seat/month', featured: true, features: ['Everything in Plus', 'Advanced analytics', 'Custom fields', 'Priority support', 'API access'], isolation: true, isolationCost: 3, isolationUnit: 'seat' },
      { id: 'std_business', name: 'Business', price: 25, unit: 'seat/month', features: ['Everything in Pro', 'SSO', 'Audit logs', 'Admin controls', 'Dedicated support'], isolation: true, isolationDefault: true, isolationCost: 0, isolationIncluded: true },
    ],
  },
}

export function getWorkspacePricingKey(companyType?: string | null): WorkspacePricingKey {
  return COMPANY_TYPE_TO_PRICING_KEY[normalizeCompanyType(companyType)]
}

export function getWorkspacePricing(companyType?: string | null) {
  const key = getWorkspacePricingKey(companyType)
  return { key, pricing: WORKSPACE_PRICING[key] }
}

export function getWorkspacePlan(companyType: string | null | undefined, planId: string | null | undefined) {
  const { pricing } = getWorkspacePricing(companyType)
  return pricing.plans.find((plan) => plan.id === planId) ?? null
}

export function getDefaultPlanForWorkspace(companyType?: string | null) {
  const { pricing } = getWorkspacePricing(companyType)
  return pricing.plans.find((plan) => plan.price === 0) ?? pricing.plans[0]
}

export function getDefaultIsolation(plan: WorkspacePlan) {
  if (plan.isolationLocked) return false
  return Boolean(plan.isolationDefault)
}

export function isFreePlan(plan: WorkspacePlan) {
  return plan.price === 0
}

export function clampSeatCount(pricing: WorkspacePricing, requested: number | null | undefined) {
  const seats = Number.isFinite(requested) ? Number(requested) : 1
  return pricing.billing === 'per-seat' ? Math.max(1, Math.floor(seats)) : 1
}

export function calculateWorkspacePlanTotal(input: {
  pricing: WorkspacePricing
  plan: WorkspacePlan
  billingCycle: BillingCycle
  seatCount: number
  isolationEnabled: boolean
}) {
  const quantity = input.pricing.billing === 'per-seat' ? clampSeatCount(input.pricing, input.seatCount) : 1
  const isolationEnabled = input.plan.isolationLocked ? false : input.isolationEnabled
  const baseMonthly = input.plan.price * quantity
  const isolationMonthly =
    isolationEnabled && !input.plan.isolationIncluded
      ? (input.plan.isolationCost ?? 0) * (input.pricing.billing === 'per-seat' ? quantity : 1)
      : 0
  const monthlyTotal = baseMonthly + isolationMonthly
  const checkoutTotal = input.billingCycle === 'annual' ? monthlyTotal * 12 * 0.8 : monthlyTotal

  return {
    baseMonthly,
    checkoutTotal,
    discountPercent: input.billingCycle === 'annual' ? 20 : 0,
    isolationMonthly,
    monthlyTotal,
    quantity,
  }
}

export function getIsolationType(isolationEnabled: boolean) {
  return isolationEnabled ? 'isolated' : 'shared'
}
