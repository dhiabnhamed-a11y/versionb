export type ApiPagination = {
  page: number
  pageSize: number
  total: number
  pageCount: number
}

export type ApiResponse<TData = unknown, TCode extends string = string> = {
  data: TData | null
  error: string | null
  code: TCode | null
  requestId: string
  pagination?: ApiPagination
}

export type ApiErrorResponse<TCode extends string = string> = ApiResponse<null, TCode> & {
  details?: unknown
}

export type ApiRequestContext = {
  requestId: string
  route?: string
}

export type ApiResponseMode = 'canonical' | 'legacy'

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNAUTHORIZED'
  | (string & {})
