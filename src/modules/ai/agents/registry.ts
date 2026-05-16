import type { AiToolPermission } from '@/modules/ai/tools/types'

export type OperationalAgentKey =
  | 'cfo'
  | 'operations'
  | 'project_manager'
  | 'finance_auditor'
  | 'workflow'
  | 'client_success'
  | 'delivery_risk'
  | 'executive_briefing'
  | 'contract'
  | 'approval'

export type OperationalAgentDefinition = {
  key: OperationalAgentKey
  displayName: string
  mission: string
  toolKeys: string[]
  permissions: AiToolPermission[]
  memoryScope: 'finance' | 'operations' | 'delivery' | 'client' | 'contract' | 'executive'
}

export const OPERATIONAL_AI_AGENTS: Record<OperationalAgentKey, OperationalAgentDefinition> = {
  cfo: {
    key: 'cfo',
    displayName: 'CFO Agent',
    mission: 'Cash, margin, revenue, collections, budgets, forecasts, and finance-risk decisions.',
    toolKeys: ['create_invoice', 'mark_invoice_paid', 'create_budget', 'generate_financial_report'],
    permissions: ['finance.manage', 'reports.generate'],
    memoryScope: 'finance',
  },
  operations: {
    key: 'operations',
    displayName: 'Operations Agent',
    mission: 'Cross-functional delivery flow, blockers, utilization, escalations, and operating cadence.',
    toolKeys: ['create_project_plan', 'assign_task', 'create_workflow_rule'],
    permissions: ['workspace.manage', 'projects.manage', 'tasks.manage'],
    memoryScope: 'operations',
  },
  project_manager: {
    key: 'project_manager',
    displayName: 'Project Manager Agent',
    mission: 'Campaign plans, tasks, assignments, dates, review loops, and delivery readiness.',
    toolKeys: ['create_project_plan', 'assign_task', 'create_brief'],
    permissions: ['projects.manage', 'tasks.manage'],
    memoryScope: 'delivery',
  },
  finance_auditor: {
    key: 'finance_auditor',
    displayName: 'Finance Auditor Agent',
    mission: 'Approval controls, financial anomalies, audit trails, and policy compliance.',
    toolKeys: ['approve_expense', 'generate_financial_report'],
    permissions: ['finance.manage', 'approvals.manage'],
    memoryScope: 'finance',
  },
  workflow: {
    key: 'workflow',
    displayName: 'Workflow Agent',
    mission: 'Event-driven rules, workflow recovery, retries, SLA timers, and escalation paths.',
    toolKeys: ['create_workflow_rule'],
    permissions: ['workflows.manage'],
    memoryScope: 'operations',
  },
  client_success: {
    key: 'client_success',
    displayName: 'Client Success Agent',
    mission: 'Client health, preferences, inactivity, reminders, and account handoffs.',
    toolKeys: ['create_client', 'send_client_reminder'],
    permissions: ['workspace.manage', 'alerts.send'],
    memoryScope: 'client',
  },
  delivery_risk: {
    key: 'delivery_risk',
    displayName: 'Delivery Risk Agent',
    mission: 'Late work, overloaded teams, blocked deliverables, and delivery-risk scoring.',
    toolKeys: ['assign_task', 'create_project_plan'],
    permissions: ['projects.manage', 'tasks.manage'],
    memoryScope: 'delivery',
  },
  executive_briefing: {
    key: 'executive_briefing',
    displayName: 'Executive Briefing Agent',
    mission: 'Concise operating summaries, decisions needed, risk posture, and next actions.',
    toolKeys: ['generate_financial_report'],
    permissions: ['reports.generate'],
    memoryScope: 'executive',
  },
  contract: {
    key: 'contract',
    displayName: 'Contract Agent',
    mission: 'Contract drafting, source context, clause governance, and approval readiness.',
    toolKeys: ['generate_contract'],
    permissions: ['contracts.manage'],
    memoryScope: 'contract',
  },
  approval: {
    key: 'approval',
    displayName: 'Approval Agent',
    mission: 'Approval routing, expiration, escalation, and reversible action governance.',
    toolKeys: ['approve_expense', 'mark_invoice_paid', 'create_workflow_rule'],
    permissions: ['approvals.manage'],
    memoryScope: 'operations',
  },
}
