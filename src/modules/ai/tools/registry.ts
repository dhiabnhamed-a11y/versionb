import 'server-only'

import { z } from 'zod'
import type { AiToolDefinition } from '@/modules/ai/tools/types'

const sharedPromptSchema = {
  canonicalMessage: {
    type: 'string',
    required: true,
    description: 'The canonical user instruction after multilingual intent resolution.',
  },
  rawMessage: {
    type: 'string',
    required: true,
    description: 'The original user instruction for audit traceability.',
  },
} satisfies AiToolDefinition['schema']['input']

const sharedPromptZodSchema = z.object({
  canonicalMessage: z.string().trim().min(1).max(4000),
  rawMessage: z.string().trim().min(1).max(4000),
})

const genericToolOutputSchema = z.object({
  dryRun: z.boolean().optional(),
  summary: z.string().optional(),
  receiptId: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

function toolKey(name: string) {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '')
}

function withEnterpriseDefaults(tool: AiToolDefinition): AiToolDefinition {
  return {
    key: tool.key ?? toolKey(tool.name),
    inputSchema: tool.inputSchema ?? sharedPromptZodSchema,
    outputSchema: tool.outputSchema ?? genericToolOutputSchema,
    idempotency: tool.idempotency ?? {
      required: tool.mutating,
      scope: 'company',
      keyFields: ['toolName', 'actionKind', 'canonicalMessage'],
    },
    execution: tool.execution ?? {
      mode: tool.riskLevel === 'LOW' ? 'sync' : 'hybrid',
      queue: tool.riskLevel === 'LOW' ? undefined : 'ai-execution',
      maxAttempts: tool.riskLevel === 'CRITICAL' ? 1 : 3,
      timeoutMs: tool.riskLevel === 'LOW' ? 15_000 : 60_000,
    },
    emitsEvents: tool.emitsEvents ?? [tool.audit.event],
    confirmation: tool.confirmation ?? {
      requiredForRisk: ['MEDIUM', 'HIGH', 'CRITICAL'],
      expiresInMinutes: 10,
    },
    ...tool,
  }
}

const RAW_AI_TOOL_REGISTRY: Record<string, AiToolDefinition> = {
  createClient: {
    name: 'createClient',
    displayName: 'Create client',
    description: 'Create a tenant-scoped client profile and initial client activity.',
    actionKinds: ['client'],
    permissions: ['workspace.manage'],
    riskLevel: 'MEDIUM',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 8 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'client', event: 'ai.client.create' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures the proposed client fields before creation; deletion after execution requires manual confirmation.',
    },
  },
  createProject: {
    name: 'createProject',
    displayName: 'Create campaign',
    description: 'Create a project/campaign and initialize its operational brief.',
    actionKinds: ['campaign'],
    permissions: ['workspace.manage'],
    riskLevel: 'MEDIUM',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 8 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'project', event: 'ai.project.create' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures proposed project fields and starter brief context before execution.',
    },
  },
  generateBrief: {
    name: 'generateBrief',
    displayName: 'Generate brief',
    description: 'Create a draft campaign brief from operational context.',
    actionKinds: ['brief'],
    permissions: ['workspace.manage'],
    riskLevel: 'LOW',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 12 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'brief', event: 'ai.brief.generate' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures proposed brief fields before execution.',
    },
  },
  createInvoice: {
    name: 'createInvoice',
    displayName: 'Create invoice',
    description: 'Create a draft invoice with validated client, line item, currency, due date, and totals.',
    actionKinds: ['invoice'],
    permissions: ['finance.manage'],
    riskLevel: 'HIGH',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 6 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'finance', event: 'ai.invoice.create' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures draft invoice totals and line items; executed invoices can be voided or deleted only through governed finance flows.',
    },
  },
  markInvoicePaid: {
    name: 'markInvoicePaid',
    displayName: 'Mark invoice paid',
    description: 'Update an invoice payment status and paid timestamp.',
    actionKinds: ['mark_invoice_paid'],
    permissions: ['finance.manage'],
    riskLevel: 'CRITICAL',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 4 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'finance', event: 'ai.invoice.mark_paid' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures invoice status, paidAt, and sentAt before the payment mutation.',
    },
  },
  assignTask: {
    name: 'assignTask',
    displayName: 'Assign task',
    description: 'Assign an existing task to a workspace member through the task service.',
    actionKinds: ['assign_task'],
    permissions: ['tasks.manage'],
    riskLevel: 'MEDIUM',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 10 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'task', event: 'ai.task.assign' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures the previous assignee and assignment reason.',
    },
  },
  generateContract: {
    name: 'generateContract',
    displayName: 'Generate contract',
    description: 'Generate a draft contract from approved client, pricing, and delivery context.',
    actionKinds: ['generate_contract'],
    permissions: ['contracts.manage'],
    riskLevel: 'HIGH',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 4 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'contract', event: 'ai.contract.generate' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Generated contracts remain drafts; rollback metadata captures draft identifiers and source context.',
    },
  },
  approveExpense: {
    name: 'approveExpense',
    displayName: 'Approve expense',
    description: 'Approve an expense through the finance approval service.',
    actionKinds: ['approve_expense'],
    permissions: ['finance.manage', 'approvals.manage'],
    riskLevel: 'CRITICAL',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 3 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'finance', event: 'ai.expense.approve' },
    rollback: {
      strategy: 'compensating_action',
      notes: 'Rollback is a governed reversal or escalation through finance controls, not a silent status rewrite.',
    },
  },
  createBudget: {
    name: 'createBudget',
    displayName: 'Create budget',
    description: 'Create a draft budget from financial planning context.',
    actionKinds: ['create_budget'],
    permissions: ['finance.manage'],
    riskLevel: 'HIGH',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 4 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'finance', event: 'ai.budget.create' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures the draft budget, period, owner, and line-level assumptions.',
    },
  },
  createProjectPlan: {
    name: 'createProjectPlan',
    displayName: 'Create project plan',
    description: 'Create a governed project plan with tasks, owners, dates, and delivery risks.',
    actionKinds: ['create_project_plan'],
    permissions: ['projects.manage', 'tasks.manage'],
    riskLevel: 'MEDIUM',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 6 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'project', event: 'ai.project_plan.create' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures created task identifiers and plan assumptions.',
    },
  },
  generateFinancialReport: {
    name: 'generateFinancialReport',
    displayName: 'Generate financial report',
    description: 'Generate an auditable financial report from permitted accounting, invoice, and treasury context.',
    actionKinds: ['generate_financial_report'],
    permissions: ['finance.manage', 'reports.generate'],
    riskLevel: 'LOW',
    mutating: false,
    requiresConfirmation: false,
    supportsDryRun: true,
    supportsRollback: false,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 8 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'finance', event: 'ai.financial_report.generate' },
    rollback: {
      strategy: 'manual_review',
      notes: 'Reports are read-only artifacts; generated outputs can be superseded with a corrected report.',
    },
  },
  createWorkflowRule: {
    name: 'createWorkflowRule',
    displayName: 'Create workflow rule',
    description: 'Create a disabled workflow rule draft for event-driven operational automation.',
    actionKinds: ['create_workflow_rule'],
    permissions: ['workflows.manage'],
    riskLevel: 'HIGH',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 4 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'workflow', event: 'ai.workflow_rule.create' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Workflow rules are created disabled by default; rollback metadata captures rule definition and trigger scope.',
    },
  },
  sendClientReminder: {
    name: 'sendClientReminder',
    displayName: 'Send payment reminders',
    description: 'Create in-app payment deadline alerts for due or overdue invoices.',
    actionKinds: ['payment_alerts'],
    permissions: ['finance.manage', 'alerts.send'],
    riskLevel: 'HIGH',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: false,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 3 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'finance', event: 'ai.payment_deadline_alerts.send' },
    rollback: {
      strategy: 'manual_review',
      notes: 'Alerts are delivery artifacts. The preview suppresses duplicates; executed notifications require manual follow-up if mistaken.',
    },
  },
  deleteWorkspaceRecord: {
    name: 'deleteWorkspaceRecord',
    displayName: 'Delete workspace record',
    description: 'Delete a tenant-scoped operational record using the existing service graph deletion rules.',
    actionKinds: ['delete_invoice', 'delete_client', 'delete_campaign', 'delete_brief', 'delete_deliverable', 'delete_task', 'delete_category', 'delete_room'],
    permissions: ['workspace.manage', 'records.delete'],
    riskLevel: 'CRITICAL',
    mutating: true,
    requiresConfirmation: true,
    supportsDryRun: true,
    supportsRollback: true,
    tenantScoped: true,
    rateLimit: { windowSeconds: 60, max: 2 },
    schema: { input: sharedPromptSchema },
    audit: { category: 'destructive', event: 'ai.record.delete' },
    rollback: {
      strategy: 'metadata_snapshot',
      notes: 'Rollback metadata captures target identifiers and labels before graph deletion. Full restore may require backup recovery.',
    },
  },
}

export const AI_TOOL_REGISTRY: Record<string, AiToolDefinition> = Object.fromEntries(
  Object.entries(RAW_AI_TOOL_REGISTRY).map(([key, tool]) => [key, withEnterpriseDefaults(tool)])
)

export function listAiTools() {
  return Object.values(AI_TOOL_REGISTRY)
}

export function getAiToolByName(name: string) {
  return AI_TOOL_REGISTRY[name] ?? null
}

export function getAiToolForActionKind(actionKind: string) {
  return Object.values(AI_TOOL_REGISTRY).find((tool) => tool.actionKinds.includes(actionKind)) ?? null
}
