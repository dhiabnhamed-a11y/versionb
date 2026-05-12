import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { disconnectWorkspaceConnectedAccount } from '@/modules/integrations/services/integration.service'

export async function DELETE(_req: NextRequest, ctx: RouteContext<'/api/integrations/accounts/[id]'>) {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const { id } = await ctx.params
    const account = await disconnectWorkspaceConnectedAccount(user, id)
    return okJson({ account })
  })
}
