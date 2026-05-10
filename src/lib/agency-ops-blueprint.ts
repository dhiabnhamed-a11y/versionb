export type OpsModule = {
  id: string
  title: string
  eyebrow: string
  description: string
  metric: string
  status: string
  features: string[]
}

export const opsModules: OpsModule[] = [
  {
    id: 'command',
    title: 'Operations Command',
    eyebrow: 'Executive cockpit',
    description: 'Revenue, delivery health, workload, approvals, and risk signals in one fast workspace.',
    metric: '94%',
    status: 'Portfolio health',
    features: ['Project health scoring', 'Deadline pressure', 'Profitability trend', 'AI daily brief'],
  },
  {
    id: 'clients',
    title: 'Client CRM',
    eyebrow: 'Relationship system',
    description: 'Accounts, contacts, projects, invoices, requests, files, notes, and activity history.',
    metric: '128',
    status: 'Active accounts',
    features: ['Contacts and stakeholders', 'Client health', 'Communication log', 'Asset vault'],
  },
  {
    id: 'projects',
    title: 'Project Studio',
    eyebrow: 'Delivery engine',
    description: 'Kanban, list, calendar, timeline, milestones, dependencies, labels, comments, and logs.',
    metric: '41',
    status: 'Live projects',
    features: ['Kanban and timeline', 'Dependencies', 'Custom statuses', 'Milestone tracking'],
  },
  {
    id: 'portal',
    title: 'Client Portal',
    eyebrow: 'White-label portal',
    description: 'Clients review progress, upload files, approve work, comment, and download reports.',
    metric: '18',
    status: 'Waiting approvals',
    features: ['Approval center', 'Invoice review', 'Request intake', 'Branded experience'],
  },
  {
    id: 'billing',
    title: 'Billing Hub',
    eyebrow: 'Invoice and payments',
    description: 'Invoice creation, recurring billing, taxes, discounts, reminders, PDFs, Stripe, and PayPal.',
    metric: '$284k',
    status: 'MRR managed',
    features: ['Recurring invoices', 'Payment status', 'Overdue workflow', 'PDF export'],
  },
  {
    id: 'automation',
    title: 'Automation Builder',
    eyebrow: 'No-code workflows',
    description: 'Trigger-based automations that create projects, tasks, reminders, invoices, and reports.',
    metric: '2.8k',
    status: 'Actions automated',
    features: ['Trigger builder', 'Conditions', 'Workflow graph', 'Run history'],
  },
  {
    id: 'assistant',
    title: 'AI Assistant',
    eyebrow: 'Contextual intelligence',
    description: 'Summaries, task generation, delayed-project detection, invoice copy, reports, and search.',
    metric: '7.4h',
    status: 'Saved per manager/week',
    features: ['Brief to tasks', 'Project summaries', 'Client insights', 'Smart recommendations'],
  },
  {
    id: 'resources',
    title: 'Resource Planning',
    eyebrow: 'Capacity control',
    description: 'Availability, utilization, workload pressure, productivity, SLA, and profitability signals.',
    metric: '82%',
    status: 'Utilization',
    features: ['Capacity map', 'Workload balancing', 'SLA tracking', 'Team performance'],
  },
]

export const automationBlueprint = [
  {
    trigger: 'Client created',
    condition: 'Service tier is retained or enterprise',
    action: 'Create workspace, portal, kickoff project, and onboarding brief',
  },
  {
    trigger: 'Brief accepted',
    condition: 'Budget and due date are present',
    action: 'Create project, milestones, deliverables, tasks, and assignee notifications',
  },
  {
    trigger: 'Project completed',
    condition: 'All deliverables are approved',
    action: 'Generate invoice draft, attach approved files, and notify finance',
  },
  {
    trigger: 'Invoice overdue',
    condition: 'Due date is more than 3 days old',
    action: 'Send reminder, notify account owner, and update client health score',
  },
]

export const roleMatrix = [
  { role: 'Owner', scope: 'Everything', permissions: 'Billing, settings, roles, white label, exports, audit logs' },
  { role: 'Admin', scope: 'Workspace', permissions: 'Clients, projects, team, automations, invoices, reports' },
  { role: 'Manager', scope: 'Assigned portfolios', permissions: 'Projects, tasks, resources, approvals, reports' },
  { role: 'Team Member', scope: 'Assigned work', permissions: 'Tasks, files, comments, time tracking, internal notes' },
  { role: 'Client', scope: 'Portal only', permissions: 'Requests, uploads, comments, approvals, invoices, reports' },
]

export const architectureLayers = [
  'Next.js App Router with Server Components for authenticated first paint',
  'TypeScript domain modules for workspace, CRM, projects, billing, automation, AI, and analytics',
  'Prisma ORM with PostgreSQL tenant isolation through workspace-scoped queries',
  'Route handlers as backend-for-frontend APIs with validation, policy checks, and audit logging',
  'Event-driven workflow evaluator for notifications, automations, invoice reminders, and reports',
  'Realtime collaboration channel for comments, approvals, activity, and notification updates',
  'Background workers for recurring invoices, overdue reminders, analytics rollups, and AI summaries',
]
