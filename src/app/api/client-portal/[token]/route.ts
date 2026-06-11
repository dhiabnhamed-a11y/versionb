import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cleanPortalText } from '@/lib/client-portal'
import { NO_STORE_HEADERS } from '@/lib/http'
import { API_RATE_LIMITS } from '@/lib/api-defaults'
import { enforceDistributedRateLimit } from '@/lib/rate-limit'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

type PortalClientRow = {
  id: string
  companyId: string
  companyName: string
  contactPerson: string | null
  email: string | null
  avatarUrl: string | null
}

type PortalCommentRow = {
  id: string
  campaignId: string | null
  deliverableId: string | null
  authorName: string
  authorEmail: string | null
  content: string
  createdAt: Date
}

type PortalCommentBody = {
  campaignId?: unknown
  deliverableId?: unknown
  authorName?: unknown
  authorEmail?: unknown
  content?: unknown
}

async function getPortalClient(token: string) {
  const rows = await tenantQueryRaw<PortalClientRow[]>`
    SELECT "id", "companyId", "companyName", "contactPerson", "email", "avatarUrl"
    FROM "Client"
    WHERE "portalToken" = ${token}
      AND "portalEnabled" = true
      AND "status" = 'active'
      AND ("portalTokenExpiresAt" IS NULL OR "portalTokenExpiresAt" > NOW())
    LIMIT 1
  `
  return rows[0] ?? null
}

function normalizeId(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export const GET = withApiHandler(async ({ req, params }) => {
const rate = await enforceDistributedRateLimit(req, { namespace: 'portal:read', windowMs: 60_000, max: 60 })
if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS })

const { token } = await context.params
if (!/^[a-z0-9]{32,128}$/i.test(token)) {
return NextResponse.json({ error: 'Portal not found.' }, { status: 404, headers: NO_STORE_HEADERS })
}
const client = await getPortalClient(token)
if (!client) return NextResponse.json({ error: 'Portal not found.' }, { status: 404 })

const [campaigns, comments] = await Promise.all([
prisma.project.findMany({
  where: {
    companyId: client.companyId,
    clientId: client.id,
  },
  orderBy: { updatedAt: 'desc' },
  select: {
    id: true,
    title: true,
    description: true,
    clientName: true,
    updatedAt: true,
    category: { select: { id: true, name: true } },
    deliverables: {
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        approvalState: true,
        dueAt: true,
        files: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            url: true,
            playbackUrl: true,
            thumbnailUrl: true,
            type: true,
            mimeType: true,
            originalFilename: true,
            createdAt: true,
          },
        },
        tasks: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            title: true,
            stage: true,
          },
        },
      },
    },
  },
}),
tenantQueryRaw<PortalCommentRow[]>`
      SELECT "id", "campaignId", "deliverableId", "authorName", "authorEmail", "content", "createdAt"
      FROM "ClientPortalComment"
      WHERE "clientId" = ${client.id}
      ORDER BY "createdAt" DESC
      LIMIT 200
    `,
])

return NextResponse.json(
{
  client,
  campaigns,
  comments: comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  })),
},
{ headers: NO_STORE_HEADERS }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
const rate = await enforceDistributedRateLimit(req, API_RATE_LIMITS.portal)
if (!rate.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS })

const { token } = await context.params
const client = await getPortalClient(token)
if (!client) return NextResponse.json({ error: 'Portal not found.' }, { status: 404 })

const body = (await req.json().catch(() => ({}))) as PortalCommentBody
const authorName = cleanPortalText(body.authorName, 120)
const authorEmail = cleanPortalText(body.authorEmail, 180).toLowerCase() || null
const content = cleanPortalText(body.content, 3000)
const campaignId = normalizeId(body.campaignId)
const deliverableId = normalizeId(body.deliverableId)

if (!authorName || !content) {
return NextResponse.json({ error: 'Name and comment are required.' }, { status: 400 })
}
if (!campaignId && !deliverableId) {
return NextResponse.json({ error: 'Choose a campaign or deliverable to comment on.' }, { status: 400 })
}

const validTarget = await prisma.project.findFirst({
where: {
  id: campaignId ?? undefined,
  companyId: client.companyId,
  clientId: client.id,
  ...(deliverableId
    ? {
        deliverables: {
          some: { id: deliverableId },
        },
      }
    : {}),
},
select: { id: true },
})

if (!validTarget) {
return NextResponse.json({ error: 'Comment target was not found in this portal.' }, { status: 404 })
}

const rows = await tenantQueryRaw<PortalCommentRow[]>`
    INSERT INTO "ClientPortalComment" (
      "id",
      "companyId",
      "clientId",
      "campaignId",
      "deliverableId",
      "authorName",
      "authorEmail",
      "content",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${client.companyId},
      ${client.id},
      ${validTarget.id},
      ${deliverableId},
      ${authorName},
      ${authorEmail},
      ${content},
      ${new Date()}
    )
    RETURNING "id", "campaignId", "deliverableId", "authorName", "authorEmail", "content", "createdAt"
  `

const comment = rows[0]
return NextResponse.json(
{
  ...comment,
  createdAt: comment.createdAt.toISOString(),
},
{ status: 201 }
)
}, { auth: 'required' });
