export const COMPANY_TYPE_VALUES = [
  'INDUSTRY',
  'DIGITAL_AGENCY',
  'CONTENT_CREATION_AGENCY',
  'HEALTHCARE',
  'ENTERPRISE_OPERATIONS',
  'CLINIC_HOSPITAL',
  'CORPORATE_IT_OPERATIONS',
  'OTHER',
] as const

export type CompanyType = (typeof COMPANY_TYPE_VALUES)[number]

type CompanyTypeConfig = {
  label: string
  slug: string
  title: string
  description: string
  bullets: readonly string[]
  signupTitle: string
  signupDescription: string
  overviewTitle: string
  overviewDescription: string
  projectLabel: string
  projectPluralLabel: string
  taskLabel: string
  taskPluralLabel: string
  groupLabel: string
  groupPluralLabel: string
  workspaceLabel: string
}

export const COMPANY_TYPE_CONFIG = {
  INDUSTRY: {
    label: 'Industry',
    slug: 'industry',
    title: 'Separate work by room, project, and task.',
    description:
      'For manufacturing, logistics, construction, retail, operations, and any business that runs through structured workspaces.',
    bullets: ['Split teams into rooms', 'Keep projects grouped by room', 'Track every task from start to finish'],
    signupTitle: 'Build an industry workspace with rooms, projects, and task control.',
    signupDescription:
      'Use rooms to separate production areas, sites, or departments. Each room can hold focused projects and every project keeps its own task pipeline.',
    overviewTitle: 'Rooms keep operations separated while projects and tasks stay visible.',
    overviewDescription:
      'Perfect for operational teams that need one workspace but still want every room, site, or department clearly structured.',
    projectLabel: 'Project',
    projectPluralLabel: 'Projects',
    taskLabel: 'Task',
    taskPluralLabel: 'Tasks',
    groupLabel: 'Room',
    groupPluralLabel: 'Rooms',
    workspaceLabel: 'Operations workspace',
  },
  DIGITAL_AGENCY: {
    label: 'Digital agency',
    slug: 'digital-agency',
    title: 'Assign creative work and collect uploads in one place.',
    description:
      'For agencies, studios, and creative teams that organize clients by category, then deliver design, video, and content work.',
    bullets: ['Create client categories', 'Assign campaigns to each client', 'Collect images, posters, and videos'],
    signupTitle: 'Run an agency studio where briefs turn into uploaded deliverables.',
    signupDescription:
      'Create client categories, assign campaigns, add image, affiche, and video briefs, then let employees upload finished files directly inside TASKIT.',
    overviewTitle: 'Client categories, creative briefs, production work, and final uploads stay in the same studio.',
    overviewDescription:
      'Designed for agencies that need a clean handoff from brief to deliverable without leaving the workspace.',
    projectLabel: 'Campaign',
    projectPluralLabel: 'Campaigns',
    taskLabel: 'Brief',
    taskPluralLabel: 'Briefs',
    groupLabel: 'Category',
    groupPluralLabel: 'Categories',
    workspaceLabel: 'Agency studio',
  },
  CONTENT_CREATION_AGENCY: {
    label: 'Content creation agency',
    slug: 'content-creation-agency',
    title: 'Plan content releases and track channel growth in one studio.',
    description:
      'For marketing agencies, creator teams, music labels, and media companies producing YouTube, Spotify, and social content.',
    bullets: ['Plan YouTube and Spotify releases', 'Track social channel statistics', 'Collect audio, video, and creative deliverables'],
    signupTitle: 'Run a content studio for music, video, and social channels.',
    signupDescription:
      'Use the agency campaign workflow for clients, briefs, uploads, and approvals, plus a social statistics page for YouTube, Spotify, and other channels.',
    overviewTitle: 'Campaigns, briefs, creative uploads, and channel performance stay in one content studio.',
    overviewDescription:
      'Built for teams that produce music, video, and social content while watching audience growth across YouTube, Spotify, and social platforms.',
    projectLabel: 'Campaign',
    projectPluralLabel: 'Campaigns',
    taskLabel: 'Brief',
    taskPluralLabel: 'Briefs',
    groupLabel: 'Category',
    groupPluralLabel: 'Categories',
    workspaceLabel: 'Content studio',
  },
  HEALTHCARE: {
    label: 'Healthcare',
    slug: 'healthcare',
    title: 'Run clinical operations, service requests, and regulated assets.',
    description:
      'For healthcare organizations coordinating biomedical equipment, internal requests, compliance, facilities, and incident response.',
    bullets: ['Provision clinical departments', 'Track biomedical and facility assets', 'Start with healthcare SLAs'],
    signupTitle: 'Build a healthcare operations workspace for assets, incidents, and compliance.',
    signupDescription:
      'TASKIT provisions departments, teams, incident priorities, SLA policies, asset categories, maintenance plans, and compliance controls for healthcare operations.',
    overviewTitle: 'Healthcare operations connects departments, assets, incidents, maintenance, and governance.',
    overviewDescription:
      'Designed for teams that need service-desk style execution across biomedical, facilities, nursing, IT, compliance, and medical operations.',
    projectLabel: 'Operational Project',
    projectPluralLabel: 'Operational Projects',
    taskLabel: 'Work Order',
    taskPluralLabel: 'Work Orders',
    groupLabel: 'Department',
    groupPluralLabel: 'Departments',
    workspaceLabel: 'Healthcare operations',
  },
  ENTERPRISE_OPERATIONS: {
    label: 'Enterprise operations',
    slug: 'enterprise-operations',
    title: 'Coordinate departments, teams, service queues, and assets.',
    description:
      'For multi-department organizations that need ITSM/ESM workflows, asset lifecycle governance, approvals, and executive operations analytics.',
    bullets: ['Provision enterprise departments', 'Create service queues and escalation paths', 'Track assets and SLA health'],
    signupTitle: 'Build an enterprise operations workspace with service management depth.',
    signupDescription:
      'TASKIT configures departments, enterprise teams, service desk queues, approval workflows, SLA templates, and asset categories automatically.',
    overviewTitle: 'Enterprise operations brings service management and asset lifecycle control into one workspace.',
    overviewDescription:
      'Use queue ownership, escalations, workload analytics, asset registry, maintenance workflows, and audit governance without changing current TASKIT modules.',
    projectLabel: 'Operational Initiative',
    projectPluralLabel: 'Operational Initiatives',
    taskLabel: 'Operational Task',
    taskPluralLabel: 'Operational Tasks',
    groupLabel: 'Department',
    groupPluralLabel: 'Departments',
    workspaceLabel: 'Enterprise operations',
  },
  CLINIC_HOSPITAL: {
    label: 'Clinic / Hospital',
    slug: 'clinic-hospital',
    title: 'Operate hospital departments, biomedical assets, and facility workflows.',
    description:
      'For clinics, hospitals, and care facilities coordinating rooms, devices, biomedical teams, nursing support, and compliance work.',
    bullets: ['Provision hospital departments', 'Create biomedical and facilities queues', 'Seed medical asset categories'],
    signupTitle: 'Build a clinic or hospital operations command center.',
    signupDescription:
      'TASKIT starts with nursing, medical operations, laboratory, biomedical, facilities, security, compliance, procurement, and administration workflows.',
    overviewTitle: 'Hospital operations combines clinical departments, device uptime, maintenance, and compliance.',
    overviewDescription:
      'Designed for care environments where equipment health, incident response, shift coordination, and audit evidence need to stay visible.',
    projectLabel: 'Operational Program',
    projectPluralLabel: 'Operational Programs',
    taskLabel: 'Service Request',
    taskPluralLabel: 'Service Requests',
    groupLabel: 'Department',
    groupPluralLabel: 'Departments',
    workspaceLabel: 'Hospital operations',
  },
  CORPORATE_IT_OPERATIONS: {
    label: 'Corporate IT Operations',
    slug: 'corporate-it-operations',
    title: 'Run IT service management, assets, incidents, and maintenance.',
    description:
      'For IT operations teams managing endpoints, servers, network devices, support queues, security issues, SLAs, and audit-ready change history.',
    bullets: ['Provision IT and security queues', 'Track endpoints and infrastructure', 'Start with IT incident SLAs'],
    signupTitle: 'Build a corporate IT operations workspace.',
    signupDescription:
      'TASKIT configures IT, security, procurement, compliance, and facilities workflows with service desk queues, endpoint asset categories, and SLA policies.',
    overviewTitle: 'Corporate IT operations connects service desk flow, infrastructure assets, and SLA risk.',
    overviewDescription:
      'Built for support teams that need incident triage, queue balancing, endpoint history, escalation chains, and executive service health dashboards.',
    projectLabel: 'IT Initiative',
    projectPluralLabel: 'IT Initiatives',
    taskLabel: 'Ticket Task',
    taskPluralLabel: 'Ticket Tasks',
    groupLabel: 'Department',
    groupPluralLabel: 'Departments',
    workspaceLabel: 'IT operations',
  },
  OTHER: {
    label: 'Other',
    slug: 'other',
    title: 'Use the current TASKIT interface.',
    description: 'For teams that want the same experience that already exists today, with no extra setup.',
    bullets: ['Keep the existing interface', 'Use the same onboarding path', 'Grow into more structure later'],
    signupTitle: 'Start with the standard TASKIT workspace.',
    signupDescription:
      'Keep the same project-and-task interface you already have now, with the option to add more structure later.',
    overviewTitle: 'A flexible workspace for teams that want the current TASKIT flow.',
    overviewDescription:
      'Stay with the existing interface, invite your team, and organize work without changing the base workflow.',
    projectLabel: 'Project',
    projectPluralLabel: 'Projects',
    taskLabel: 'Task',
    taskPluralLabel: 'Tasks',
    groupLabel: 'Workspace',
    groupPluralLabel: 'Workspaces',
    workspaceLabel: 'Standard workspace',
  },
} as const satisfies Record<CompanyType, CompanyTypeConfig>

export const COMPANY_TYPE_OPTIONS = COMPANY_TYPE_VALUES.map((value) => ({
  value,
  ...COMPANY_TYPE_CONFIG[value],
}))

export function isCompanyType(value: string): value is CompanyType {
  return COMPANY_TYPE_VALUES.includes(value.toUpperCase() as CompanyType)
}

export function normalizeCompanyType(value?: string | null): CompanyType {
  if (!value) return 'OTHER'
  return isCompanyType(value) ? (value.toUpperCase() as CompanyType) : 'OTHER'
}

export function getCompanyTypeSlug(type: CompanyType) {
  return COMPANY_TYPE_CONFIG[type].slug
}

export function getCompanyTypeFromSlug(value?: string | null): CompanyType | null {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  const match = COMPANY_TYPE_VALUES.find((type) => COMPANY_TYPE_CONFIG[type].slug === normalized)
  return match ?? null
}

export function getCompanyTypeLabel(type?: CompanyType | null) {
  if (!type) return COMPANY_TYPE_CONFIG.OTHER.label
  return COMPANY_TYPE_CONFIG[type].label
}

export function getCompanyTypeCopy(type?: CompanyType | null) {
  if (!type) return COMPANY_TYPE_CONFIG.OTHER
  return COMPANY_TYPE_CONFIG[type]
}

export const AGENCY_COMPANY_TYPES = ['DIGITAL_AGENCY', 'CONTENT_CREATION_AGENCY'] as const satisfies readonly CompanyType[]

export const ENTERPRISE_OPERATIONS_COMPANY_TYPES = [
  'HEALTHCARE',
  'ENTERPRISE_OPERATIONS',
  'CLINIC_HOSPITAL',
  'CORPORATE_IT_OPERATIONS',
] as const satisfies readonly CompanyType[]

export function isAgencyCompanyType(type?: CompanyType | string | null) {
  return Boolean(type && AGENCY_COMPANY_TYPES.includes(normalizeCompanyType(type) as (typeof AGENCY_COMPANY_TYPES)[number]))
}

export function isContentCreationCompanyType(type?: CompanyType | string | null) {
  return normalizeCompanyType(type) === 'CONTENT_CREATION_AGENCY'
}

export function isEnterpriseOperationsCompanyType(type?: CompanyType | string | null) {
  return Boolean(
    type &&
      ENTERPRISE_OPERATIONS_COMPANY_TYPES.includes(
        normalizeCompanyType(type) as (typeof ENTERPRISE_OPERATIONS_COMPANY_TYPES)[number]
      )
  )
}

export const DELIVERABLE_TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'General work' },
  { value: 'IMAGE', label: 'Image' },
  { value: 'AFFICHE', label: 'Affiche / poster' },
  { value: 'AUDIO', label: 'Audio / music' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'OTHER', label: 'Other' },
] as const

export type DeliverableType = (typeof DELIVERABLE_TYPE_OPTIONS)[number]['value']

export function getDeliverableTypeLabel(value?: string | null) {
  const normalized = value?.trim().toUpperCase()
  return DELIVERABLE_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? 'General work'
}
