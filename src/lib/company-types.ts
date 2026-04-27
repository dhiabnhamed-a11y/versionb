export const COMPANY_TYPE_VALUES = ['INDUSTRY', 'DIGITAL_AGENCY', 'OTHER'] as const

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
      'For agencies, studios, and creative teams that hand out design, video, and content work to employees.',
    bullets: ['Send creative tasks to employees', 'Upload images, posters, and videos', 'Hand finished work back to the boss'],
    signupTitle: 'Run an agency studio where briefs turn into uploaded deliverables.',
    signupDescription:
      'Create campaigns, assign image, affiche, and video work, then let employees upload their finished files directly inside TASKIT.',
    overviewTitle: 'Creative briefs, production work, and final uploads stay in the same studio.',
    overviewDescription:
      'Designed for agencies that need a clean handoff from brief to deliverable without leaving the workspace.',
    projectLabel: 'Campaign',
    projectPluralLabel: 'Campaigns',
    taskLabel: 'Brief',
    taskPluralLabel: 'Briefs',
    groupLabel: 'Client lane',
    groupPluralLabel: 'Client lanes',
    workspaceLabel: 'Agency studio',
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

export const DELIVERABLE_TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'General work' },
  { value: 'IMAGE', label: 'Image' },
  { value: 'AFFICHE', label: 'Affiche / poster' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'OTHER', label: 'Other' },
] as const

export type DeliverableType = (typeof DELIVERABLE_TYPE_OPTIONS)[number]['value']

export function getDeliverableTypeLabel(value?: string | null) {
  const normalized = value?.trim().toUpperCase()
  return DELIVERABLE_TYPE_OPTIONS.find((option) => option.value === normalized)?.label ?? 'General work'
}
