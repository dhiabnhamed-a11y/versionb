import 'server-only'

import { prisma } from '@/lib/db'
import type { AiActor } from '@/modules/ai/dto/runtime.dto'

export async function rememberOperationalSignal(input: {
  actor: AiActor
  scope: 'workspace' | 'user'
  kind: string
  key: string
  value: string
  confidence?: number
  source?: string
}) {
  const userId = input.scope === 'user' ? input.actor.id : null
  const existing = await prisma.aiMemory.findFirst({
    where: {
      companyId: input.actor.companyId,
      userId,
      scope: input.scope,
      kind: input.kind,
      key: input.key,
    },
    select: { id: true },
  })

  const data = {
    value: input.value.slice(0, 1000),
    confidence: input.confidence ?? 0.75,
    source: input.source ?? 'operational_ai_platform',
    lastSeenAt: new Date(),
  }

  if (existing) {
    return prisma.aiMemory.update({ where: { id: existing.id }, data })
  }

  return prisma.aiMemory.create({
    data: {
      companyId: input.actor.companyId,
      userId,
      scope: input.scope,
      kind: input.kind,
      key: input.key,
      ...data,
    },
  })
}
