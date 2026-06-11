import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { initializeRecommendedFinanceWorkspace } from '@/modules/finance/setup.service'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => apiData(await initializeRecommendedFinanceWorkspace(user), { status: 201 }),
    { auth: 'required', responseMode: 'legacy' }
  )
}

