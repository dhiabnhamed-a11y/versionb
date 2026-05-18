import { NextRequest, NextResponse } from 'next/server'
import { cached } from '@/lib/cache'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { INFRA } from '@/lib/infra/config'
import { NO_STORE_HEADERS } from '@/lib/http'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { buildOperationalCommandCenter } from '@/modules/operations/operational-intelligence.service'
import { requireSessionUser } from '@/modules/shared/session'
import { recordDuration } from '@/lib/observability'

export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  const rate = await enforceDistributedRateLimit(req, API_RATE_LIMITS.read)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS })
  }

  const user = await requireSessionUser()
  const cacheKey = `command-center:${user.companyId ?? 'none'}:${user.role ?? 'unknown'}`

  const commandCenter = await cached(cacheKey, INFRA.commandCenterCacheTtlSec, () =>
    buildOperationalCommandCenter({
      id: user.id,
      role: user.role,
      companyId: user.companyId,
    })
  )

  recordDuration('command_center', startedAt, { companyId: user.companyId ?? null })
  return NextResponse.json(commandCenter, { headers: NO_STORE_HEADERS })
}
