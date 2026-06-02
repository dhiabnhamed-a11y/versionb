import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'

export const runtime = 'nodejs'

type CreateBriefBody = {
  campaignId: string
  clientId?: string | null
  title: string
  description?: string | null
  objectives?: unknown
}

export async function GET(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user.companyId) return NextResponse.json([], { headers: NO_STORE_HEADERS })

  const campaignId = req.nextUrl.searchParams.get('campaignId')?.trim()

  const briefs = await prisma.brief.findMany({
    where: {
      companyId: user.companyId,
      ...(campaignId ? { campaignId } : {}),
    },
    include: {
      campaign: { select: { id: true, title: true, clientId: true, clientName: true } },
      client: { select: { id: true, companyName: true } },
      deliverables: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          approvalState: true,
          revisionCount: true,
          _count: { select: { tasks: true, files: true, approvals: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(briefs, { headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as CreateBriefBody
  const title = body.title?.trim()
  const campaignId = body.campaignId?.trim()
  if (!title || !campaignId) return NextResponse.json({ error: 'Brief title and campaignId are required.' }, { status: 400 })

  const campaign = await prisma.project.findFirst({
    where: { id: campaignId, companyId: user.companyId },
    select: { id: true, clientId: true },
  })
  if (!campaign) return NextResponse.json({ error: 'Selected campaign was not found in this workspace.' }, { status: 404 })

  const clientId = body.clientId?.trim() || campaign.clientId || null
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId: user.companyId }, select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Selected client was not found in this workspace.' }, { status: 404 })
  }

  const brief = await prisma.brief.create({
    data: {
      companyId: user.companyId,
      campaignId,
      clientId,
      createdById: user.id,
      title,
      description: body.description?.trim() || null,
      objectives:
        body.objectives === undefined
          ? undefined
          : body.objectives === null
            ? Prisma.JsonNull
            : (body.objectives as Prisma.InputJsonValue),
      status: 'DRAFT',
    },
    include: {
      campaign: { select: { id: true, title: true } },
      client: { select: { id: true, companyName: true } },
      deliverables: true,
    },
  })

  return NextResponse.json(brief, { status: 201 })
}
