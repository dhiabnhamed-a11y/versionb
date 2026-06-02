import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { listWorkspaceConnectedAccounts } from '@/modules/integrations/services/integration.service'

export const runtime = 'nodejs'

export async function GET() {
  return withApiError(async () => {
    const user = await requireSessionUser()
    const accounts = await listWorkspaceConnectedAccounts(user)
    return okJson({ accounts })
  })
}
