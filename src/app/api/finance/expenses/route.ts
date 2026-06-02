import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createExpense, listExpenses } from '@/modules/expenses/expense.service'
import { parsePagination } from '@/modules/shared/pagination'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listExpenses(user, parsePagination(req, { pageSize: 30, maxPageSize: 100 }))),
    { auth: 'required', responseMode: 'legacy' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createExpense(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
