import 'server-only'

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

export const AI_TOOL_REGISTRY: Record<string, AiToolDefinition> = {
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

export function listAiTools() {
  return Object.values(AI_TOOL_REGISTRY)
}

export function getAiToolByName(name: string) {
  return AI_TOOL_REGISTRY[name] ?? null
}

export function getAiToolForActionKind(actionKind: string) {
  return Object.values(AI_TOOL_REGISTRY).find((tool) => tool.actionKinds.includes(actionKind)) ?? null
}
