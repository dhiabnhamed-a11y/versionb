import type { Answers, Recommendation, TemplateId, CompanyType } from './onboardingData'
import { WORKSPACE_TYPES } from './onboardingData'

export function computeRecommendation(answers: Answers): Recommendation {
  const q1 = answers.q1
  const q2 = answers.q2
  const q4 = answers.q4
  const q5 = answers.q5

  let companyType: CompanyType
  let templateId: TemplateId
  const alternativeLabel: string | undefined = undefined
  const alternativeTemplateId: TemplateId | undefined = undefined
  let note: string | undefined

  const base = resolveBaseRecommendation(q1, q2)
  companyType = base.companyType
  templateId = base.templateId
  const refined = refineRecommendation({ q1, q2, q4, q5, companyType, templateId })
  companyType = refined.companyType
  templateId = refined.templateId

  const info = WORKSPACE_TYPES[companyType]
  const label = info.label

  if (q4.includes('assets') || q4.includes('compliance')) {
    if (companyType === 'DIGITAL_AGENCY' || companyType === 'CONTENT_CREATION_AGENCY') {
      note = "We've also enabled asset tracking for your workspace."
    }
  }

  const q1Label = getQ1Label(q1)
  const q2Label = getQ2Label(q1, q2)
  const description = makeDescription(companyType, label, q1Label, q2Label)
  const bullets = getBullets(companyType, q4)

  return {
    companyType,
    templateId,
    label,
    description,
    bullets,
    alternativeLabel,
    alternativeTemplateId,
    note,
  }
}

function resolveBaseRecommendation(q1: string | null, q2: string | null): { companyType: CompanyType; templateId: TemplateId } {
  if (q1 === 'business') {
    if (q2 === 'locations') return { companyType: 'INDUSTRY', templateId: 'CONSTRUCTION' }
    if (q2 === 'clients') return { companyType: 'DIGITAL_AGENCY', templateId: 'AGENCY' }
    if (q2 === 'departments') return { companyType: 'ENTERPRISE_OPERATIONS', templateId: 'ENTERPRISE' }
    if (q2 === 'erp') return { companyType: 'ERP_WORKSPACE', templateId: 'ERP' }
    if (q2 === 'it') return { companyType: 'CORPORATE_IT_OPERATIONS', templateId: 'IT_OPERATIONS' }
  }

  if (q1 === 'healthcare') {
    if (q2 === 'hospital') return { companyType: 'HEALTHCARE', templateId: 'HEALTHCARE' }
    if (q2 === 'clinic') return { companyType: 'CLINIC_HOSPITAL', templateId: 'CLINIC_HOSPITAL' }
    if (q2 === 'lab' || q2 === 'community') return { companyType: 'HEALTHCARE', templateId: 'HEALTHCARE' }
  }

  if (q1 === 'agency') {
    return { companyType: 'DIGITAL_AGENCY', templateId: 'AGENCY' }
  }

  if (q1 === 'content') {
    return { companyType: 'CONTENT_CREATION_AGENCY', templateId: 'AGENCY' }
  }

  if (q1 === 'it') {
    if (q2 === 'infrastructure' || q2 === 'servicedesk') return { companyType: 'CORPORATE_IT_OPERATIONS', templateId: 'IT_OPERATIONS' }
    if (q2 === 'security' || q2 === 'cloud') return { companyType: 'CORPORATE_IT_OPERATIONS', templateId: 'IT_OPERATIONS' }
  }

  return { companyType: 'OTHER', templateId: 'OTHER' }
}

function refineRecommendation({
  q1,
  q2,
  q4,
  q5,
  companyType,
  templateId,
}: {
  q1: string | null
  q2: string | null
  q4: string[]
  q5: string[]
  companyType: CompanyType
  templateId: TemplateId
}): { companyType: CompanyType; templateId: TemplateId } {
  const challenges = new Set(q4)
  const priorities = new Set(q5)
  const wantsFinanceSystem =
    challenges.has('budgets') ||
    (challenges.has('reporting') && (priorities.has('control') || priorities.has('reporting'))) ||
    (challenges.has('assets') && priorities.has('integration'))
  const wantsGovernance = priorities.has('control') || challenges.has('approvals') || challenges.has('compliance')
  const wantsOperations = challenges.has('assets') || challenges.has('tasks') || challenges.has('projects')

  if (q1 === 'business') {
    if (q2 === 'erp' || ((q2 === 'departments' || q2 === 'locations') && wantsFinanceSystem)) {
      return { companyType: 'ERP_WORKSPACE', templateId: 'ERP' }
    }

    if (q2 === 'locations') {
      return wantsOperations || wantsGovernance
        ? { companyType: 'INDUSTRY', templateId: 'CONSTRUCTION' }
        : { companyType: 'ENTERPRISE_OPERATIONS', templateId: 'ENTERPRISE' }
    }
  }

  if (q1 === 'healthcare' && (q2 === 'hospital' || q2 === 'clinic')) {
    return { companyType: 'CLINIC_HOSPITAL', templateId: 'CLINIC_HOSPITAL' }
  }

  if (q1 === 'it') {
    return { companyType: 'CORPORATE_IT_OPERATIONS', templateId: 'IT_OPERATIONS' }
  }

  return { companyType, templateId }
}

function getQ1Label(q1: string | null): string {
  const labels: Record<string, string> = {
    business: 'a business and operations team',
    healthcare: 'a healthcare organization',
    agency: 'a creative and marketing agency',
    content: 'a content studio and creator team',
    it: 'an IT and technology team',
  }
  return labels[q1 ?? ''] ?? 'a team'
}

function getQ2Label(q1: string | null, q2: string | null): string {
  if (!q1 || !q2) return ''

  const labels: Record<string, string> = {
    locations: 'managing physical locations and sites',
    clients: 'serving clients through projects',
    departments: 'running departments and shared services',
    erp: 'managing finance, inventory, HR, or procurement',
    it: 'managing IT and service operations',
    hospital: 'operating in a hospital or medical center',
    clinic: 'running a clinic or outpatient facility',
    lab: 'working in lab diagnostics and research',
    community: 'providing home care and community health',
    creative: 'producing creative work and video',
    social: 'managing social media and digital marketing',
    brand: 'running brand strategy and campaigns',
    dev: 'building digital products and software',
    video: 'creating video content and media',
    audio: 'producing music and audio content',
    social_c: 'creating social media content',
    publishing: 'running publishing and editorial',
    infrastructure: 'managing servers and infrastructure',
    servicedesk: 'running service desk operations',
    security: 'handling security and compliance',
    cloud: 'managing cloud and DevOps',
  }
  return labels[q2] ?? ''
}

function makeDescription(companyType: CompanyType, label: string, q1Label: string, q2Label: string): string {
  const detail = q2Label ? `, where you're ${q2Label}` : ''

  const base = `Since you're ${q1Label}${detail}, we've set you up with a **${label}**. `

  const descriptions: Record<CompanyType, string> = {
    INDUSTRY: 'It\'s built for managing physical locations, equipment, and field crews — everything you need to keep operations running smoothly.',
    DIGITAL_AGENCY: 'It includes client portals, campaign management, creative review tools, and project tracking so you can focus on delivering great work.',
    CONTENT_CREATION_AGENCY: 'It comes with a content calendar, platform publishing tools, and audience analytics to help you grow and engage your audience.',
    HEALTHCARE: 'It includes clinical department management, staff credentialing, and compliance tracking designed for healthcare environments.',
    ENTERPRISE_OPERATIONS: 'It provides department-level budgeting, cross-team automation, and governance controls to manage at scale.',
    CLINIC_HOSPITAL: 'It offers real-time clinical oversight, biomedical inventory tracking, and shift scheduling for hospital command center operations.',
    CORPORATE_IT_OPERATIONS: 'It includes service desk ticketing, asset management, and incident response — purpose-built for IT teams.',
    ERP_WORKSPACE: 'It includes finance, procurement, inventory, HR, and control workflows so business resources are planned from day one.',
    OTHER: 'It includes customizable modules, project management, and collaboration tools that you can tailor as you grow.',
  }

  return base + (descriptions[companyType] ?? descriptions.OTHER)
}

function getBullets(companyType: CompanyType, q4: string[]): string[] {
  const info = WORKSPACE_TYPES[companyType]
  const baseFeatures = info?.features ?? ['Project and task management', 'Team collaboration', 'Reporting dashboards']

  const challengeMap: Record<string, string> = {
    projects: 'Smart project tracking with milestones and deadlines',
    communication: 'Client communication portal with threaded updates',
    budgets: 'Budget and invoice tracking with real-time financial views',
    tasks: 'Team task coordination with drag-and-drop boards',
    approvals: 'Custom approval workflows for reviews and sign-offs',
    assets: 'Asset and resource tracking with usage history',
    reporting: 'Executive dashboards with customizable reports',
    compliance: 'Onboarding checklists and compliance audit trails',
  }

  const matched: string[] = []
  for (const challenge of q4) {
    if (challengeMap[challenge]) {
      matched.push(challengeMap[challenge])
    }
  }

  const combined = [...new Set([...matched, ...baseFeatures])]
  return combined.slice(0, 3)
}
