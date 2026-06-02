import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { closeFinancialPeriod } from '@/modules/accounting/accounting.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await closeFinancialPeriod(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
