import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'

export type ApiErrorPayload = {
  error: string
  code?: string
  details?: unknown
  requestId?: string
}

export class AppError extends Error {
  status: number
  code: string
  details?: unknown
  expose: boolean

  constructor(message: string, options: { status?: number; code?: string; details?: unknown; expose?: boolean } = {}) {
    super(message)
    this.name = 'AppError'
    this.status = options.status ?? 500
    this.code = options.code ?? 'APP_ERROR'
    this.details = options.details
    this.expose = options.expose ?? this.status < 500
  }
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(message, { status: 401, code: 'UNAUTHORIZED' })
}

export function forbidden(message = 'Forbidden') {
  return new AppError(message, { status: 403, code: 'FORBIDDEN' })
}

export function notFound(message = 'Not found') {
  return new AppError(message, { status: 404, code: 'NOT_FOUND' })
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(message, { status: 400, code: 'BAD_REQUEST', details })
}

export function conflict(message: string, details?: unknown) {
  return new AppError(message, { status: 409, code: 'CONFLICT', details })
}

export function serviceUnavailable(message = 'Service unavailable') {
  return new AppError(message, { status: 503, code: 'SERVICE_UNAVAILABLE' })
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error

  if (error && typeof error === 'object' && 'status' in error) {
    const candidate = error as { message?: unknown; status?: unknown; code?: unknown; details?: unknown; expose?: unknown }
    const status = typeof candidate.status === 'number' ? candidate.status : 500
    const code = typeof candidate.code === 'string' ? candidate.code : status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR'
    const message = typeof candidate.message === 'string' ? candidate.message : 'Server error'
    const expose = typeof candidate.expose === 'boolean' ? candidate.expose : status < 500
    return new AppError(message, { status, code, details: candidate.details, expose })
  }

  if (error instanceof ZodError) {
    return badRequest('Invalid request payload.', error.flatten())
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return notFound('Record not found.')
    if (error.code === 'P2002') return conflict('A record with these unique fields already exists.', error.meta)
  }

  return new AppError('Server error', { status: 500, code: 'SERVER_ERROR', expose: false })
}
