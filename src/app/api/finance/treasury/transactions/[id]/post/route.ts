import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { postTreasuryTransaction } from '@/modules/treasury/treasury.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await postTreasuryTransaction(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
