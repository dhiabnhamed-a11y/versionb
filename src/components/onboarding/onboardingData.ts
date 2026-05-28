export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7'

export interface Option {
  value: string
  label: string
  subtitle: string
  icon: string
}

export interface Question {
  id: QuestionId
  question: string
  type: 'single' | 'multi' | 'rank'
  subtitle?: string
  options: Option[]
  dependsOn?: { question: QuestionId; value: string }
}

export type Answers = {
  q1: string | null
  q2: string | null
  q3: string | null
  q4: string[]
  q5: string | null
  q6: string[]
  q7: string[]
}

export type CompanyType =
  | 'INDUSTRY'
  | 'DIGITAL_AGENCY'
  | 'CONTENT_CREATION_AGENCY'
  | 'HEALTHCARE'
  | 'ENTERPRISE_OPERATIONS'
  | 'CLINIC_HOSPITAL'
  | 'CORPORATE_IT_OPERATIONS'
  | 'ERP_WORKSPACE'
  | 'EMS_AGENCY'
  | 'OTHER'

export type TemplateId =
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
  | 'EMS'
  | 'OTHER'

export interface Recommendation {
  companyType: CompanyType
  templateId: TemplateId
  label: string
  description: string
  bullets: string[]
  alternativeLabel?: string
  alternativeTemplateId?: TemplateId
  note?: string
}

export interface WorkspaceTypeInfo {
  companyType: CompanyType
  templateId: TemplateId
  label: string
  description: string
  features: string[]
}

export const Q1_OPTIONS: Option[] = [
  { value: 'erp', label: 'ERP and back-office operations', subtitle: 'Finance, procurement, inventory, HR, payroll, and approvals', icon: 'ERP' },
  { value: 'ems', label: 'Emergency medical services', subtitle: 'Dispatch, fleet, incidents, crews, hospitals, and response analytics', icon: 'EMS' },
  { value: 'business', label: 'General business operations', subtitle: 'Departments, service work, approvals, assets, or multi-site operations', icon: 'OPS' },
  { value: 'healthcare', label: 'Healthcare facility or care network', subtitle: 'Clinic, hospital, lab, biomedical, compliance, or care operations', icon: 'MED' },
  { value: 'agency', label: 'Agency, studio, or client services', subtitle: 'Client projects, campaigns, creative production, and approvals', icon: 'AGY' },
  { value: 'content', label: 'Content or creator team', subtitle: 'Editorial calendars, media production, publishing, and analytics', icon: 'CNT' },
  { value: 'it', label: 'IT or technology operations', subtitle: 'Service desk, infrastructure, assets, security, and incidents', icon: 'IT' },
]

export const Q2_OPTIONS: Record<string, Option[]> = {
  erp: [
    { value: 'financial-close', label: 'Accounting and financial close', subtitle: 'General ledger, AR/AP, budgets, cash, and audit controls', icon: 'FIN' },
    { value: 'procurement-inventory', label: 'Procurement and inventory control', subtitle: 'Purchase orders, vendors, stock, receiving, and cost visibility', icon: 'INV' },
    { value: 'hr-payroll', label: 'HR, payroll, and workforce administration', subtitle: 'Employee records, payroll runs, leave, and approvals', icon: 'HR' },
    { value: 'full-erp', label: 'A connected company resource system', subtitle: 'Finance, procurement, inventory, HR, reporting, and governance together', icon: 'ALL' },
  ],
  ems: [
    { value: 'emergency-dispatch', label: '911 or emergency dispatch operations', subtitle: 'Live incidents, unit recommendations, response status, and escalation', icon: '911' },
    { value: 'ambulance-fleet', label: 'Ambulance fleet and field response', subtitle: 'Units, stations, crews, GPS, availability, and readiness', icon: 'FLT' },
    { value: 'patient-transport', label: 'Medical transport coordination', subtitle: 'Scheduled transports, hospitals, handoffs, billing, and service levels', icon: 'TRN' },
    { value: 'ems-command', label: 'Regional EMS command center', subtitle: 'Multi-station visibility, hospital coordination, protocols, and analytics', icon: 'CMD' },
  ],
  business: [
    { value: 'locations', label: 'Physical locations, plants, sites, or field teams', subtitle: 'Multi-site operations, resources, crews, and service execution', icon: 'LOC' },
    { value: 'clients', label: 'Client delivery and project-based work', subtitle: 'Accounts, contracts, projects, milestones, invoices, and communication', icon: 'CLT' },
    { value: 'departments', label: 'Departments and shared services', subtitle: 'Internal requests, approvals, budgets, permissions, and executive visibility', icon: 'DEP' },
    { value: 'erp', label: 'Finance, inventory, HR, or procurement', subtitle: 'ERP modules, controls, and company resource planning', icon: 'ERP' },
    { value: 'it', label: 'IT assets and service queues', subtitle: 'Infrastructure, endpoints, tickets, changes, and support SLAs', icon: 'IT' },
  ],
  healthcare: [
    { value: 'hospital', label: 'Hospital or medical center', subtitle: 'Clinical departments, biomedical assets, shifts, compliance, and facilities', icon: 'HSP' },
    { value: 'clinic', label: 'Clinic or outpatient facility', subtitle: 'Visits, teams, requests, inventory, compliance, and administration', icon: 'CLN' },
    { value: 'lab', label: 'Lab, diagnostics, or research operation', subtitle: 'Samples, devices, turnaround, evidence, and quality controls', icon: 'LAB' },
    { value: 'community', label: 'Home care or community health', subtitle: 'Field visits, patient services, mobile teams, and outreach programs', icon: 'COM' },
  ],
  agency: [
    { value: 'creative', label: 'Creative production and review', subtitle: 'Briefs, design, video, internal reviews, uploads, and approvals', icon: 'CRT' },
    { value: 'social', label: 'Social and digital marketing', subtitle: 'Campaigns, calendars, content pipelines, reports, and client updates', icon: 'SOC' },
    { value: 'brand', label: 'Brand, strategy, and campaign delivery', subtitle: 'Planning, deliverables, approvals, budgets, and client communication', icon: 'BRD' },
    { value: 'dev', label: 'Web, app, or software delivery', subtitle: 'Backlogs, releases, client milestones, QA, and handoffs', icon: 'DEV' },
  ],
  content: [
    { value: 'video', label: 'Video and channel production', subtitle: 'Planning, shooting, editing, publishing, and performance reporting', icon: 'VID' },
    { value: 'audio', label: 'Podcast, music, or audio production', subtitle: 'Episodes, assets, approvals, distribution, and revenue operations', icon: 'AUD' },
    { value: 'social', label: 'Short-form social content', subtitle: 'Ideas, scripts, shoots, approvals, posting, and creator analytics', icon: 'SOC' },
    { value: 'publishing', label: 'Publishing, newsletters, or editorial', subtitle: 'Editorial calendars, review, distribution, and audience reporting', icon: 'PUB' },
  ],
  it: [
    { value: 'infrastructure', label: 'Infrastructure and cloud operations', subtitle: 'Servers, cloud, networks, uptime, changes, and observability', icon: 'INF' },
    { value: 'servicedesk', label: 'Service desk and user support', subtitle: 'Tickets, SLAs, knowledge base, escalation, and satisfaction', icon: 'SDK' },
    { value: 'security', label: 'Security, compliance, and audits', subtitle: 'Access, controls, risk, evidence, and response workflows', icon: 'SEC' },
    { value: 'cloud', label: 'DevOps and deployment operations', subtitle: 'Pipelines, environments, incidents, releases, and automation', icon: 'OPS' },
  ],
}

export const Q3_OPTIONS: Option[] = [
  { value: 'solo', label: 'Solo operator', subtitle: 'I need a clean workspace for myself first', icon: '1' },
  { value: '2-10', label: '2 to 10 people', subtitle: 'A compact team with a few shared workflows', icon: '2' },
  { value: '11-50', label: '11 to 50 people', subtitle: 'A growing team with roles, queues, and approvals', icon: '3' },
  { value: '51-200', label: '51 to 200 people', subtitle: 'Multiple departments, locations, or operating groups', icon: '4' },
  { value: '200+', label: 'More than 200 people', subtitle: 'Enterprise governance, scale, and executive reporting', icon: '5' },
]

export const Q4_OPTIONS: Option[] = [
  { value: 'financial-control', label: 'Financial control and audit readiness', subtitle: 'Ledger, budgets, approvals, evidence, and close discipline', icon: 'FIN' },
  { value: 'dispatch-speed', label: 'Faster dispatch or response coordination', subtitle: 'Assign units, track status, escalate incidents, and reduce delays', icon: 'DSP' },
  { value: 'fleet-readiness', label: 'Fleet, asset, or inventory visibility', subtitle: 'Availability, maintenance, stock, equipment, and resource history', icon: 'FLT' },
  { value: 'project-delivery', label: 'Project and work delivery clarity', subtitle: 'Owners, deadlines, milestones, blockers, and client commitments', icon: 'PRJ' },
  { value: 'approval-governance', label: 'Approvals, permissions, and governance', subtitle: 'Role access, sign-offs, policy controls, and accountability', icon: 'GOV' },
  { value: 'reporting-analytics', label: 'Executive reporting and analytics', subtitle: 'Dashboards, KPIs, forecasts, trends, and operating health', icon: 'RPT' },
  { value: 'compliance-risk', label: 'Compliance, safety, or risk management', subtitle: 'Protocols, controls, inspections, incidents, and audit trails', icon: 'RSK' },
  { value: 'team-coordination', label: 'Team coordination and workload balance', subtitle: 'Tasks, queues, shifts, assignments, and collaboration', icon: 'TMS' },
]

export const Q5_OPTIONS: Option[] = [
  { value: 'standard', label: 'Standard business operations', subtitle: 'Mostly planned work with moderate controls', icon: 'STD' },
  { value: 'regulated', label: 'Regulated or audit-sensitive operations', subtitle: 'Evidence, approval chains, permissions, and compliance matter', icon: 'REG' },
  { value: 'financial', label: 'Financially controlled operations', subtitle: 'Accounting integrity, spend control, cash, and auditability are central', icon: 'CFO' },
  { value: 'field', label: 'Field or asset-intensive operations', subtitle: 'People, equipment, locations, and mobile work must stay coordinated', icon: 'FLD' },
  { value: 'emergency', label: 'Time-critical emergency operations', subtitle: 'Every second, unit, handoff, and live status change matters', icon: 'EMG' },
]

export const Q6_OPTIONS: Option[] = [
  { value: 'general-ledger', label: 'General ledger, AR/AP, and budgets', subtitle: 'Financial records, billing, payables, budgets, and close', icon: 'GL' },
  { value: 'procurement-inventory', label: 'Procurement and inventory', subtitle: 'Vendors, purchasing, stock, receiving, and cost control', icon: 'PO' },
  { value: 'hr-payroll', label: 'HR and payroll', subtitle: 'Employees, leave, payroll runs, approvals, and records', icon: 'HR' },
  { value: 'dispatch-incidents', label: 'Dispatch and incident command', subtitle: 'Live incidents, unit assignment, severity, status, and timeline', icon: 'EMS' },
  { value: 'fleet-crews', label: 'Fleet, crews, and stations', subtitle: 'Units, crews, availability, station coverage, and readiness', icon: 'FLT' },
  { value: 'hospital-protocols', label: 'Hospitals, protocols, and handoffs', subtitle: 'Hospital coordination, care pathways, protocol library, and evidence', icon: 'HSP' },
  { value: 'projects-clients', label: 'Projects, clients, and approvals', subtitle: 'Client delivery, campaign work, files, invoices, and decisions', icon: 'CLT' },
  { value: 'service-assets', label: 'Service queues and asset management', subtitle: 'Tickets, equipment, maintenance, requests, and SLA tracking', icon: 'SRV' },
]

export const Q7_OPTIONS: Option[] = [
  { value: 'speed', label: 'Speed', subtitle: 'The workspace should shorten response and delivery cycles', icon: 'SPD' },
  { value: 'clarity', label: 'Clarity', subtitle: 'Everyone should know what is happening and what comes next', icon: 'CLR' },
  { value: 'control', label: 'Control', subtitle: 'Approvals, permissions, and policy discipline must be strong', icon: 'CTL' },
  { value: 'reporting', label: 'Reporting', subtitle: 'Leaders need reliable dashboards and decision-ready metrics', icon: 'RPT' },
  { value: 'integration', label: 'Integration', subtitle: 'Finance, operations, people, and field data should connect', icon: 'INT' },
  { value: 'reliability', label: 'Reliability', subtitle: 'Live workflows, handoffs, and automation must be dependable', icon: 'REL' },
]

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    question: 'Which operating model should TASKIT optimize for?',
    subtitle: 'Choose the closest real-world operating environment. ERP and EMS have dedicated workspace engines.',
    type: 'single',
    options: Q1_OPTIONS,
  },
  {
    id: 'q2',
    question: 'What is the core work your team runs every day?',
    subtitle: 'This narrows the workspace blueprint before we tune modules and dashboards.',
    type: 'single',
    options: [],
    dependsOn: { question: 'q1', value: '' },
  },
  {
    id: 'q3',
    question: 'How many people will operate in this workspace?',
    subtitle: 'Team size influences roles, permissions, queues, and reporting defaults.',
    type: 'single',
    options: Q3_OPTIONS,
  },
  {
    id: 'q4',
    question: 'Where do you need the most operational improvement first?',
    subtitle: 'Select up to 3. TASKIT uses this to prioritize workflows and dashboards.',
    type: 'multi',
    options: Q4_OPTIONS,
  },
  {
    id: 'q5',
    question: 'What level of operating discipline does this workspace require?',
    subtitle: 'This helps distinguish ERP control, EMS command, and general operations needs.',
    type: 'single',
    options: Q5_OPTIONS,
  },
  {
    id: 'q6',
    question: 'Which systems must be ready on day one?',
    subtitle: 'Select up to 3. These modules shape the generated workspace structure.',
    type: 'multi',
    options: Q6_OPTIONS,
  },
  {
    id: 'q7',
    question: 'What should TASKIT optimize for above everything else?',
    subtitle: 'Tap your top 2 in order of importance.',
    type: 'rank',
    options: Q7_OPTIONS,
  },
]

export const WORKSPACE_TYPES: Record<string, WorkspaceTypeInfo> = {
  INDUSTRY: {
    companyType: 'INDUSTRY',
    templateId: 'CONSTRUCTION',
    label: 'Operations Workspace',
    description: 'Built for managing physical locations, field teams, assets, and operational service work.',
    features: ['Location and field operations', 'Asset and resource tracking', 'Crew coordination and service workflows'],
  },
  DIGITAL_AGENCY: {
    companyType: 'DIGITAL_AGENCY',
    templateId: 'AGENCY',
    label: 'Agency Studio',
    description: 'Designed for client services, creative production, approvals, and campaign delivery.',
    features: ['Client portal and communication', 'Project and campaign management', 'Creative review and approval workflows'],
  },
  CONTENT_CREATION_AGENCY: {
    companyType: 'CONTENT_CREATION_AGENCY',
    templateId: 'AGENCY',
    label: 'Content Studio',
    description: 'Optimized for content planning, production, publishing, and audience reporting.',
    features: ['Content calendar and production pipeline', 'Publishing workflow support', 'Analytics and audience insights'],
  },
  HEALTHCARE: {
    companyType: 'HEALTHCARE',
    templateId: 'HEALTHCARE',
    label: 'Healthcare Operations',
    description: 'Purpose-built for healthcare workflows, biomedical assets, compliance, and operational requests.',
    features: ['Clinical department management', 'Credentialing and compliance workflows', 'Healthcare operations dashboards'],
  },
  ENTERPRISE_OPERATIONS: {
    companyType: 'ENTERPRISE_OPERATIONS',
    templateId: 'ENTERPRISE',
    label: 'Enterprise Operations',
    description: 'Scalable operations for departments, shared services, approval chains, and executive governance.',
    features: ['Department and budget management', 'Cross-team workflow automation', 'Role-based access and permissions'],
  },
  CLINIC_HOSPITAL: {
    companyType: 'CLINIC_HOSPITAL',
    templateId: 'CLINIC_HOSPITAL',
    label: 'Hospital Command Center',
    description: 'Real-time operations for clinical departments, biomedical inventory, shifts, and audit-ready work.',
    features: ['Clinical department oversight', 'Biomedical inventory management', 'Shift scheduling and handoffs'],
  },
  CORPORATE_IT_OPERATIONS: {
    companyType: 'CORPORATE_IT_OPERATIONS',
    templateId: 'IT_OPERATIONS',
    label: 'IT Operations',
    description: 'Built for service desk, infrastructure, IT assets, incident response, and operational SLAs.',
    features: ['Service desk and ticketing', 'Asset and inventory management', 'Incident and change management'],
  },
  ERP_WORKSPACE: {
    companyType: 'ERP_WORKSPACE',
    templateId: 'ERP',
    label: 'ERP Workspace',
    description: 'Built for finance, procurement, inventory, HR, payroll, reporting, and company resource planning.',
    features: ['General ledger and finance controls', 'Procurement and inventory management', 'HR, payroll, and approval workflows'],
  },
  EMS_AGENCY: {
    companyType: 'EMS_AGENCY',
    templateId: 'EMS',
    label: 'EMS Operations Center',
    description: 'Built for emergency dispatch, ambulance fleet readiness, incident command, hospital coordination, and EMS analytics.',
    features: ['Real-time dispatch and incident command', 'Fleet, crew, and station readiness', 'Hospital coordination and protocol workflows'],
  },
  OTHER: {
    companyType: 'OTHER',
    templateId: 'OTHER',
    label: 'Standard Workspace',
    description: 'A flexible workspace that adapts to teams with mixed or early-stage operating needs.',
    features: ['Customizable modules and workflows', 'Project and task management', 'Team collaboration tools'],
  },
}

export const QUESTION_LABELS: Record<number, string> = {
  0: 'Operating model',
  1: 'Core work',
  2: 'Scale',
  3: 'Pressure points',
  4: 'Discipline',
  5: 'Systems',
  6: 'Priorities',
}
