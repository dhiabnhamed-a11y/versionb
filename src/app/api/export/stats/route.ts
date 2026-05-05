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

function buildDownloadHeaders(filename: string, contentType: string) {
  return {
    ...NO_STORE_HEADERS,
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Content-Type-Options': 'nosniff',
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SettingsSessionUser
  if (!user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account.' }, { status: 400 })
  if (!canManageSettings(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const format = req.nextUrl.searchParams.get('format')?.toLowerCase() === 'csv' ? 'csv' : 'json'

  try {
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
        headers: buildDownloadHeaders(`taskit-stats-${timestamp}.csv`, 'text/csv; charset=utf-8'),
      })
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: buildDownloadHeaders(`taskit-stats-${timestamp}.json`, 'application/json; charset=utf-8'),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to export statistics.' }, { status: 500 })
  }
}
