import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { listLegalAdminSnapshot, publishLegalDocumentVersion } from '@/lib/legal'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import { withApiError } from '@/modules/shared/api'
import { forbidden } from '@/modules/shared/errors'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SessionUser = {
  id?: string
  email?: string | null
  role?: string | null
}

function getSuperAdminUser(session: { user?: SessionUser | null } | null): SessionUser & { id: string } {
  const user = session?.user
  if (!user?.id || !isAuthorizedSuperAdminIdentity(user)) {
    throw forbidden('Forbidden')
  }

  return { ...user, id: user.id }
}

export async function GET(req: NextRequest) {
  return withApiError(req, async () => {
    const session = await auth()
    getSuperAdminUser(session)

    return NextResponse.json(await listLegalAdminSnapshot())
  })
}

export async function POST(req: NextRequest) {
  return withApiError(req, async () => {
    const session = await auth()
    const user = getSuperAdminUser(session)
    const body = (await req.json().catch(() => ({}))) as {
      contentHash?: string
      documentType?: string
      requiresReacceptance?: boolean
      summary?: string
      title?: string
      version?: string
    }

    const legalVersion = await publishLegalDocumentVersion({
      contentHash: body.contentHash,
      documentType: body.documentType ?? '',
      publishedById: user.id,
      requiresReacceptance: body.requiresReacceptance === true,
      summary: body.summary,
      title: body.title,
      version: body.version ?? '',
    })

    return NextResponse.json({ legalVersion }, { status: 201 })
  })
}
