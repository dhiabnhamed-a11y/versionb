import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { generateContractForClient, listClientContracts } from '@/modules/contracts/contract.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData({ items: await listClientContracts(user, (params.id as string)) }),
    { auth: 'required', responseMode: 'legacy' }
  )
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, requestId, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await generateContractForClient(user, { ...body, clientId: params.id }, requestId), { status: 201 })
    },
    {
      auth: 'required',
      responseMode: 'legacy',
      rateLimit: {
        namespace: 'contracts.generate',
        windowMs: 60_000,
        max: 8,
      },
    }
  )
}
