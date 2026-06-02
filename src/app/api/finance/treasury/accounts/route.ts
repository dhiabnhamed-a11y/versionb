import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createTreasuryAccount, listTreasuryAccounts } from '@/modules/treasury/treasury.service'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => apiData(await listTreasuryAccounts(user)), {
    auth: 'required',
    responseMode: 'legacy',
  })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      return apiData(await createTreasuryAccount(user, body), { status: 201 })
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
