import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createErpJournalEntry, listErpJournalEntries } from '@/services/erp'
import { parsePagination } from '@/modules/shared/pagination'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const result = await listErpJournalEntries(user, parsePagination(req, { pageSize: 30, maxPageSize: 100 }))
      return apiData(result, { code: 'ERP_JOURNAL_ENTRIES_LISTED', pagination: result.pagination })
    },
    { auth: 'required', responseMode: 'canonical', route: '/api/v1/erp/journal-entries' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createErpJournalEntry(user, body), { code: 'ERP_JOURNAL_ENTRY_CREATED', status: 201 })
    },
    {
      auth: 'required',
      idempotency: { responseStatus: 201 },
      responseMode: 'canonical',
      route: '/api/v1/erp/journal-entries',
    }
  )
}
