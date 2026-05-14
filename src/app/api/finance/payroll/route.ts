import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createPayrollRun, listPayrollRuns } from '@/modules/payroll/payroll.service'
import { parsePagination } from '@/modules/shared/pagination'

export async function GET(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await listPayrollRuns(user, parsePagination(req, { pageSize: 20, maxPageSize: 100 }))),
    { auth: 'required', responseMode: 'legacy' }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createPayrollRun(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
