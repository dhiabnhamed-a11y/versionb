export type ModuleId =
  | 'command'
  | 'crm'
  | 'campaigns'
  | 'ai'
  | 'automations'
  | 'team'
  | 'media'
  | 'finance'
  | 'comms'
  | 'analytics'

export type CampaignStage = 'Intake' | 'Production' | 'Review' | 'Approved'

export type OsModule = {
  id: ModuleId
  label: string
  eyebrow: string
  metric: string
  signal: string
}

export type Workspace = {
  id: string
  name: string
  tier: string
  pulse: string
}

export type ExecutiveMetric = {
  label: string
  value: string
  delta: string
  tone: 'good' | 'watch' | 'risk'
}

export type ClientRecord = {
  id: string
  name: string
  segment: string
  owner: string
  health: number
  revenue: string
  lifecycle: string
  lastTouch: string
  engagementDelta: string
  openInvoices: string
  activeCampaigns: number
}

export type CampaignWork = {
  id: string
  name: string
  client: string
  stage: CampaignStage
  owner: string
  due: string
  health: number
  budget: string
  risk: string
  approvals: number
  deliverables: number
}

export type AiSignal = {
  id: string
  title: string
  detail: string
  severity: 'critical' | 'watch' | 'positive'
  action: string
  entity: string
}

export type AutomationRule = {
  id: string
  name: string
  trigger: string
  condition: string
  action: string
  status: 'Live' | 'Draft' | 'Paused'
  runs: number
  successRate: string
}

export type TeamMember = {
  id: string
  name: string
  role: string
  department: string
  capacity: number
  utilization: number
  focus: string
  mood: 'steady' | 'loaded' | 'open'
  tasks: number
}

export type MediaAsset = {
  id: string
  name: string
  client: string
  type: string
  version: string
  status: 'Approved' | 'In review' | 'Needs changes'
  comments: number
  size: string
}

export type InvoiceRecord = {
  id: string
  client: string
  amount: string
  status: 'Paid' | 'Due' | 'Overdue' | 'Draft'
  due: string
  trend: string
  linkedCampaign: string
}

export type CommunicationItem = {
  id: string
  author: string
  channel: string
  message: string
  time: string
  entity: string
}

export type ReportBar = {
  label: string
  revenue: number
  productivity: number
  satisfaction: number
}

export const osModules: OsModule[] = [
  { id: 'command', label: 'Command', eyebrow: 'Mission control', metric: '91%', signal: 'Portfolio confidence' },
  { id: 'crm', label: 'Clients', eyebrow: 'CRM health', metric: '128', signal: 'Managed accounts' },
  { id: 'campaigns', label: 'Campaigns', eyebrow: 'Operating system', metric: '42', signal: 'Live campaigns' },
  { id: 'ai', label: 'AI Ops', eyebrow: 'Business copilot', metric: '14', signal: 'Active recommendations' },
  { id: 'automations', label: 'Automation', eyebrow: 'Workflow engine', metric: '2.8k', signal: 'Runs this month' },
  { id: 'team', label: 'Team', eyebrow: 'Capacity', metric: '82%', signal: 'Healthy utilization' },
  { id: 'media', label: 'Media', eyebrow: 'Asset system', metric: '9.4TB', signal: 'Managed library' },
  { id: 'finance', label: 'Finance', eyebrow: 'Revenue ops', metric: '$1.42M', signal: 'Revenue in flight' },
  { id: 'comms', label: 'Comms', eyebrow: 'Realtime hub', metric: '384', signal: 'Mentions today' },
  { id: 'analytics', label: 'Reports', eyebrow: 'Forecasting', metric: '+18%', signal: 'QoQ growth forecast' },
]

export const workspaces: Workspace[] = [
  { id: 'nebula', name: 'Nebula Agency Group', tier: 'Enterprise', pulse: '2,847 events today' },
  { id: 'helio', name: 'Helio Creative Labs', tier: 'Scale', pulse: '1,206 events today' },
  { id: 'north', name: 'Northstar Studio', tier: 'Agency Pro', pulse: '742 events today' },
]

export const executiveMetrics: ExecutiveMetric[] = [
  { label: 'Campaign health', value: '91%', delta: '+6%', tone: 'good' },
  { label: 'Client risk', value: '7', delta: '-3', tone: 'watch' },
  { label: 'Revenue secured', value: '$842k', delta: '+18%', tone: 'good' },
  { label: 'Approval backlog', value: '23', delta: '+5', tone: 'risk' },
  { label: 'Automation success', value: '98.7%', delta: '+1.4%', tone: 'good' },
  { label: 'Team load', value: '82%', delta: '+4%', tone: 'watch' },
]

export const clients: ClientRecord[] = [
  {
    id: 'c-northstar',
    name: 'Northstar Labs',
    segment: 'Enterprise SaaS',
    owner: 'Maya Chen',
    health: 96,
    revenue: '$74k MRR',
    lifecycle: 'Expansion',
    lastTouch: '12 min ago',
    engagementDelta: '+14%',
    openInvoices: '$0',
    activeCampaigns: 4,
  },
  {
    id: 'c-helio',
    name: 'Helio Capital',
    segment: 'Financial services',
    owner: 'Omar Reyes',
    health: 73,
    revenue: '$118k QTD',
    lifecycle: 'Approval risk',
    lastTouch: '2 days ago',
    engagementDelta: '-28%',
    openInvoices: '$42k',
    activeCampaigns: 3,
  },
  {
    id: 'c-arc',
    name: 'Arc Studio',
    segment: 'Consumer brand',
    owner: 'Lina Park',
    health: 88,
    revenue: '$42k MRR',
    lifecycle: 'Retainer',
    lastTouch: '1 hour ago',
    engagementDelta: '+6%',
    openInvoices: '$8k',
    activeCampaigns: 5,
  },
  {
    id: 'c-vale',
    name: 'Vale Foods',
    segment: 'Retail launch',
    owner: 'Theo Morgan',
    health: 81,
    revenue: '$63k project',
    lifecycle: 'Onboarding',
    lastTouch: '36 min ago',
    engagementDelta: '+9%',
    openInvoices: '$12k',
    activeCampaigns: 2,
  },
]

export const campaigns: CampaignWork[] = [
  {
    id: 'camp-helio-q3',
    name: 'Q3 investor launch system',
    client: 'Helio Capital',
    stage: 'Production',
    owner: 'Omar Reyes',
    due: 'May 18',
    health: 64,
    budget: '$118k',
    risk: 'Legal approval dependency',
    approvals: 5,
    deliverables: 18,
  },
  {
    id: 'camp-northstar-ai',
    name: 'AI product narrative sprint',
    client: 'Northstar Labs',
    stage: 'Review',
    owner: 'Maya Chen',
    due: 'May 14',
    health: 92,
    budget: '$74k',
    risk: 'Low',
    approvals: 2,
    deliverables: 11,
  },
  {
    id: 'camp-arc-social',
    name: 'Creator commerce campaign',
    client: 'Arc Studio',
    stage: 'Intake',
    owner: 'Lina Park',
    due: 'May 27',
    health: 86,
    budget: '$42k',
    risk: 'Awaiting product shots',
    approvals: 0,
    deliverables: 9,
  },
  {
    id: 'camp-vale-launch',
    name: 'Retail shelf launch kit',
    client: 'Vale Foods',
    stage: 'Approved',
    owner: 'Theo Morgan',
    due: 'May 12',
    health: 97,
    budget: '$63k',
    risk: 'Low',
    approvals: 1,
    deliverables: 22,
  },
  {
    id: 'camp-northstar-web',
    name: 'Website conversion rebuild',
    client: 'Northstar Labs',
    stage: 'Production',
    owner: 'Maya Chen',
    due: 'May 30',
    health: 89,
    budget: '$96k',
    risk: 'Engineering handoff',
    approvals: 3,
    deliverables: 16,
  },
  {
    id: 'camp-arc-retainer',
    name: 'Monthly content engine',
    client: 'Arc Studio',
    stage: 'Review',
    owner: 'Lina Park',
    due: 'May 16',
    health: 83,
    budget: '$28k',
    risk: 'Creative volume spike',
    approvals: 7,
    deliverables: 34,
  },
]

export const aiSignals: AiSignal[] = [
  {
    id: 'ai-delay',
    title: 'Delay risk detected',
    detail: 'Helio Capital has five unresolved legal approvals and a shrinking production buffer.',
    severity: 'critical',
    action: 'Escalate approval chain',
    entity: 'Q3 investor launch system',
  },
  {
    id: 'ai-workload',
    title: 'Capacity pressure rising',
    detail: 'Design has crossed 92% utilization for three consecutive days.',
    severity: 'watch',
    action: 'Rebalance 8 tasks',
    entity: 'Design department',
  },
  {
    id: 'ai-engagement',
    title: 'Client engagement dropped',
    detail: 'Helio stakeholder response rate is down 28% against the 30 day baseline.',
    severity: 'watch',
    action: 'Schedule executive follow-up',
    entity: 'Helio Capital',
  },
  {
    id: 'ai-finance',
    title: 'Payment trend unstable',
    detail: 'Two recurring invoices moved from 7 day average payment to 18 day average payment.',
    severity: 'critical',
    action: 'Run finance reminder workflow',
    entity: 'Finance system',
  },
  {
    id: 'ai-positive',
    title: 'Launch confidence improved',
    detail: 'Northstar approvals cleared and paid media assets are ready for trafficking.',
    severity: 'positive',
    action: 'Generate launch report',
    entity: 'Northstar Labs',
  },
]

export const automationRules: AutomationRule[] = [
  {
    id: 'auto-overdue-task',
    name: 'Overdue production escalation',
    trigger: 'Task becomes overdue',
    condition: 'Priority is high or campaign health is under 75%',
    action: 'Notify manager, update risk score, and create recovery checklist',
    status: 'Live',
    runs: 284,
    successRate: '99.1%',
  },
  {
    id: 'auto-approval',
    name: 'Approved campaign production pack',
    trigger: 'Campaign approved',
    condition: 'All required client approvers signed off',
    action: 'Generate production tasks, milestones, and channel announcements',
    status: 'Live',
    runs: 126,
    successRate: '98.6%',
  },
  {
    id: 'auto-invoice',
    name: 'Invoice recovery sequence',
    trigger: 'Invoice unpaid after due date',
    condition: 'Client is not in dispute and payment link exists',
    action: 'Send reminder, notify finance, and lower client health score',
    status: 'Live',
    runs: 72,
    successRate: '96.8%',
  },
  {
    id: 'auto-upload',
    name: 'Media upload review request',
    trigger: 'Deliverable uploaded',
    condition: 'Asset folder requires client review',
    action: 'Request review, attach latest version, and create annotation thread',
    status: 'Draft',
    runs: 0,
    successRate: 'Ready',
  },
]

export const teamMembers: TeamMember[] = [
  {
    id: 'tm-maya',
    name: 'Maya Chen',
    role: 'Account Director',
    department: 'Client Success',
    capacity: 40,
    utilization: 78,
    focus: 'Northstar expansion',
    mood: 'steady',
    tasks: 18,
  },
  {
    id: 'tm-omar',
    name: 'Omar Reyes',
    role: 'Senior Producer',
    department: 'Production',
    capacity: 38,
    utilization: 94,
    focus: 'Helio launch recovery',
    mood: 'loaded',
    tasks: 27,
  },
  {
    id: 'tm-lina',
    name: 'Lina Park',
    role: 'Creative Lead',
    department: 'Design',
    capacity: 36,
    utilization: 92,
    focus: 'Arc social system',
    mood: 'loaded',
    tasks: 31,
  },
  {
    id: 'tm-theo',
    name: 'Theo Morgan',
    role: 'Finance Ops',
    department: 'Revenue',
    capacity: 34,
    utilization: 64,
    focus: 'Collections and MRR',
    mood: 'open',
    tasks: 11,
  },
]

export const mediaAssets: MediaAsset[] = [
  {
    id: 'media-01',
    name: 'Northstar launch film final.mov',
    client: 'Northstar Labs',
    type: 'Video',
    version: 'v7',
    status: 'Approved',
    comments: 42,
    size: '4.8GB',
  },
  {
    id: 'media-02',
    name: 'Helio investor deck master.fig',
    client: 'Helio Capital',
    type: 'Design',
    version: 'v12',
    status: 'In review',
    comments: 18,
    size: '326MB',
  },
  {
    id: 'media-03',
    name: 'Arc creator product shots.zip',
    client: 'Arc Studio',
    type: 'Photography',
    version: 'v3',
    status: 'Needs changes',
    comments: 9,
    size: '1.2GB',
  },
]

export const invoices: InvoiceRecord[] = [
  {
    id: 'INV-2048',
    client: 'Helio Capital',
    amount: '$42,000',
    status: 'Overdue',
    due: 'May 08',
    trend: '18 day average payment',
    linkedCampaign: 'Q3 investor launch system',
  },
  {
    id: 'INV-2049',
    client: 'Northstar Labs',
    amount: '$74,000',
    status: 'Paid',
    due: 'May 10',
    trend: 'Paid in 2 days',
    linkedCampaign: 'AI product narrative sprint',
  },
  {
    id: 'INV-2050',
    client: 'Arc Studio',
    amount: '$28,000',
    status: 'Due',
    due: 'May 17',
    trend: 'On schedule',
    linkedCampaign: 'Monthly content engine',
  },
  {
    id: 'INV-2051',
    client: 'Vale Foods',
    amount: '$12,000',
    status: 'Draft',
    due: 'May 20',
    trend: 'Generated from approved files',
    linkedCampaign: 'Retail shelf launch kit',
  },
]

export const communications: CommunicationItem[] = [
  {
    id: 'comm-1',
    author: 'Maya Chen',
    channel: '#northstar-launch',
    message: 'Client approved launch copy. Paid media handoff can move today.',
    time: '2 min',
    entity: 'Northstar Labs',
  },
  {
    id: 'comm-2',
    author: 'TASKIT Brain',
    channel: '#ops-alerts',
    message: 'Helio approval chain has crossed the delay threshold. Recovery workflow drafted.',
    time: '8 min',
    entity: 'Helio Capital',
  },
  {
    id: 'comm-3',
    author: 'Theo Morgan',
    channel: '#finance',
    message: 'Invoice reminder queued with Stripe payment link and account owner context.',
    time: '17 min',
    entity: 'INV-2048',
  },
  {
    id: 'comm-4',
    author: 'Lina Park',
    channel: '#creative-review',
    message: 'Arc product photography v3 has annotations. Waiting on packaging corrections.',
    time: '24 min',
    entity: 'Arc Studio',
  },
]

export const reportSeries: ReportBar[] = [
  { label: 'Jan', revenue: 46, productivity: 62, satisfaction: 78 },
  { label: 'Feb', revenue: 52, productivity: 66, satisfaction: 80 },
  { label: 'Mar', revenue: 58, productivity: 69, satisfaction: 83 },
  { label: 'Apr', revenue: 71, productivity: 74, satisfaction: 86 },
  { label: 'May', revenue: 83, productivity: 82, satisfaction: 88 },
  { label: 'Jun', revenue: 92, productivity: 86, satisfaction: 91 },
]

export const onboardingSteps = [
  { label: 'Workspace identity', status: 'Complete' },
  { label: 'Client import', status: 'Complete' },
  { label: 'Stripe billing', status: 'Connected' },
  { label: 'AI policy scope', status: 'Audited' },
  { label: 'Automation review', status: 'Pending' },
]

export const integrationTiles = [
  'Supabase',
  'PostgreSQL',
  'Stripe',
  'OpenAI',
  'Gemini',
  'Slack',
  'Figma',
  'Drive',
  'Calendar',
  'Vercel',
]
