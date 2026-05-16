import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createAsset, listAssets } from '@/modules/enterprise/enterprise.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleApiRoute(req, undefined, async ({ user }) => apiData(await listAssets(user)), {
    auth: 'required',
    responseMode: 'canonical',
  })
}

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user, requestId }) => {
      const body = await parseJsonObject(req)
      return apiData(await createAsset(user, body, requestId), { status: 201 })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
