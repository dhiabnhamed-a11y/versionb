import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { listIntegrationProviders } from '@/modules/integrations/services/integration.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return withApiError(async () => {
const user = await requireSessionUser()
const providers = await listIntegrationProviders(user)
return okJson({ providers })
})
}, { auth: 'required' });
