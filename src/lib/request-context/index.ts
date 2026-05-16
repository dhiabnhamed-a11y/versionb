import type { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/request-id'
import type { SessionUser } from '@/modules/shared/session'

export type TenantRequestContext = {
  actorId?: string
  companyId?: string
  ip: string
  method: string
  requestId: string
  route: string
  startedAt: number
  user?: SessionUser
}

function getClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-real-ip')?.trim() || forwarded || 'unknown'
}

export function createRequestContext(req: NextRequest, user?: SessionUser, route = req.nextUrl.pathname): TenantRequestContext {
  return {
    actorId: user?.id,
    companyId: user?.companyId ?? undefined,
    ip: getClientIp(req),
    method: req.method,
    requestId: getRequestId(req),
    route,
    startedAt: Date.now(),
    user,
  }
}

export function requestDurationMs(context: Pick<TenantRequestContext, 'startedAt'>) {
  return Date.now() - context.startedAt
}
