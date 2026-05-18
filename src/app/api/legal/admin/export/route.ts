import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest } from 'next/server'

import { exportLegalConsentRows } from '@/lib/legal'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import { withApiError } from '@/modules/shared/api'
import { forbidden } from '@/modules/shared/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(req: NextRequest) {
  return withApiError(req, async () => {
    const user = await requireSessionUser()
    if (!user?.id || !isAuthorizedSuperAdminIdentity(user)) {
      throw forbidden('Forbidden')
    }

    const rows = await exportLegalConsentRows()
    const columns = [
      'id',
      'userId',
      'userEmail',
      'userName',
      'companyId',
      'companyName',
      'consentType',
      'documentVersion',
      'acceptedAt',
      'ipAddress',
      'userAgent',
      'locale',
      'source',
      'consentHash',
      'requestId',
      'createdAt',
    ] as const
    const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))].join('\n')

    return new Response(csv, {
      headers: {
        'Content-Disposition': 'attachment; filename="taskit-legal-consent-export.csv"',
        'Content-Type': 'text/csv; charset=utf-8',
      },
    })
  })
}

