import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { prisma } from '@/lib/db'
import { badRequest, forbidden } from '@/modules/shared/errors'
import { enqueueRealtimeDelivery } from '@/modules/realtime/events/delivery'
import { REALTIME_EVENTS } from '@/lib/realtime-events'
import type { RealtimeDeliveryTarget } from '@/modules/realtime/events/contracts'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const broadcastTargetSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('workspace') }),
  z.object({ scope: z.literal('department'), departmentId: z.string().min(1).max(128) }),
  z.object({ scope: z.literal('user'), userId: z.string().min(1).max(128) }),
])

const broadcastBodySchema = z.object({
  type: z.enum(REALTIME_EVENTS),
  payload: z.record(z.string(), z.unknown()).default({}),
  target: broadcastTargetSchema.default({ scope: 'workspace' }),
})

type BroadcastResult = {
  enqueued: number
  envelopeId?: string
  envelopeIds?: string[]
  eventType: string
  targetScope: string
  departmentId?: string
  sentAt: string
}

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }): Promise<ReturnType<typeof apiData<BroadcastResult>>> => {
  const body = await req.json().catch(() => ({}))
  const parsed = broadcastBodySchema.safeParse(body)
  if (!parsed.success) throw badRequest('Invalid request body.', parsed.error.flatten())

  const { type, payload, target } = parsed.data
  const companyId = user.companyId
  if (!companyId) throw forbidden('No workspace associated with your account.')

  const sentAt = new Date().toISOString()

  if (target.scope === 'department') {
    const members = await prisma.user.findMany({
      where: {
        companyId,
        accountStatus: 'ACTIVE',
        enterpriseTeamMemberships: { some: { team: { departmentId: target.departmentId } } },
      },
      select: { id: true },
    })

    if (members.length === 0) {
      return apiData<BroadcastResult>({ enqueued: 0, eventType: type, targetScope: 'department', departmentId: target.departmentId, sentAt })
    }

    const envelopes = await Promise.all(
      members.map(({ id: userId }) =>
        enqueueRealtimeDelivery({
          type,
          target: { scope: 'user', userId },
          payload: { ...payload, _broadcast: { scope: 'department', departmentId: target.departmentId, actorId: user.id } },
          workspaceId: companyId,
          actorId: user.id,
        })
      )
    )

    return apiData<BroadcastResult>({
      enqueued: envelopes.length,
      envelopeIds: envelopes.map((e) => e.id),
      eventType: type,
      targetScope: 'department',
      departmentId: target.departmentId,
      sentAt,
    })
  }

  const deliveryTarget: RealtimeDeliveryTarget =
    target.scope === 'workspace' ? { scope: 'workspace', workspaceId: companyId } : { scope: 'user', userId: target.userId }

  const envelope = await enqueueRealtimeDelivery({
    type,
    target: deliveryTarget,
    payload: { ...payload, _broadcast: { scope: target.scope, actorId: user.id } },
    workspaceId: companyId,
    actorId: user.id,
  })

  return apiData<BroadcastResult>({ enqueued: 1, envelopeId: envelope.id, eventType: type, targetScope: target.scope, sentAt })
},
{
  auth: 'required',
  requiredRole: ['MANAGER', 'OWNER', 'SUPER_ADMIN'],
  rateLimit: { max: 60, namespace: 'admin.broadcast', windowMs: 60_000 },
  responseMode: 'legacy',
  route: '/api/admin/broadcast',
}
)
}, { auth: 'required' });
