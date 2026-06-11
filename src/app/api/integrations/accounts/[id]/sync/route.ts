import { NextRequest } from 'next/server'
import { requireSessionUser } from '@/modules/shared/session'
import { okJson, parseJsonObject, withApiError } from '@/modules/shared/api'
import { enqueueManualAccountSync } from '@/modules/integrations/services/integration.service'
import { manualSyncSchema } from '@/modules/integrations/services/integration.validation'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return withApiError(async () => {
const user = await requireSessionUser()
const { id } = await params as { id: string }
const body = await parseJsonObject(req)
const input = manualSyncSchema.parse(body)
const result = await enqueueManualAccountSync(user, id, input)
return okJson(result)
})
}, { auth: 'required' });
