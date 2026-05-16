import 'server-only'

import { prisma } from '@/lib/db'
import type { AiActor } from '@/modules/ai/dto/runtime.dto'

export type AiRetrievalHit = {
  entityType: string
  entityId: string
  title: string
  subtitle?: string | null
  href?: string | null
  score: number
}

function tokens(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2)
}

function keywordScore(query: string, text: string) {
  const textLower = text.toLowerCase()
  return tokens(query).reduce((score, token) => score + (textLower.includes(token) ? 1 : 0), 0)
}

export async function retrieveOperationalContext(input: {
  actor: AiActor
  query: string
  limit?: number
}): Promise<AiRetrievalHit[]> {
  const limit = Math.min(input.limit ?? 12, 25)
  const indexes = await prisma.searchIndex.findMany({
    where: {
      companyId: input.actor.companyId,
      OR: [
        { title: { contains: input.query, mode: 'insensitive' } },
        { subtitle: { contains: input.query, mode: 'insensitive' } },
        { content: { contains: input.query, mode: 'insensitive' } },
      ],
    },
    select: { entityType: true, entityId: true, title: true, subtitle: true, content: true, href: true },
    take: limit * 3,
  })

  return indexes
    .map((item) => ({
      entityType: item.entityType,
      entityId: item.entityId,
      title: item.title,
      subtitle: item.subtitle,
      href: item.href,
      score: keywordScore(input.query, `${item.title} ${item.subtitle ?? ''} ${item.content ?? ''}`),
    }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
}
