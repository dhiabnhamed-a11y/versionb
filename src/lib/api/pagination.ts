import type { ApiPagination } from '@/lib/api/types'

export type PaginationOptions = {
  pageSize?: number
  maxPageSize?: number
}

export type PaginationInput = ApiPagination & {
  skip: number
}

export type CursorPaginationInput = {
  cursor: string | null
  limit: number
  direction: 'forward' | 'backward'
}

export type CursorPaginationResult<T extends { id: string }> = {
  items: T[]
  nextCursor: string | null
  prevCursor: string | null
  hasMore: boolean
}

export function parsePaginationSearchParams(searchParams: URLSearchParams, options: PaginationOptions = {}): PaginationInput {
  const defaultPageSize = options.pageSize ?? 30
  const maxPageSize = options.maxPageSize ?? 100
  const page = Math.max(Number(searchParams.get('page') ?? 1) || 1, 1)
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? defaultPageSize) || defaultPageSize, 1), maxPageSize)

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    total: 0,
    pageCount: 0,
  }
}

export function parseCursorPaginationParams(searchParams: URLSearchParams, options: PaginationOptions = {}): CursorPaginationInput {
  const maxPageSize = options.maxPageSize ?? 100
  const defaultPageSize = options.pageSize ?? 30
  const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? defaultPageSize) || defaultPageSize, 1), maxPageSize)
  const cursor = searchParams.get('cursor') ?? null
  const direction = searchParams.get('direction') === 'backward' ? 'backward' : 'forward'
  return { cursor, limit, direction }
}

export function buildCursorResult<T extends { id: string }>(
  items: T[],
  limit: number
): CursorPaginationResult<T> {
  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items
  return {
    items: page,
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    prevCursor: page[0]?.id ?? null,
    hasMore,
  }
}

export function paginationMeta(input: { page: number; pageSize: number; total: number }): ApiPagination {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    pageCount: Math.ceil(input.total / input.pageSize),
  }
}
