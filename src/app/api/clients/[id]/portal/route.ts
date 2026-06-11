import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClientPortalToken, getClientPortalUrl } from '@/lib/client-portal'
import { canManageClients, type BillingSessionUser } from '@/lib/clients'
import { withApiHandler } from '@/lib/api/handler'

type PortalBody = {
  enabled?: unknown
  rotate?: unknown
}

export const runtime = 'nodejs'

async function authorizeClient(user: BillingSessionUser, id: string) {
  if (!user.companyId || !canManageClients(user)) return null
  const rows = await tenantQueryRaw<Array<{ id: string; portalToken: string | null; portalEnabled: boolean }>>`
    SELECT "id", "portalToken", "portalEnabled"
    FROM "Client"
    WHERE "id" = ${id}
      AND "companyId" = ${user.companyId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export const POST = withApiHandler(
  async ({ req, params, user }) => {
    const { id } = await params
    const existing = await authorizeClient(user, id)
    if (!existing) return new Response(JSON.stringify({ error: 'Client not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })

    const body = (await req.json().catch(() => ({}))) as PortalBody
    const shouldRotate = body.rotate === true || !existing.portalToken
    const portalToken = shouldRotate ? createClientPortalToken() : existing.portalToken
    const portalEnabled = body.enabled === undefined ? true : body.enabled === true
    // Portal tokens expire after 180 days; rotation resets the clock
    const portalTokenExpiresAt = shouldRotate
      ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
      : null // existing expiry preserved

    if (shouldRotate) {
      await tenantExecuteRaw`
        UPDATE "Client"
        SET
          "portalToken" = ${portalToken},
          "portalEnabled" = ${portalEnabled},
          "portalTokenExpiresAt" = ${portalTokenExpiresAt},
          "updatedAt" = ${new Date()}
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
      `
    } else {
      await tenantExecuteRaw`
        UPDATE "Client"
        SET
          "portalEnabled" = ${portalEnabled},
          "updatedAt" = ${new Date()}
        WHERE "id" = ${id}
          AND "companyId" = ${user.companyId}
      `
    }

    await prisma.clientActivity.create({
      data: {
        companyId: user.companyId!,
        clientId: id,
        actorId: user.id,
        type: shouldRotate ? 'client.portal_rotated' : 'client.portal_updated',
        title: shouldRotate ? 'Client portal link generated' : 'Client portal access updated',
      },
    })

    return {
      ok: true,
      enabled: portalEnabled,
      url: portalToken ? getClientPortalUrl(portalToken, req) : null,
    }
  },
  { auth: 'required' }
)

