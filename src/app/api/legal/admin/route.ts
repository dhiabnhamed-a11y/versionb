import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { listLegalAdminSnapshot, publishLegalDocumentVersion } from '@/lib/legal'
import { isAuthorizedSuperAdminIdentity } from '@/lib/security'
import { withApiError } from '@/modules/shared/api'
import { forbidden } from '@/modules/shared/errors'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type SessionUser = {
  id?: string
  email?: string | null
  role?: string | null
}

function getSuperAdminUser(user: SessionUser & { id: string }) {
  if (!user.id || !isAuthorizedSuperAdminIdentity(user)) {
    throw forbidden('Forbidden')
  }
  return user
}

export const GET = withApiHandler(async ({ req, params }) => {
return withApiError(req, async () => {
getSuperAdminUser(await requireSessionUser())

return NextResponse.json(await listLegalAdminSnapshot())
})
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return withApiError(req, async () => {
const user = getSuperAdminUser(await requireSessionUser())
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
}, { auth: 'required' });
