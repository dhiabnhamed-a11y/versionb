import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { reimburseExpense } from '@/modules/expenses/expense.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await reimburseExpense(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
