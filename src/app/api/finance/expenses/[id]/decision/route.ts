import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { decideExpense } from '@/modules/expenses/expense.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await decideExpense(user, (params.id as string), body))
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
