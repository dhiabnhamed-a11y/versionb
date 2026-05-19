import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { NO_STORE_HEADERS } from '@/lib/http'
import {
  buildStatsCsv,
  buildWorkspaceStatsExport,
  canManageSettings,
  logAdminAction,
} from '@/lib/settings'
import { prisma } from '@/lib/db'
import { generateStatsPdf } from '@/lib/stats-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type ExportFormat = 'json' | 'csv' | 'pdf'

function buildDownloadHeaders(filename: string, contentType: string) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return {
    ...NO_STORE_HEADERS,
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
    'X-Content-Type-Options': 'nosniff',
  }
}

function buildJsonHeaders(reqId: string) {
  return {
    ...NO_STORE_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Request-Id': reqId,
  }
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `stats_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getFormat(value: string | null): ExportFormat {
  if (value === 'csv' || value === 'pdf') return value
  return 'json'
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: 'code' in error ? error.code : undefined,
      stack: error.stack,
    }
  }

  return { message: String(error) }
}

function jsonError(message: string, status: number, reqId: string) {
  return NextResponse.json({ error: message, requestId: reqId }, { status, headers: buildJsonHeaders(reqId) })
}

function logStatsExport(level: 'info' | 'warn' | 'error', payload: Record<string, unknown>) {
  const logPayload = {
    scope: 'stats-export',
    ...payload,
  }

  if (level === 'error') console.error('[stats-export]', logPayload)
  else if (level === 'warn') console.warn('[stats-export]', logPayload)
  else console.info('[stats-export]', logPayload)
}

async function logExportAuditSafely(input: {
  companyId: string
  actorId: string
  format: ExportFormat
  totals: Prisma.InputJsonValue
  requestId: string
}) {
  try {
    await logAdminAction(prisma, {
      companyId: input.companyId,
      actorId: input.actorId,
      action: 'STATS_EXPORTED',
      metadata: {
        format: input.format,
        totals: input.totals,
        requestId: input.requestId,
      },
    })
  } catch (error) {
    logStatsExport('warn', {
      requestId: input.requestId,
      companyId: input.companyId,
      format: input.format,
      event: 'audit-log-failed',
      error: errorDetails(error),
    })
  }
}

export async function GET(req: NextRequest) {
  const reqId = requestId()
  const startedAt = Date.now()
  const format = getFormat(req.nextUrl.searchParams.get('format')?.toLowerCase() ?? null)
  let companyId: string | undefined

  try {
    const user = await requireSessionUser()
    if (!user) return jsonError('Unauthorized', 401, reqId)

    if (!user.id) return jsonError('Unauthorized', 401, reqId)
    if (!user.companyId) return jsonError('No company found for this account.', 400, reqId)
    if (!canManageSettings(user.role)) return jsonError('Forbidden', 403, reqId)
    companyId = user.companyId

    logStatsExport('info', {
      requestId: reqId,
      companyId: user.companyId,
      format,
      event: 'export-started',
    })

    const exportData = await buildWorkspaceStatsExport(user.companyId)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (format === 'csv') {
      const csv = buildStatsCsv(exportData)
      await logExportAuditSafely({
        companyId: user.companyId,
        actorId: user.id,
        format,
        totals: exportData.summary,
        requestId: reqId,
      })

      logStatsExport('info', {
        requestId: reqId,
        companyId: user.companyId,
        format,
        event: 'export-completed',
        byteLength: Buffer.byteLength(csv),
        durationMs: Date.now() - startedAt,
      })

      return new NextResponse(csv, {
        headers: {
          ...buildDownloadHeaders(`taskit-stats-${timestamp}.csv`, 'text/csv; charset=utf-8'),
          'X-Request-Id': reqId,
        },
      })
    }

    if (format === 'pdf') {
      const pdf = await generateStatsPdf(exportData, {
        requestId: reqId,
        companyId: user.companyId,
        startedAt,
      })
      const body = new Uint8Array(pdf)

      await logExportAuditSafely({
        companyId: user.companyId,
        actorId: user.id,
        format,
        totals: exportData.summary,
        requestId: reqId,
      })

      logStatsExport('info', {
        requestId: reqId,
        companyId: user.companyId,
        format,
        event: 'export-completed',
        byteLength: pdf.byteLength,
        durationMs: Date.now() - startedAt,
      })

      return new Response(body, {
        headers: {
          ...buildDownloadHeaders(`taskit-stats-${timestamp}.pdf`, 'application/pdf'),
          'Content-Length': String(pdf.byteLength),
          'X-Request-Id': reqId,
        },
      })
    }

    const json = JSON.stringify(exportData, null, 2)
    await logExportAuditSafely({
      companyId: user.companyId,
      actorId: user.id,
      format,
      totals: exportData.summary,
      requestId: reqId,
    })

    logStatsExport('info', {
      requestId: reqId,
      companyId: user.companyId,
      format,
      event: 'export-completed',
      byteLength: Buffer.byteLength(json),
      durationMs: Date.now() - startedAt,
    })

    return new NextResponse(json, {
      headers: {
        ...buildDownloadHeaders(`taskit-stats-${timestamp}.json`, 'application/json; charset=utf-8'),
        'X-Request-Id': reqId,
      },
    })
  } catch (error) {
    logStatsExport('error', {
      requestId: reqId,
      companyId,
      format,
      event: 'export-failed',
      durationMs: Date.now() - startedAt,
      error: errorDetails(error),
    })
    return jsonError('Failed to export statistics.', 500, reqId)
  }
}
