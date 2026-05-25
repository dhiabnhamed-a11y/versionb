export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5'

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
  q5: string[]
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
  | 'OTHER'

export type TemplateId = 'AGENCY' | 'HEALTHCARE' | 'CLINIC_HOSPITAL' | 'ENTERPRISE' | 'IT_OPERATIONS' | 'ERP' | 'LEGAL' | 'CONSTRUCTION' | 'FINANCE' | 'EDUCATION' | 'OTHER'

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
  { value: 'business', label: 'A business or company', subtitle: 'We have employees, clients, or both', icon: '🏢' },
  { value: 'healthcare', label: 'A healthcare facility', subtitle: 'Clinic, hospital, lab, or care network', icon: '🏥' },
  { value: 'agency', label: 'A creative or marketing agency', subtitle: 'We produce work for clients', icon: '🎨' },
  { value: 'content', label: 'A content studio or creator team', subtitle: 'YouTube, social media, music, or media', icon: '📺' },
  { value: 'it', label: 'An IT or tech operations team', subtitle: 'We manage systems, infrastructure, or support', icon: '🖥️' },
]

export const Q2_OPTIONS: Record<string, Option[]> = {
  business: [
    { value: 'locations', label: 'We manage physical locations, plants, or sites', subtitle: 'Multi-site operations and logistics', icon: '🏭' },
    { value: 'clients', label: 'We serve clients and deliver projects', subtitle: 'Project-based work and client management', icon: '👥' },
    { value: 'departments', label: 'We run departments and shared services', subtitle: 'Internal operations and cross-team workflows', icon: '📦' },
    { value: 'erp', label: 'We need finance, inventory, HR, or procurement', subtitle: 'ERP modules, controls, and company resources', icon: '🧾' },
    { value: 'it', label: 'We manage IT, assets, and service queues', subtitle: 'Infrastructure, assets, and support tickets', icon: '🔧' },
  ],
  healthcare: [
    { value: 'hospital', label: 'Hospital or large medical center', subtitle: 'In-patient, ER, and specialized care', icon: '🏥' },
    { value: 'clinic', label: 'Clinic or outpatient facility', subtitle: 'Primary care, specialists, and walk-ins', icon: '🩺' },
    { value: 'lab', label: 'Lab, diagnostics, or research', subtitle: 'Testing, imaging, and clinical research', icon: '🧬' },
    { value: 'community', label: 'Home care or community health', subtitle: 'Home visits, community outreach, and wellness', icon: '🏠' },
  ],
  agency: [
    { value: 'creative', label: 'Video, design, and creative production', subtitle: 'Creative services and production pipelines', icon: '🎬' },
    { value: 'social', label: 'Social media and digital marketing', subtitle: 'Campaign management and content calendars', icon: '📱' },
    { value: 'brand', label: 'Brand, strategy, and campaigns', subtitle: 'Brand strategy and integrated campaigns', icon: '📣' },
    { value: 'dev', label: 'Web, app, or software development', subtitle: 'Digital products and engineering teams', icon: '💻' },
  ],
  content: [
    { value: 'video', label: 'YouTube and video platforms', subtitle: 'Video production, editing, and publishing', icon: '📺' },
    { value: 'audio', label: 'Music, podcasts, or audio', subtitle: 'Audio production and distribution', icon: '🎵' },
    { value: 'social', label: 'Instagram, TikTok, or social', subtitle: 'Short-form content and social publishing', icon: '📸' },
    { value: 'publishing', label: 'Publishing, newsletters, or media', subtitle: 'Editorial workflows and audience growth', icon: '📰' },
  ],
  it: [
    { value: 'infrastructure', label: 'Servers, networks, and infrastructure', subtitle: 'Data centers, networking, and hardware', icon: '🖥️' },
    { value: 'servicedesk', label: 'Service desk and user support tickets', subtitle: 'Ticketing, SLAs, and end-user support', icon: '🎫' },
    { value: 'security', label: 'Security, compliance, and audits', subtitle: 'InfoSec, compliance, and risk management', icon: '🔐' },
    { value: 'cloud', label: 'Cloud, DevOps, and deployments', subtitle: 'CI/CD, cloud infrastructure, and automation', icon: '☁️' },
  ],
}

export const Q3_OPTIONS: Option[] = [
  { value: 'solo', label: 'Just me', subtitle: 'Solo operator', icon: '1' },
  { value: '2-10', label: '2–10 people', subtitle: 'Small team', icon: '2' },
  { value: '11-50', label: '11–50 people', subtitle: 'Growing team', icon: '3' },
  { value: '51-200', label: '51–200 people', subtitle: 'Medium organization', icon: '4' },
  { value: '200+', label: '200+ people', subtitle: 'Large organization', icon: '5' },
]

export const Q4_OPTIONS: Option[] = [
  { value: 'projects', label: 'Keeping projects on track', subtitle: 'Deadlines and milestones', icon: '📋' },
  { value: 'communication', label: 'Managing client communication', subtitle: 'Client updates and feedback', icon: '💬' },
  { value: 'budgets', label: 'Tracking budgets and invoices', subtitle: 'Financial tracking and billing', icon: '💰' },
  { value: 'tasks', label: 'Coordinating team tasks', subtitle: 'Task assignment and tracking', icon: '✅' },
  { value: 'approvals', label: 'Managing approvals and workflows', subtitle: 'Review cycles and sign-offs', icon: '📝' },
  { value: 'assets', label: 'Tracking assets or resources', subtitle: 'Equipment, inventory, or resources', icon: '📦' },
  { value: 'reporting', label: 'Reporting and analytics', subtitle: 'Data insights and dashboards', icon: '📊' },
  { value: 'compliance', label: 'Onboarding and compliance', subtitle: 'Training, certifications, and audits', icon: '🔒' },
]

export const Q5_OPTIONS: Option[] = [
  { value: 'speed', label: 'Speed', subtitle: 'I need to move fast', icon: '⚡' },
  { value: 'clarity', label: 'Clarity', subtitle: 'I need to know what\'s happening', icon: '🎯' },
  { value: 'collaboration', label: 'Collaboration', subtitle: 'My team needs to work together', icon: '🤝' },
  { value: 'reporting', label: 'Reporting', subtitle: 'I need data and insights', icon: '📊' },
  { value: 'control', label: 'Control', subtitle: 'I need approvals and governance', icon: '🔒' },
  { value: 'integration', label: 'Integration', subtitle: 'I need it to connect to other tools', icon: '🔗' },
]

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    question: 'What best describes your organization?',
    subtitle: 'Select the option that fits best',
    type: 'single',
    options: Q1_OPTIONS,
  },
  {
    id: 'q2',
    question: 'Tell us more about your work',
    type: 'single',
    options: [],
    dependsOn: { question: 'q1', value: '' },
  },
  {
    id: 'q3',
    question: 'How big is your team?',
    subtitle: 'This helps us size your workspace',
    type: 'single',
    options: Q3_OPTIONS,
  },
  {
    id: 'q4',
    question: 'What\'s your biggest challenge right now?',
    subtitle: 'Select up to 3',
    type: 'multi',
    options: Q4_OPTIONS,
  },
  {
    id: 'q5',
    question: 'What matters most to you in a workspace?',
    subtitle: 'Tap your top 2 in order of importance',
    type: 'rank',
    options: Q5_OPTIONS,
  },
]

export const WORKSPACE_TYPES: Record<string, WorkspaceTypeInfo> = {
  INDUSTRY: {
    companyType: 'INDUSTRY',
    templateId: 'CONSTRUCTION',
    label: 'Operations Workspace',
    description: 'Built for managing physical locations, sites, and field operations.',
    features: ['Site and location management', 'Equipment and asset tracking', 'Crew coordination and scheduling'],
  },
  DIGITAL_AGENCY: {
    companyType: 'DIGITAL_AGENCY',
    templateId: 'AGENCY',
    label: 'Agency Studio',
    description: 'Designed for client services, creative production, and campaign management.',
    features: ['Client portal and communication', 'Project and campaign management', 'Creative review and approval workflows'],
  },
  CONTENT_CREATION_AGENCY: {
    companyType: 'CONTENT_CREATION_AGENCY',
    templateId: 'AGENCY',
    label: 'Content Studio',
    description: 'Optimized for content production, publishing, and audience growth.',
    features: ['Content calendar and production pipeline', 'Platform publishing and scheduling', 'Analytics and audience insights'],
  },
  HEALTHCARE: {
    companyType: 'HEALTHCARE',
    templateId: 'HEALTHCARE',
    label: 'Hospital Operations',
    description: 'Purpose-built for healthcare facilities, clinical workflows, and compliance.',
    features: ['Clinical department management', 'Staff scheduling and credentialing', 'Compliance and audit tracking'],
  },
  ENTERPRISE_OPERATIONS: {
    companyType: 'ENTERPRISE_OPERATIONS',
    templateId: 'ENTERPRISE',
    label: 'Enterprise Operations',
    description: 'Scalable operations for departments, shared services, and governance.',
    features: ['Department and budget management', 'Cross-team workflow automation', 'Role-based access and permissions'],
  },
  CLINIC_HOSPITAL: {
    companyType: 'CLINIC_HOSPITAL',
    templateId: 'CLINIC_HOSPITAL',
    label: 'Hospital Command Center',
    description: 'Real-time operations for clinical departments, inventory, and shift management.',
    features: ['Clinical department oversight', 'Biomedical inventory management', 'Shift scheduling and handoffs'],
  },
  CORPORATE_IT_OPERATIONS: {
    companyType: 'CORPORATE_IT_OPERATIONS',
    templateId: 'IT_OPERATIONS',
    label: 'IT Operations',
    description: 'Built for service desk, infrastructure, and IT asset management.',
    features: ['Service desk and ticketing', 'Asset and inventory management', 'Incident and change management'],
  },
  ERP_WORKSPACE: {
    companyType: 'ERP_WORKSPACE',
    templateId: 'ERP',
    label: 'ERP Workspace',
    description: 'Built for finance, procurement, inventory, HR, and company resource planning.',
    features: ['General ledger and finance controls', 'Procurement and inventory management', 'HR and company resource planning'],
  },
  OTHER: {
    companyType: 'OTHER',
    templateId: 'OTHER',
    label: 'Standard Workspace',
    description: 'A flexible workspace that adapts to your unique needs.',
    features: ['Customizable modules and workflows', 'Basic project and task management', 'Team collaboration tools'],
  },
}

export const QUESTION_LABELS: Record<number, string> = {
  0: 'Organization',
  1: 'Specialty',
  2: 'Team size',
  3: 'Challenges',
  4: 'Priorities',
}
