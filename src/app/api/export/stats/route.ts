import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { NO_STORE_HEADERS } from '@/lib/http'
import {
  buildStatsCsv,
  buildWorkspaceStatsExport,
  canManageSettings,
  logAdminAction,
  type SettingsSessionUser,
} from '@/lib/settings'
import { prisma } from '@/lib/db'
import { generateStatsPdf } from '@/lib/stats-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ExportFormat = 'json' | 'csv' | 'pdf'

function buildDownloadHeaders(filename: string, contentType: string) {
  return {
    ...NO_STORE_HEADERS,
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Content-Type-Options': 'nosniff',
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

export async function GET(req: NextRequest) {
  const reqId = requestId()
  const startedAt = Date.now()
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized', requestId: reqId }, { status: 401, headers: { 'X-Request-Id': reqId } })
  }

  const user = session.user as SettingsSessionUser
  if (!user.id) return NextResponse.json({ error: 'Unauthorized', requestId: reqId }, { status: 401, headers: { 'X-Request-Id': reqId } })
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account.', requestId: reqId }, { status: 400, headers: { 'X-Request-Id': reqId } })
  if (!canManageSettings(user.role)) return NextResponse.json({ error: 'Forbidden', requestId: reqId }, { status: 403, headers: { 'X-Request-Id': reqId } })

  const format = getFormat(req.nextUrl.searchParams.get('format')?.toLowerCase() ?? null)

  try {
    console.info('[stats-export]', {
      requestId: reqId,
      companyId: user.companyId,
      format,
      event: 'export-started',
    })
    const exportData = await buildWorkspaceStatsExport(user.companyId)

    await logAdminAction(prisma, {
      companyId: user.companyId,
      actorId: user.id,
      action: 'STATS_EXPORTED',
      metadata: {
        format,
        totals: exportData.summary,
      },
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (format === 'csv') {
      return new NextResponse(buildStatsCsv(exportData), {
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
      const body = new ArrayBuffer(pdf.byteLength)
      new Uint8Array(body).set(pdf)

      console.info('[stats-export]', {
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

    console.info('[stats-export]', {
      requestId: reqId,
      companyId: user.companyId,
      format,
      event: 'export-completed',
      durationMs: Date.now() - startedAt,
    })

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        ...buildDownloadHeaders(`taskit-stats-${timestamp}.json`, 'application/json; charset=utf-8'),
        'X-Request-Id': reqId,
      },
    })
  } catch (error) {
    console.error('[stats-export]', {
      requestId: reqId,
      companyId: user.companyId,
      format,
      event: 'export-failed',
      durationMs: Date.now() - startedAt,
      error: errorDetails(error),
    })
    return NextResponse.json({ error: 'Failed to export statistics.', requestId: reqId }, { status: 500, headers: { 'X-Request-Id': reqId } })
  }
}
