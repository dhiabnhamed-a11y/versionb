import type { CompanyType } from '@/lib/company-types'

export type OnboardingTemplateId =
  | 'AGENCY'
  | 'HEALTHCARE'
  | 'CLINIC_HOSPITAL'
  | 'ENTERPRISE'
  | 'IT_OPERATIONS'
  | 'ERP'
  | 'LEGAL'
  | 'CONSTRUCTION'
  | 'FINANCE'
  | 'EDUCATION'
  | 'OTHER'

export type OnboardingStepId = 'welcome' | 'company-type' | 'generating' | 'setup' | 'plan' | 'team' | 'success'

export type WorkspacePreviewModule = {
  label: string
  value: string
  detail: string
}

export type OnboardingTemplate = {
  id: OnboardingTemplateId
  title: string
  sentence: string
  icon: string
  companyType: CompanyType
  accent: string
  softAccent: string
  industryDefault: string
  departments: readonly string[]
  workflows: readonly string[]
  assets: readonly string[]
  dashboards: readonly string[]
  copilots: readonly string[]
  automations: readonly string[]
  finance: readonly string[]
  suggestions: readonly string[]
  whyItMatters: string
}

export type GenerationLog = {
  label: string
  detail: string
  artifact: string
}

export const ONBOARDING_STEPS: { id: OnboardingStepId; label: string }[] = [
  { id: 'welcome', label: 'Start' },
  { id: 'company-type', label: 'Fit' },
  { id: 'generating', label: 'Generate' },
  { id: 'setup', label: 'Setup' },
  { id: 'team', label: 'Team' },
  { id: 'plan', label: 'Plan' },
  { id: 'success', label: 'Ready' },
]

export const ONBOARDING_TEMPLATES: Record<OnboardingTemplateId, OnboardingTemplate> = {
  AGENCY: {
    id: 'AGENCY',
    title: 'Agency',
    sentence: 'Clients, campaigns, content pipelines, approvals, invoices, and creative uploads.',
    icon: 'briefcase',
    companyType: 'DIGITAL_AGENCY',
    accent: '#22d3ee',
    softAccent: 'rgba(34, 211, 238, 0.14)',
    industryDefault: 'Agency operations',
    departments: ['Client Services', 'Creative Studio', 'Media Buying', 'Finance Ops'],
    workflows: ['Client intake', 'Campaign production', 'Creative approval', 'Invoice review'],
    assets: ['Brand kits', 'Final uploads', 'Brief library', 'Contract files'],
    dashboards: ['Client health', 'Campaign margin', 'Delivery velocity'],
    copilots: ['Creative producer', 'Account strategist', 'Finance analyst'],
    automations: ['Brief routing', 'Approval reminders', 'Invoice follow-up'],
    finance: ['Client retainers', 'Campaign budgets', 'Invoice queue'],
    suggestions: ['Start with 3 active clients', 'Invite your account lead first', 'Connect finance after approval'],
    whyItMatters: 'TASKIT can turn agency chaos into a visible operating rhythm before your first campaign moves.',
  },
  HEALTHCARE: {
    id: 'HEALTHCARE',
    title: 'Healthcare',
    sentence: 'Medical assets, departments, compliance workflows, maintenance tickets, and approvals.',
    icon: 'heartPulse',
    companyType: 'HEALTHCARE',
    accent: '#34d399',
    softAccent: 'rgba(52, 211, 153, 0.14)',
    industryDefault: 'Healthcare operations',
    departments: ['Medical Operations', 'Biomedical', 'Compliance', 'Facilities'],
    workflows: ['Incident triage', 'Asset maintenance', 'Audit evidence', 'Purchase approval'],
    assets: ['Biomedical devices', 'Facility assets', 'Compliance controls', 'Maintenance plans'],
    dashboards: ['SLA health', 'Device uptime', 'Compliance readiness'],
    copilots: ['Biomedical copilot', 'Compliance analyst', 'Operations dispatcher'],
    automations: ['Critical escalation', 'Maintenance cadence', 'Audit reminders'],
    finance: ['Vendor spend', 'Procurement approvals', 'Maintenance budget'],
    suggestions: ['Seed biomedical categories', 'Create nursing and facilities queues', 'Use compliance controls from day one'],
    whyItMatters: 'Clinical operations need confidence fast; TASKIT starts with the structure care teams expect.',
  },
  CLINIC_HOSPITAL: {
    id: 'CLINIC_HOSPITAL',
    title: 'Clinic/Hospital',
    sentence: 'Clinical departments, biomedical inventory, shifts, facilities, and audit-ready work orders.',
    icon: 'hospital',
    companyType: 'CLINIC_HOSPITAL',
    accent: '#2dd4bf',
    softAccent: 'rgba(45, 212, 191, 0.14)',
    industryDefault: 'Hospital operations',
    departments: ['Nursing', 'Laboratory', 'Biomedical', 'Administration'],
    workflows: ['Work orders', 'Device downtime', 'Shift requests', 'Compliance review'],
    assets: ['Infusion pumps', 'Imaging devices', 'Lab equipment', 'Facility rooms'],
    dashboards: ['Critical tickets', 'Device availability', 'Department load'],
    copilots: ['Hospital ops copilot', 'Biomedical planner', 'Compliance reviewer'],
    automations: ['Urgent escalation', 'Preventive maintenance', 'Evidence capture'],
    finance: ['Procurement queue', 'Vendor contracts', 'Department budgets'],
    suggestions: ['Create high-risk equipment categories', 'Invite biomedical lead', 'Start with facilities requests'],
    whyItMatters: 'The workspace mirrors hospital reality: departments, devices, requests, and accountability.',
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    title: 'Enterprise',
    sentence: 'Departments, permissions, service queues, approvals, finance controls, and executive dashboards.',
    icon: 'building',
    companyType: 'ENTERPRISE_OPERATIONS',
    accent: '#a78bfa',
    softAccent: 'rgba(167, 139, 250, 0.14)',
    industryDefault: 'Enterprise operations',
    departments: ['IT', 'HR', 'Finance', 'Facilities', 'Procurement'],
    workflows: ['Service request', 'Access approval', 'Vendor onboarding', 'SLA escalation'],
    assets: ['Enterprise assets', 'Policies', 'Contracts', 'Knowledge base'],
    dashboards: ['Executive health', 'SLA exposure', 'Team capacity'],
    copilots: ['Operations chief', 'Policy copilot', 'Finance controller'],
    automations: ['Permission templates', 'SLA routing', 'Approval chains'],
    finance: ['Budget controls', 'Expense approvals', 'Forecasting'],
    suggestions: ['Start with shared services', 'Add approval owners', 'Invite leaders after departments are ready'],
    whyItMatters: 'Enterprise teams need governance without slowing down; TASKIT creates the operating backbone first.',
  },
  IT_OPERATIONS: {
    id: 'IT_OPERATIONS',
    title: 'IT Operations',
    sentence: 'Service desk queues, endpoint assets, incidents, changes, SLAs, and realtime collaboration.',
    icon: 'server',
    companyType: 'CORPORATE_IT_OPERATIONS',
    accent: '#60a5fa',
    softAccent: 'rgba(96, 165, 250, 0.14)',
    industryDefault: 'IT operations',
    departments: ['Service Desk', 'Infrastructure', 'Security', 'Procurement'],
    workflows: ['Ticket triage', 'Incident response', 'Change request', 'Asset lifecycle'],
    assets: ['Endpoints', 'Servers', 'Network devices', 'Licenses'],
    dashboards: ['Queue health', 'Uptime risk', 'SLA breach forecast'],
    copilots: ['Incident commander', 'Asset analyst', 'Security reviewer'],
    automations: ['Priority routing', 'SLA timers', 'Change approval'],
    finance: ['License spend', 'Hardware budgets', 'Vendor renewals'],
    suggestions: ['Import endpoint categories', 'Create priority matrix', 'Invite the service desk lead'],
    whyItMatters: 'IT gets immediate operational clarity: queues, assets, escalations, and service health.',
  },
  LEGAL: {
    id: 'LEGAL',
    title: 'Legal',
    sentence: 'Matters, contracts, approvals, deadlines, evidence, and controlled collaboration.',
    icon: 'scale',
    companyType: 'INDUSTRY',
    accent: '#f59e0b',
    softAccent: 'rgba(245, 158, 11, 0.14)',
    industryDefault: 'Legal operations',
    departments: ['Legal Ops', 'Contracts', 'Compliance', 'Finance Review'],
    workflows: ['Matter intake', 'Contract review', 'Approval routing', 'Deadline tracking'],
    assets: ['Contract library', 'Evidence files', 'Clause bank', 'Policy register'],
    dashboards: ['Matter status', 'Approval risk', 'Contract velocity'],
    copilots: ['Matter assistant', 'Contract reviewer', 'Compliance copilot'],
    automations: ['Deadline reminders', 'Review routing', 'Evidence requests'],
    finance: ['Matter budgets', 'Vendor counsel spend', 'Approval controls'],
    suggestions: ['Create matter categories', 'Invite contract owner', 'Add compliance deadlines'],
    whyItMatters: 'Legal teams move faster when every matter has ownership, deadlines, and evidence in one place.',
  },
  CONSTRUCTION: {
    id: 'CONSTRUCTION',
    title: 'Construction',
    sentence: 'Sites, crews, punch lists, equipment, approvals, materials, and project cost visibility.',
    icon: 'hardHat',
    companyType: 'INDUSTRY',
    accent: '#fb7185',
    softAccent: 'rgba(251, 113, 133, 0.14)',
    industryDefault: 'Construction operations',
    departments: ['Site Operations', 'Procurement', 'Safety', 'Finance'],
    workflows: ['Site request', 'Punch list', 'Safety incident', 'Material approval'],
    assets: ['Heavy equipment', 'Site documents', 'Supplier files', 'Inspection records'],
    dashboards: ['Site progress', 'Safety exposure', 'Cost variance'],
    copilots: ['Site coordinator', 'Safety copilot', 'Procurement analyst'],
    automations: ['Inspection cadence', 'Issue escalation', 'Material approvals'],
    finance: ['Project budgets', 'Supplier invoices', 'Cost tracking'],
    suggestions: ['Start with active sites', 'Invite project managers', 'Add equipment categories'],
    whyItMatters: 'TASKIT makes site execution visible across work orders, assets, safety, and finance.',
  },
  FINANCE: {
    id: 'FINANCE',
    title: 'Finance',
    sentence: 'Approvals, budgets, cash visibility, expenses, forecasting, audit trails, and CFO copilots.',
    icon: 'landmark',
    companyType: 'ENTERPRISE_OPERATIONS',
    accent: '#86efac',
    softAccent: 'rgba(134, 239, 172, 0.14)',
    industryDefault: 'Finance operations',
    departments: ['Accounting', 'Treasury', 'FP&A', 'Procurement'],
    workflows: ['Expense approval', 'Period close', 'Budget request', 'Cash forecast'],
    assets: ['Chart of accounts', 'Vendor files', 'Audit evidence', 'Forecast models'],
    dashboards: ['Cash runway', 'Budget variance', 'Close readiness'],
    copilots: ['CFO copilot', 'Audit analyst', 'Forecasting agent'],
    automations: ['Approval rules', 'Close checklist', 'Variance alerts'],
    finance: ['Treasury', 'Payroll', 'Budgeting', 'Forecasting'],
    suggestions: ['Create approval thresholds', 'Invite finance controller', 'Start with expense policies'],
    whyItMatters: 'Finance activation is about trust: controls, evidence, approvals, and forecasts from the start.',
  },
  EDUCATION: {
    id: 'EDUCATION',
    title: 'Education',
    sentence: 'Departments, programs, requests, facilities, assets, approvals, and student-service operations.',
    icon: 'graduationCap',
    companyType: 'INDUSTRY',
    accent: '#38bdf8',
    softAccent: 'rgba(56, 189, 248, 0.14)',
    industryDefault: 'Education operations',
    departments: ['Administration', 'Student Services', 'Facilities', 'Finance'],
    workflows: ['Program request', 'Facility ticket', 'Approval routing', 'Asset checkout'],
    assets: ['Classrooms', 'Equipment', 'Policy docs', 'Program files'],
    dashboards: ['Request volume', 'Facility health', 'Program status'],
    copilots: ['Campus ops copilot', 'Policy assistant', 'Facilities planner'],
    automations: ['Request routing', 'Approval nudges', 'Asset reminders'],
    finance: ['Program budgets', 'Vendor approvals', 'Procurement'],
    suggestions: ['Create campus departments', 'Invite operations lead', 'Add facilities queue'],
    whyItMatters: 'Education teams need operational calm across departments, facilities, programs, and approvals.',
  },
  ERP: {
    id: 'ERP',
    title: 'ERP',
    sentence: 'Full financial management, procurement, inventory, HR, and payroll with dedicated accounting modules.',
    icon: 'database',
    companyType: 'ERP_WORKSPACE',
    accent: '#f59e0b',
    softAccent: 'rgba(245, 158, 11, 0.14)',
    industryDefault: 'ERP operations',
    departments: ['Accounting', 'Procurement', 'HR', 'Inventory'],
    workflows: ['Journal entry', 'Purchase order', 'Payroll run', 'Period close'],
    assets: ['Chart of accounts', 'Vendor files', 'Tax rates', 'Compliance docs'],
    dashboards: ['Command center', 'Cash flow', 'Budget variance'],
    copilots: ['Accounting copilot', 'Procurement analyst', 'HR assistant'],
    automations: ['Anomaly scan', 'Budget alerts', 'Payroll reminders'],
    finance: ['General ledger', 'AR/AP', 'Treasury', 'Payroll'],
    suggestions: ['Start with chart of accounts', 'Connect vendors', 'Invite finance lead'],
    whyItMatters: 'ERP Workspace gives you full control over financials, procurement, inventory, and people — all in one platform.',
  },
  OTHER: {
    id: 'OTHER',
    title: 'Other',
    sentence: 'A flexible AI-generated operating system for projects, tasks, finance, assets, and teams.',
    icon: 'sparkles',
    companyType: 'OTHER',
    accent: '#f472b6',
    softAccent: 'rgba(244, 114, 182, 0.14)',
    industryDefault: 'Business operations',
    departments: ['Operations', 'Finance', 'People', 'Delivery'],
    workflows: ['Task intake', 'Approval routing', 'Team planning', 'Weekly review'],
    assets: ['Projects', 'Files', 'Knowledge base', 'Operating docs'],
    dashboards: ['Team focus', 'Delivery risk', 'Workspace health'],
    copilots: ['Operations copilot', 'Planning assistant', 'Finance helper'],
    automations: ['Smart routing', 'Status summaries', 'Reminder loops'],
    finance: ['Budgets', 'Invoices', 'Expenses'],
    suggestions: ['Start flexible', 'Invite one operator', 'Add structure as your team grows'],
    whyItMatters: 'TASKIT can start general and become specialized as it learns how your company works.',
  },
}

export const TEMPLATE_ORDER: OnboardingTemplateId[] = [
  'AGENCY',
  'HEALTHCARE',
  'CLINIC_HOSPITAL',
  'ENTERPRISE',
  'IT_OPERATIONS',
  'ERP',
  'LEGAL',
  'CONSTRUCTION',
  'FINANCE',
  'EDUCATION',
  'OTHER',
]

export function getTemplateForCompanyType(companyType: CompanyType): OnboardingTemplateId {
  switch (companyType) {
    case 'DIGITAL_AGENCY':
    case 'CONTENT_CREATION_AGENCY':
      return 'AGENCY'
    case 'HEALTHCARE':
      return 'HEALTHCARE'
    case 'CLINIC_HOSPITAL':
      return 'CLINIC_HOSPITAL'
    case 'ENTERPRISE_OPERATIONS':
      return 'ENTERPRISE'
    case 'ERP_WORKSPACE':
      return 'ERP'
    case 'CORPORATE_IT_OPERATIONS':
      return 'IT_OPERATIONS'
    case 'INDUSTRY':
      return 'CONSTRUCTION'
    case 'OTHER':
    default:
      return 'OTHER'
  }
}

export function getTemplate(id: OnboardingTemplateId) {
  return ONBOARDING_TEMPLATES[id] ?? ONBOARDING_TEMPLATES.OTHER
}

export function createWorkspaceModules(template: OnboardingTemplate): WorkspacePreviewModule[] {
  return [
    { label: 'Departments', value: String(template.departments.length), detail: template.departments.slice(0, 3).join(', ') },
    { label: 'Workflows', value: String(template.workflows.length), detail: template.workflows.slice(0, 3).join(', ') },
    { label: 'AI copilots', value: String(template.copilots.length), detail: template.copilots.slice(0, 2).join(', ') },
    { label: 'Dashboards', value: String(template.dashboards.length), detail: template.dashboards.slice(0, 2).join(', ') },
  ]
}

export function createGenerationPlan(template: OnboardingTemplate): GenerationLog[] {
  return [
    {
      label: 'Understanding company model',
      detail: `TASKIT selected the ${template.title.toLowerCase()} operating blueprint.`,
      artifact: 'Template intelligence',
    },
    {
      label: 'Creating departments',
      detail: template.departments.join(' + '),
      artifact: `${template.departments.length} departments`,
    },
    {
      label: 'Generating workflows',
      detail: template.workflows.join(' + '),
      artifact: `${template.workflows.length} workflows`,
    },
    {
      label: 'Structuring assets',
      detail: template.assets.join(' + '),
      artifact: `${template.assets.length} asset groups`,
    },
    {
      label: 'Configuring permissions',
      detail: 'Owner, manager, member, finance, and department-level defaults.',
      artifact: 'Access model',
    },
    {
      label: 'Preparing dashboards',
      detail: template.dashboards.join(' + '),
      artifact: `${template.dashboards.length} dashboards`,
    },
    {
      label: 'Installing AI copilots',
      detail: template.copilots.join(' + '),
      artifact: `${template.copilots.length} copilots`,
    },
    {
      label: 'Activating automations',
      detail: template.automations.join(' + '),
      artifact: `${template.automations.length} automations`,
    },
    {
      label: 'Syncing realtime collaboration',
      detail: 'Presence, activity, notifications, approvals, and live workspace updates.',
      artifact: 'Realtime layer',
    },
  ]
}

export function persistOnboardingProgress(value: unknown) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('taskit:onboarding:v2', JSON.stringify(value))
}

export function readOnboardingProgress<T>() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem('taskit:onboarding:v2')
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function trackOnboardingEvent(name: string, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return

  const event = {
    name,
    payload,
    at: new Date().toISOString(),
  }

  try {
    const raw = window.localStorage.getItem('taskit:onboarding:analytics')
    const events = raw ? (JSON.parse(raw) as typeof event[]) : []
    window.localStorage.setItem('taskit:onboarding:analytics', JSON.stringify([...events.slice(-39), event]))
  } catch {
    window.localStorage.setItem('taskit:onboarding:analytics', JSON.stringify([event]))
  }
}
