export type BillingModel = 'per_seat' | 'per_workspace' | 'per_system'
export type BillingInterval = 'monthly' | 'annual' | 'lifetime'

export interface WorkspacePricing {
  id: string
  name: string
  category: string
  description: string
  billingModel: BillingModel
  includedSeats: number | 'unlimited'
  extraSeatMonthly?: number
  prices: {
    monthly: number
    annual: number
    lifetime: number
  }
  annualTotal: number
  features: string[]
  badge?: string
}

export type WorkspaceSelection = {
  workspaceId: string
  interval: BillingInterval
  quantity: number
}

export const WORKSPACES: WorkspacePricing[] = [
  {
    id: 'operations',
    name: 'Operations workspace',
    category: 'Manufacturing · Logistics · Retail',
    description: 'Separate work by room, project, and task.',
    billingModel: 'per_seat',
    includedSeats: 1,
    prices: { monthly: 9, annual: 7, lifetime: 149 },
    annualTotal: 84,
    features: ['Rooms, projects & tasks', 'Plants, sites & departments', 'Structured execution across work areas'],
  },
  {
    id: 'agency_studio',
    name: 'Agency studio',
    category: 'Creative agencies · Studios',
    description: 'Assign creative work and collect uploads in one place.',
    billingModel: 'per_seat',
    includedSeats: 1,
    prices: { monthly: 12, annual: 9, lifetime: 179 },
    annualTotal: 108,
    features: ['Campaigns, briefs & uploads', 'Client file collection', 'Brief-to-upload delivery'],
  },
  {
    id: 'content_studio',
    name: 'Content studio',
    category: 'Creators · Labels · Media',
    description: 'Plan content releases and track channel growth.',
    billingModel: 'per_seat',
    includedSeats: 1,
    prices: { monthly: 12, annual: 9, lifetime: 179 },
    annualTotal: 108,
    features: ['Channel stats & release planning', 'YouTube, Spotify & social', 'Audio/video deliverables'],
  },
  {
    id: 'standard',
    name: 'Standard workspace',
    category: 'General teams',
    description: 'The core TASKIT interface.',
    billingModel: 'per_seat',
    includedSeats: 1,
    prices: { monthly: 6, annual: 4, lifetime: 99 },
    annualTotal: 48,
    features: ['Core TASKIT flow', 'Projects & tasks', 'Free trial available'],
  },
  {
    id: 'healthcare_ops',
    name: 'Healthcare operations',
    category: 'Hospitals · Clinics',
    description: 'Enterprise healthcare operations and asset intelligence.',
    billingModel: 'per_workspace',
    includedSeats: 25,
    prices: { monthly: 149, annual: 119, lifetime: 1999 },
    annualTotal: 1428,
    features: ['Departments, assets & incidents', 'Patient admissions & care coordination', 'Biomedical asset lifecycle'],
  },
  {
    id: 'enterprise_ops',
    name: 'Enterprise operations',
    category: 'IT · HR · Facilities · Finance',
    description: 'Coordinate departments, service queues, and assets.',
    billingModel: 'per_workspace',
    includedSeats: 50,
    badge: 'Most popular',
    prices: { monthly: 199, annual: 159, lifetime: 2499 },
    annualTotal: 1908,
    features: ['Service queues & SLAs', 'Asset lifecycle governance', 'Approvals & analytics'],
  },
  {
    id: 'hospital_command',
    name: 'Hospital command center',
    category: 'Full hospital management',
    description: 'Complete hospital management and clinical operations.',
    billingModel: 'per_workspace',
    includedSeats: 50,
    prices: { monthly: 249, annual: 199, lifetime: 2999 },
    annualTotal: 2388,
    features: ['Clinical ops, devices & compliance', 'Staff scheduling & shift management', 'Medical asset tracking with QR codes'],
  },
  {
    id: 'it_ops',
    name: 'IT operations',
    category: 'Corporate IT · Service desk',
    description: 'Run IT service management, assets, and incidents.',
    billingModel: 'per_workspace',
    includedSeats: 25,
    prices: { monthly: 129, annual: 99, lifetime: 1599 },
    annualTotal: 1188,
    features: ['Service desk & tickets', 'Endpoints & infrastructure tracking', 'SLA health & change history'],
  },
  {
    id: 'erp',
    name: 'ERP workspace',
    category: 'Finance · HR · Procurement',
    description: 'Full ERP: GL, AR/AP, budgets, procurement, inventory, HR.',
    billingModel: 'per_system',
    includedSeats: 'unlimited',
    extraSeatMonthly: 8,
    prices: { monthly: 499, annual: 399, lifetime: 5999 },
    annualTotal: 4788,
    features: ['Full double-entry accounting', 'AR/AP & payroll modules', 'Procurement & inventory'],
  },
  {
    id: 'ems',
    name: 'EMS operations center',
    category: 'EMS · Fire · Emergency ops',
    description: 'Real-time dispatch, fleet tracking, and incident coordination.',
    billingModel: 'per_system',
    includedSeats: 'unlimited',
    extraSeatMonthly: 8,
    prices: { monthly: 599, annual: 479, lifetime: 6999 },
    annualTotal: 5748,
    features: ['Real-time dispatch & fleet GPS', 'AI-assisted dispatch', 'Offline-capable mobile responder app'],
  },
]

export const WORKSPACE_BY_ID = Object.fromEntries(WORKSPACES.map((workspace) => [workspace.id, workspace])) as Record<string, WorkspacePricing>

export function getWorkspaceById(workspaceId: string) {
  return WORKSPACE_BY_ID[workspaceId] ?? null
}

export function clampWorkspaceQuantity(workspace: WorkspacePricing, quantity: number) {
  const numericQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1
  if (workspace.billingModel !== 'per_seat') return 1
  return Math.min(500, Math.max(1, numericQuantity))
}

export function calculateWorkspacePrice(input: WorkspaceSelection) {
  const workspace = getWorkspaceById(input.workspaceId)
  if (!workspace) throw new Error('Invalid workspace.')

  const quantity = clampWorkspaceQuantity(workspace, input.quantity)
  const unitPrice = workspace.prices[input.interval]
  const billableQuantity = workspace.billingModel === 'per_seat' ? quantity : 1
  const intervalMultiplier = input.interval === 'annual' ? 12 : 1
  const extraSeatTotal =
    workspace.billingModel === 'per_system' && typeof workspace.includedSeats === 'number' && workspace.extraSeatMonthly
      ? Math.max(0, quantity - workspace.includedSeats) * workspace.extraSeatMonthly * intervalMultiplier
      : 0

  return {
    billableQuantity,
    displayQuantity: quantity,
    extraSeatTotal,
    interval: input.interval,
    total: unitPrice * billableQuantity * intervalMultiplier + extraSeatTotal,
    unitPrice,
    workspace,
  }
}

export function getAnnualSavings(workspace: WorkspacePricing, quantity: number) {
  const monthly = calculateWorkspacePrice({ workspaceId: workspace.id, interval: 'monthly', quantity }).total * 12
  const annual = calculateWorkspacePrice({ workspaceId: workspace.id, interval: 'annual', quantity }).total
  return Math.max(0, monthly - annual)
}

export function getDodoProductId(workspaceId: string, interval: BillingInterval) {
  const envKey = `DODO_PRODUCT_${workspaceId}_${interval}`.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  return process.env[envKey] ?? `taskit_${workspaceId}_${interval}`
}

export function formatUsd(amount: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(amount)
}

export function formatWorkspacePrice(workspace: WorkspacePricing, interval: BillingInterval, quantity = 1) {
  const price = calculateWorkspacePrice({ workspaceId: workspace.id, interval, quantity })
  if (interval === 'annual') {
    return {
      detail: `billed ${formatUsd(price.total)}/yr`,
      primary: `${formatUsd(price.unitPrice)}/mo`,
      total: price.total,
    }
  }
  if (interval === 'lifetime') {
    return { detail: 'one-time', primary: `${formatUsd(price.total)} one-time`, total: price.total }
  }
  return {
    detail: workspace.billingModel === 'per_seat' ? `Total: ${formatUsd(price.total)}/mo` : 'per month',
    primary: `${formatUsd(price.unitPrice)}/mo`,
    total: price.total,
  }
}
