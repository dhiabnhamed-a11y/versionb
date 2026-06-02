import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, parseJsonObject, withApiError } from '@/modules/shared/api'
import { enqueueManualAccountSync } from '@/modules/integrations/services/integration.service'
import { manualSyncSchema } from '@/modules/integrations/services/integration.validation'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/integrations/accounts/[id]/sync'>) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await ctx.params
    const body = await parseJsonObject(req)
    const input = manualSyncSchema.parse(body)
    const result = await enqueueManualAccountSync(user, id, input)
    return okJson(result)
  })
}
