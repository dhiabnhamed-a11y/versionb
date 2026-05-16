import { emitCompanyRealtime } from '@/lib/realtime-server'
import { badRequest, forbidden } from '@/modules/shared/errors'
import { offsetPaginationMeta } from '@/lib/pagination'
import { clientCreateSchema, type ClientCreateInput } from '@/modules/clients/validation'
import { canManageClients } from '@/modules/clients/policy'
import { createClientForCompany, listClientsForCompany, logClientActivity } from '@/modules/clients/repository'

export {
  cleanText,
  getClientDisplayName,
  normalizeClientStatus,
  nullableText,
  serializeDate,
} from '@/lib/clients'

import {
  cleanText,
  normalizeClientStatus,
  nullableText,
  serializeClient,
  type BillingSessionUser,
} from '@/lib/clients'

function requireClientCompany(user: BillingSessionUser) {
  if (!user.companyId) throw badRequest('No company found for this account')
  return user.companyId
}

function assertClientAccess(user: BillingSessionUser) {
  if (!canManageClients(user)) throw forbidden()
}

export async function listClients(
  user: BillingSessionUser,
  filters: { query?: string | null; status?: string | null },
  pagination: { page: number; pageSize: number; skip: number }
) {
  if (!user.companyId) {
    return {
      items: [],
      pagination: offsetPaginationMeta({
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: 0,
      }),
      summary: {
        activeCount: 0,
        inactiveCount: 0,
        unpaidTotal: 0,
      },
    }
  }

  const companyId = user.companyId
  assertClientAccess(user)

  const result = await listClientsForCompany({
    companyId,
    pageSize: pagination.pageSize,
    query: cleanText(filters.query),
    skip: pagination.skip,
    status: filters.status,
  })

  return {
    items: result.clients.map((client) => ({
      ...serializeClient(client),
      invoices: undefined,
      unpaidTotal: client.invoices.reduce((sum, invoice) => sum + Number(invoice.total), 0),
    })),
    pagination: offsetPaginationMeta({
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: result.total,
    }),
    summary: {
      activeCount: result.activeCount,
      inactiveCount: result.inactiveCount,
      unpaidTotal: result.unpaidTotal,
    },
  }
}

export async function createClient(user: BillingSessionUser, rawInput: unknown) {
  const companyId = requireClientCompany(user)
  assertClientAccess(user)

  const input: ClientCreateInput = clientCreateSchema.parse(rawInput)
  const companyName = cleanText(input.companyName)
  if (!companyName) throw badRequest('Company name is required.')

  const client = await createClientForCompany({
    address: nullableText(input.address),
    avatarUrl: nullableText(input.avatarUrl),
    companyId,
    companyName,
    contactPerson: nullableText(input.contactPerson),
    country: nullableText(input.country),
    email: nullableText(input.email)?.toLowerCase() ?? null,
    notes: nullableText(input.notes),
    phone: nullableText(input.phone),
    status: normalizeClientStatus(input.status),
    userId: user.id,
  })

  const serialized = { ...serializeClient(client), unpaidTotal: 0 }
  emitCompanyRealtime(companyId, 'client_created', { client: serialized })
  await logClientActivity({
    actorId: user.id,
    body: 'Projects, deliverables, invoices, and notes can now be tracked from this profile.',
    clientId: client.id,
    companyId,
    title: 'Client profile is ready',
    type: 'client.profile_ready',
  })

  return serialized
}
