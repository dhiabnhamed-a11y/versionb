import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createTreasuryTransaction, listTreasuryTransactions } from '@/modules/treasury/treasury.service'
import { parsePagination } from '@/modules/shared/pagination'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listTreasuryTransactions(user, parsePagination(req, { pageSize: 30, maxPageSize: 100 }))),
    { auth: 'required', responseMode: 'legacy' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createTreasuryTransaction(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
