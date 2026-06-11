import { NextRequest } from 'next/server'
import { cached } from '@/lib/cache'
import { INFRA } from '@/lib/infra/config'
import { buildOperationalCommandCenter } from '@/modules/operations/operational-intelligence.service'
import { requireSessionUser } from '@/modules/shared/session'
import { recordDuration } from '@/lib/observability'
import { okJson, withApiError } from '@/modules/shared/api'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
const startedAt = Date.now()

return withApiError(req, async () => {
const user = await requireSessionUser(req)
const cacheKey = `command-center:${user.companyId ?? 'none'}:${user.role ?? 'unknown'}`

const commandCenter = await cached(cacheKey, INFRA.commandCenterCacheTtlSec, () =>
  buildOperationalCommandCenter({
    id: user.id,
    role: user.role,
    companyId: user.companyId,
  })
)

recordDuration('command_center', startedAt, { companyId: user.companyId ?? null })
return okJson(commandCenter)
}, { route: '/api/operations/command-center' })
}, { auth: 'required' });
