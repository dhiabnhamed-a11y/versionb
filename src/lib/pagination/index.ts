import { z } from 'zod'
import type { ApiPagination } from '@/lib/api/types'

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(200).optional(),
  sort: z.string().trim().max(80).optional(),
})

export type CursorPaginationQuery = z.infer<typeof cursorPaginationQuerySchema>

export type CursorPage<T> = {
  items: T[]
  pageInfo: {
    hasNextPage: boolean
    nextCursor: string | null
  }
}

export function offsetPaginationMeta(input: { page: number; pageSize: number; total: number }): ApiPagination {
  return {
    page: input.page,
    pageCount: Math.ceil(input.total / input.pageSize),
    pageSize: input.pageSize,
    total: input.total,
  }
}

export function createCursorPage<T extends Record<string, unknown>>(
  rows: T[],
  options: { cursorField?: keyof T; limit: number }
): CursorPage<T> {
  const items = rows.slice(0, options.limit)
  const cursorField = options.cursorField ?? 'id'
  const last = items.at(-1)

  return {
    items,
    pageInfo: {
      hasNextPage: rows.length > options.limit,
      nextCursor: last ? String(last[cursorField] ?? '') || null : null,
    },
  }
}
