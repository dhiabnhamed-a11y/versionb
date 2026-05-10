import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createClientPortalToken, getClientPortalUrl } from '@/lib/client-portal'
import { canManageClients, type BillingSessionUser } from '@/lib/clients'

type PortalBody = {
  enabled?: unknown
  rotate?: unknown
}

export const runtime = 'nodejs'

async function authorizeClient(user: BillingSessionUser, id: string) {
  if (!user.companyId || !canManageClients(user)) return null
  const rows = await prisma.$queryRaw<Array<{ id: string; portalToken: string | null; portalEnabled: boolean }>>`
    SELECT "id", "portalToken", "portalEnabled"
    FROM "Client"
    WHERE "id" = ${id}
      AND "companyId" = ${user.companyId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as BillingSessionUser
  const { id } = await context.params
  const existing = await authorizeClient(user, id)
  if (!existing) return NextResponse.json({ error: 'Client not found.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as PortalBody
  const shouldRotate = body.rotate === true || !existing.portalToken
  const portalToken = shouldRotate ? createClientPortalToken() : existing.portalToken
  const portalEnabled = body.enabled === undefined ? true : body.enabled === true

  await prisma.$executeRaw`
    UPDATE "Client"
    SET
      "portalToken" = ${portalToken},
      "portalEnabled" = ${portalEnabled},
      "updatedAt" = ${new Date()}
    WHERE "id" = ${id}
      AND "companyId" = ${user.companyId}
  `

  await prisma.clientActivity.create({
    data: {
      companyId: user.companyId!,
      clientId: id,
      actorId: user.id,
      type: shouldRotate ? 'client.portal_rotated' : 'client.portal_updated',
      title: shouldRotate ? 'Client portal link generated' : 'Client portal access updated',
    },
  })

  return NextResponse.json({
    ok: true,
    enabled: portalEnabled,
    url: portalToken ? getClientPortalUrl(portalToken, req) : null,
  })
}
