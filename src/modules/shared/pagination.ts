import type { NextRequest } from 'next/server'

export type PaginationInput = {
  page: number
  pageSize: number
  skip: number
}

export function parsePagination(req: NextRequest, defaults: { pageSize?: number; maxPageSize?: number } = {}): PaginationInput {
  const defaultPageSize = defaults.pageSize ?? 30
  const maxPageSize = defaults.maxPageSize ?? 100
  const page = Math.max(Number(req.nextUrl.searchParams.get('page') ?? 1) || 1, 1)
  const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('pageSize') ?? defaultPageSize) || defaultPageSize, 1), maxPageSize)

  return { page, pageSize, skip: (page - 1) * pageSize }
}
