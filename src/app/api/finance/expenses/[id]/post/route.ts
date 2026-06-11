import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { postExpense } from '@/modules/expenses/expense.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await postExpense(user, (params.id as string))),
    { auth: 'required', responseMode: 'legacy' }
  )
}
