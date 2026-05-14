import { NextResponse } from 'next/server'
import { apiHeaders } from '@/lib/api/headers'
import type { ApiErrorResponse, ApiPagination, ApiResponse } from '@/lib/api/types'

type ApiOkOptions = {
  code?: string
  headers?: HeadersInit
  pagination?: ApiPagination
  requestId: string
  status?: number
}

type ApiErrorOptions = {
  code: string
  details?: unknown
  headers?: HeadersInit
  requestId: string
  status: number
}

export function apiEnvelope<TData>(data: TData, options: ApiOkOptions): ApiResponse<TData> {
  return {
    data,
    error: null,
    code: options.code ?? 'OK',
    requestId: options.requestId,
    pagination: options.pagination,
  }
}

export function apiErrorEnvelope(error: string, options: ApiErrorOptions): ApiErrorResponse {
  return {
    data: null,
    error,
    code: options.code,
    requestId: options.requestId,
    details: options.details,
  }
}

export function apiOk<TData>(data: TData, options: ApiOkOptions) {
  return NextResponse.json(apiEnvelope(data, options), {
    status: options.status ?? 200,
    headers: apiHeaders(options.requestId, options.headers),
  })
}

export function apiCreated<TData>(data: TData, options: Omit<ApiOkOptions, 'status'>) {
  return apiOk(data, { ...options, status: 201 })
}

export function apiError(error: string, options: ApiErrorOptions) {
  return NextResponse.json(apiErrorEnvelope(error, options), {
    status: options.status,
    headers: apiHeaders(options.requestId, options.headers),
  })
}

export function legacyJson<TData>(body: TData, options: { headers?: HeadersInit; requestId?: string; status?: number } = {}) {
  return NextResponse.json(body, {
    status: options.status,
    headers: apiHeaders(options.requestId, options.headers),
  })
}

export function isApiEnvelope<TData = unknown>(value: unknown): value is ApiResponse<TData> {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return 'data' in candidate && 'error' in candidate && 'code' in candidate && typeof candidate.requestId === 'string'
}

export function unwrapApiEnvelope<TData>(value: ApiResponse<TData> | TData) {
  return isApiEnvelope<TData>(value) ? value.data : value
}
