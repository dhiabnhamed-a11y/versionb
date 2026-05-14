import type { ApiPagination } from '@/lib/api/types'

export type PaginationOptions = {
  pageSize?: number
  maxPageSize?: number
}

export type PaginationInput = ApiPagination & {
  skip: number
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

export function paginationMeta(input: { page: number; pageSize: number; total: number }): ApiPagination {
  return {
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    pageCount: Math.ceil(input.total / input.pageSize),
  }
}
