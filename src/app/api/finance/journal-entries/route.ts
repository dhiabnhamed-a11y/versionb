import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createJournalEntry, listJournalEntries } from '@/modules/accounting/accounting.service'
import { parsePagination } from '@/modules/shared/pagination'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const pagination = parsePagination(req, { pageSize: 30, maxPageSize: 100 })
      return apiData(await listJournalEntries(user, pagination))
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createJournalEntry(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
