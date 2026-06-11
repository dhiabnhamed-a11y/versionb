import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { postTreasuryTransaction } from '@/modules/treasury/treasury.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await postTreasuryTransaction(user, (params.id as string))),
    { auth: 'required', responseMode: 'legacy' }
  )
}
