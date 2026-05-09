import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const CLIENT_STATUSES = ['active', 'inactive'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export type BillingSessionUser = {
  id: string
  role?: string | null
  companyId?: string | null
}

export function canManageClients(user: BillingSessionUser) {
  return user.role === 'OWNER' || user.role === 'MANAGER'
}

export function normalizeClientStatus(value: unknown): ClientStatus {
  return value === 'inactive' ? 'inactive' : 'active'
}

export function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function nullableText(value: unknown) {
  const text = cleanText(value)
  return text || null
}

export function serializeDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : null
}

export function serializeClient<T extends Record<string, unknown>>(client: T) {
  return {
    ...client,
    createdAt: serializeDate(client.createdAt as Date | string | null | undefined),
    updatedAt: serializeDate(client.updatedAt as Date | string | null | undefined),
  }
}

export async function findClientForCompany(clientId: string | null | undefined, companyId: string) {
  if (!clientId) return null

  return prisma.client.findFirst({
    where: { id: clientId, companyId },
  })
}

export async function logClientActivity(input: {
  companyId: string
  clientId: string | null | undefined
  actorId?: string | null
  type: string
  title: string
  body?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  if (!input.clientId) return null

  return prisma.clientActivity.create({
    data: {
      companyId: input.companyId,
      clientId: input.clientId,
      actorId: input.actorId || null,
      type: input.type,
      title: input.title,
      body: input.body || null,
      metadata: input.metadata ?? undefined,
    },
  })
}

export function getClientDisplayName(client: { companyName?: string | null; contactPerson?: string | null } | null | undefined) {
  return client?.companyName || client?.contactPerson || 'Client'
}
