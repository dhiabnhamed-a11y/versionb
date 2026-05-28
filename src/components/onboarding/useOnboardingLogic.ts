import type { Answers, Recommendation, TemplateId, CompanyType } from './onboardingData'
import { Q1_OPTIONS, Q2_OPTIONS, WORKSPACE_TYPES } from './onboardingData'

type ScoredTemplate = {
  companyType: CompanyType
  templateId: TemplateId
  score: number
  reasons: string[]
}

const INITIAL_SCORES: ScoredTemplate[] = [
  { companyType: 'ERP_WORKSPACE', templateId: 'ERP', score: 0, reasons: [] },
  { companyType: 'EMS_AGENCY', templateId: 'EMS', score: 0, reasons: [] },
  { companyType: 'ENTERPRISE_OPERATIONS', templateId: 'ENTERPRISE', score: 0, reasons: [] },
  { companyType: 'CORPORATE_IT_OPERATIONS', templateId: 'IT_OPERATIONS', score: 0, reasons: [] },
  { companyType: 'CLINIC_HOSPITAL', templateId: 'CLINIC_HOSPITAL', score: 0, reasons: [] },
  { companyType: 'HEALTHCARE', templateId: 'HEALTHCARE', score: 0, reasons: [] },
  { companyType: 'DIGITAL_AGENCY', templateId: 'AGENCY', score: 0, reasons: [] },
  { companyType: 'CONTENT_CREATION_AGENCY', templateId: 'AGENCY', score: 0, reasons: [] },
  { companyType: 'INDUSTRY', templateId: 'CONSTRUCTION', score: 0, reasons: [] },
  { companyType: 'OTHER', templateId: 'OTHER', score: 0, reasons: [] },
]

export function computeRecommendation(answers: Answers): Recommendation {
  const scored = scoreTemplates(answers)
  const primary = scored[0] ?? { companyType: 'OTHER' as CompanyType, templateId: 'OTHER' as TemplateId, score: 0, reasons: [] }
  const alternative = scored.find((item) => item.templateId !== primary.templateId && item.score >= primary.score - 4)
  const info = WORKSPACE_TYPES[primary.companyType] ?? WORKSPACE_TYPES.OTHER

  return {
    companyType: primary.companyType,
    templateId: primary.templateId,
    label: info.label,
    description: makeDescription(answers, primary.companyType, info.label),
    bullets: getBullets(primary.companyType, answers),
    alternativeLabel: alternative ? WORKSPACE_TYPES[alternative.companyType]?.label : undefined,
    alternativeTemplateId: alternative?.templateId,
    note: makeNote(primary.companyType, answers),
  }
}

function scoreTemplates(answers: Answers) {
  const scores = INITIAL_SCORES.map((item) => ({ ...item, reasons: [...item.reasons] }))

  function add(templateId: TemplateId, points: number, reason: string) {
    const match = scores.find((item) => item.templateId === templateId)
    if (!match) return
    match.score += points
    match.reasons.push(reason)
  }

  function addCompany(companyType: CompanyType, points: number, reason: string) {
    const match = scores.find((item) => item.companyType === companyType)
    if (!match) return
    match.score += points
    match.reasons.push(reason)
  }

  if (answers.q1 === 'erp') add('ERP', 12, 'ERP operating model')
  if (answers.q1 === 'ems') add('EMS', 12, 'EMS operating model')
  if (answers.q1 === 'business') add('ENTERPRISE', 5, 'General business operations')
  if (answers.q1 === 'healthcare') {
    add('HEALTHCARE', 6, 'Healthcare environment')
    add('CLINIC_HOSPITAL', 4, 'Clinical operations')
  }
  if (answers.q1 === 'agency') addCompany('DIGITAL_AGENCY', 9, 'Agency operating model')
  if (answers.q1 === 'content') addCompany('CONTENT_CREATION_AGENCY', 9, 'Content operating model')
  if (answers.q1 === 'it') add('IT_OPERATIONS', 10, 'IT operating model')

  const q2TemplateMap: Record<string, TemplateId> = {
    'financial-close': 'ERP',
    'procurement-inventory': 'ERP',
    'hr-payroll': 'ERP',
    'full-erp': 'ERP',
    'emergency-dispatch': 'EMS',
    'ambulance-fleet': 'EMS',
    'patient-transport': 'EMS',
    'ems-command': 'EMS',
    locations: 'CONSTRUCTION',
    clients: 'AGENCY',
    departments: 'ENTERPRISE',
    erp: 'ERP',
    it: 'IT_OPERATIONS',
    hospital: 'CLINIC_HOSPITAL',
    clinic: 'CLINIC_HOSPITAL',
    lab: 'HEALTHCARE',
    community: 'HEALTHCARE',
    creative: 'AGENCY',
    social: 'AGENCY',
    brand: 'AGENCY',
    dev: 'AGENCY',
    video: 'AGENCY',
    audio: 'AGENCY',
    publishing: 'AGENCY',
    infrastructure: 'IT_OPERATIONS',
    servicedesk: 'IT_OPERATIONS',
    security: 'IT_OPERATIONS',
    cloud: 'IT_OPERATIONS',
  }
  const q2Template = answers.q2 ? q2TemplateMap[answers.q2] : undefined
  if (q2Template) add(q2Template, 8, 'Daily operating work')

  for (const challenge of answers.q4) {
    if (challenge === 'financial-control') add('ERP', 6, 'Financial control need')
    if (challenge === 'dispatch-speed') add('EMS', 7, 'Dispatch speed need')
    if (challenge === 'fleet-readiness') {
      add('EMS', 5, 'Fleet readiness need')
      add('CONSTRUCTION', 3, 'Asset-heavy operations')
      add('IT_OPERATIONS', 2, 'Asset-heavy operations')
    }
    if (challenge === 'project-delivery') add('AGENCY', 5, 'Project delivery need')
    if (challenge === 'approval-governance') {
      add('ENTERPRISE', 4, 'Governance need')
      add('ERP', 3, 'Approval control need')
    }
    if (challenge === 'reporting-analytics') {
      add('ENTERPRISE', 3, 'Reporting need')
      add('ERP', 3, 'Financial reporting need')
      add('EMS', 2, 'Response analytics need')
    }
    if (challenge === 'compliance-risk') {
      add('HEALTHCARE', 4, 'Compliance need')
      add('CLINIC_HOSPITAL', 4, 'Clinical risk need')
      add('EMS', 3, 'Protocol risk need')
      add('ERP', 2, 'Audit risk need')
    }
    if (challenge === 'team-coordination') {
      add('ENTERPRISE', 3, 'Team coordination need')
      add('EMS', 2, 'Crew coordination need')
    }
  }

  if (answers.q5 === 'regulated') {
    add('HEALTHCARE', 3, 'Regulated environment')
    add('CLINIC_HOSPITAL', 3, 'Regulated environment')
    add('ERP', 3, 'Audit-sensitive environment')
    add('EMS', 2, 'Protocol-sensitive environment')
  }
  if (answers.q5 === 'financial') add('ERP', 7, 'Financially controlled environment')
  if (answers.q5 === 'field') {
    add('EMS', 4, 'Field operations')
    add('CONSTRUCTION', 5, 'Field operations')
  }
  if (answers.q5 === 'emergency') add('EMS', 8, 'Time-critical emergency environment')
  if (answers.q5 === 'standard') add('ENTERPRISE', 2, 'Standard operations')

  for (const system of answers.q6) {
    if (system === 'general-ledger') add('ERP', 6, 'Finance system required')
    if (system === 'procurement-inventory') add('ERP', 5, 'Procurement and inventory required')
    if (system === 'hr-payroll') add('ERP', 5, 'HR and payroll required')
    if (system === 'dispatch-incidents') add('EMS', 7, 'Dispatch and incidents required')
    if (system === 'fleet-crews') add('EMS', 6, 'Fleet and crews required')
    if (system === 'hospital-protocols') {
      add('EMS', 5, 'Hospital coordination required')
      add('CLINIC_HOSPITAL', 3, 'Clinical coordination required')
    }
    if (system === 'projects-clients') add('AGENCY', 5, 'Project and client system required')
    if (system === 'service-assets') {
      add('IT_OPERATIONS', 4, 'Service and asset system required')
      add('ENTERPRISE', 3, 'Shared service system required')
    }
  }

  for (const [index, priority] of answers.q7.entries()) {
    const weight = index === 0 ? 3 : 2
    if (priority === 'speed') {
      add('EMS', weight + 1, 'Speed priority')
      add('AGENCY', weight, 'Speed priority')
    }
    if (priority === 'clarity') add('ENTERPRISE', weight, 'Clarity priority')
    if (priority === 'control') {
      add('ERP', weight + 1, 'Control priority')
      add('ENTERPRISE', weight, 'Control priority')
    }
    if (priority === 'reporting') {
      add('ERP', weight, 'Reporting priority')
      add('ENTERPRISE', weight, 'Reporting priority')
    }
    if (priority === 'integration') add('ERP', weight + 1, 'Integration priority')
    if (priority === 'reliability') {
      add('EMS', weight + 1, 'Reliability priority')
      add('IT_OPERATIONS', weight, 'Reliability priority')
    }
  }

  if (answers.q3 === '51-200' || answers.q3 === '200+') {
    add('ENTERPRISE', 2, 'Larger team')
    add('ERP', 2, 'Larger team')
    add('EMS', answers.q1 === 'ems' ? 2 : 0, 'Larger EMS operation')
  }

  return scores.sort((a, b) => b.score - a.score)
}

function makeDescription(answers: Answers, companyType: CompanyType, label: string): string {
  const q1Label = getQ1Label(answers.q1)
  const q2Label = getQ2Label(answers.q1, answers.q2)
  const core = q2Label ? `${q1Label} focused on ${q2Label}` : q1Label

  const descriptions: Record<CompanyType, string> = {
    INDUSTRY: 'It prioritizes sites, assets, teams, service workflows, and operational visibility.',
    DIGITAL_AGENCY: 'It prioritizes clients, campaigns, creative workflows, approvals, files, and delivery health.',
    CONTENT_CREATION_AGENCY: 'It prioritizes content calendars, production pipelines, publishing workflows, and audience reporting.',
    HEALTHCARE: 'It prioritizes clinical operations, compliance, biomedical assets, service requests, and audit-ready evidence.',
    ENTERPRISE_OPERATIONS: 'It prioritizes departments, shared services, approvals, permissions, executive dashboards, and governance.',
    CLINIC_HOSPITAL: 'It prioritizes clinical departments, biomedical inventory, shifts, facilities, and hospital-ready operating controls.',
    CORPORATE_IT_OPERATIONS: 'It prioritizes service queues, IT assets, incidents, changes, SLAs, and reliability dashboards.',
    ERP_WORKSPACE: 'It prioritizes general ledger, AR/AP, procurement, inventory, HR, payroll, approvals, and financial control.',
    EMS_AGENCY: 'It prioritizes dispatch, incidents, unit assignment, fleet readiness, crews, hospital coordination, protocols, and response analytics.',
    OTHER: 'It prioritizes flexible projects, tasks, collaboration, and reporting that can be tailored as your operations mature.',
  }

  return `Because you described ${core}, TASKIT recommends ${label}. ${descriptions[companyType] ?? descriptions.OTHER}`
}

function getQ1Label(q1: string | null): string {
  const option = Q1_OPTIONS.find((item) => item.value === q1)
  return option?.label.toLowerCase() ?? 'a team'
}

function getQ2Label(q1: string | null, q2: string | null): string {
  if (!q1 || !q2) return ''
  const option = Q2_OPTIONS[q1]?.find((item) => item.value === q2)
  return option?.label.toLowerCase() ?? ''
}

function getBullets(companyType: CompanyType, answers: Answers): string[] {
  const info = WORKSPACE_TYPES[companyType]
  const baseFeatures = info?.features ?? ['Project and task management', 'Team collaboration', 'Reporting dashboards']

  const challengeMap: Record<string, string> = {
    'financial-control': 'Approval-ready finance controls with audit evidence',
    'dispatch-speed': 'Live dispatch workflows with incident timelines and unit status',
    'fleet-readiness': 'Fleet, asset, inventory, and readiness visibility',
    'project-delivery': 'Project tracking with owners, milestones, blockers, and client handoffs',
    'approval-governance': 'Role-based permissions, approvals, and policy gates',
    'reporting-analytics': 'Executive dashboards with operating health and trend reporting',
    'compliance-risk': 'Compliance, protocol, and risk workflows with traceable evidence',
    'team-coordination': 'Team queues, assignments, workload balance, and collaboration',
  }

  const systemMap: Record<string, string> = {
    'general-ledger': 'General ledger, AR/AP, budgets, and close workflows',
    'procurement-inventory': 'Procurement, vendors, inventory, receiving, and cost control',
    'hr-payroll': 'HR, payroll, leave, and employee record workflows',
    'dispatch-incidents': 'Dispatch board, incidents, severity, and response status',
    'fleet-crews': 'Fleet, crews, stations, readiness, and coverage management',
    'hospital-protocols': 'Hospital coordination, handoffs, protocols, and EMS evidence',
    'projects-clients': 'Client projects, approvals, files, and delivery reporting',
    'service-assets': 'Service queues, assets, maintenance, and SLA tracking',
  }

  const matched = [...answers.q4, ...answers.q6]
    .map((key) => challengeMap[key] ?? systemMap[key])
    .filter(Boolean)

  return [...new Set([...matched, ...baseFeatures])].slice(0, 4)
}

function makeNote(companyType: CompanyType, answers: Answers) {
  if (companyType === 'ERP_WORKSPACE') {
    return 'ERP was selected because your answers emphasized finance, procurement, HR, inventory, control, or audit-ready reporting.'
  }

  if (companyType === 'EMS_AGENCY') {
    return 'EMS was selected because your answers emphasized dispatch, incidents, fleet readiness, crews, hospitals, protocols, or time-critical response.'
  }

  if (answers.q6.includes('general-ledger') || answers.q6.includes('dispatch-incidents')) {
    return 'Your selected day-one systems also remain available if you adjust the workspace later.'
  }

  return undefined
}
