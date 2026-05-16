export type ApiPagination = {
  page: number
  pageSize: number
  total: number
  pageCount: number
}

export type ApiMeta = {
  pagination?: ApiPagination
  [key: string]: unknown
}

export type ApiErrorBody<TCode extends string = string> = {
  code: TCode
  details?: unknown
  message: string
}

export type ApiResponse<TData = unknown, TCode extends string = string> = {
  success: true
  data: TData
  error: null
  meta: ApiMeta
  requestId: string
  timestamp: string
}

export type ApiErrorResponse<TCode extends string = string> = {
  success: false
  data: null
  error: ApiErrorBody<TCode>
  meta: ApiMeta
  requestId: string
  timestamp: string
}

export type LegacyApiResponse<TData = unknown, TCode extends string = string> = {
  data: TData | null
  error: string | null
  code: TCode | null
  requestId: string
  pagination?: ApiPagination
}

export type LegacyApiErrorResponse<TCode extends string = string> = LegacyApiResponse<null, TCode> & {
  details?: unknown
}

export type ApiRequestContext = {
  actorId?: string
  companyId?: string
  requestId: string
  route?: string
  startedAt: number
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
