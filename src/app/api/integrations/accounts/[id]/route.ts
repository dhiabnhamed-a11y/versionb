import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, withApiError } from '@/modules/shared/api'
import { disconnectWorkspaceConnectedAccount } from '@/modules/integrations/services/integration.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const DELETE = withApiHandler(async ({ req, params }) => {
return withApiError(async () => {
const user = await requireSessionUser()
const { id } = await ctx.params
const account = await disconnectWorkspaceConnectedAccount(user, id)
return okJson({ account })
})
}, { auth: 'required' });
