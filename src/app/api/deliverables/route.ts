import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'

type SessionUser = {
  id: string
  role: string
  companyId?: string | null
}

type CreateDeliverableBody = {
  briefId: string
  title: string
  description?: string | null
  type?: string | null
  outputSpecifications?: unknown
  dueAt?: string | null
}

function normalizeType(type?: string | null) {
  return type?.trim().toUpperCase() || 'GENERAL'
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json([], { headers: NO_STORE_HEADERS })

  const briefId = req.nextUrl.searchParams.get('briefId')?.trim()
  const campaignId = req.nextUrl.searchParams.get('campaignId')?.trim()
  const status = req.nextUrl.searchParams.get('status')?.trim()

  const deliverables = await prisma.deliverable.findMany({
    where: {
      companyId: user.companyId,
      ...(briefId ? { briefId } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      brief: { select: { id: true, title: true, status: true } },
      campaign: { select: { id: true, title: true, clientId: true, clientName: true } },
      tasks: {
        select: {
          id: true,
          title: true,
          stage: true,
          priority: true,
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      files: { orderBy: { createdAt: 'desc' }, take: 5 },
      approvals: { orderBy: { createdAt: 'desc' }, take: 3 },
      _count: { select: { revisions: true, files: true, tasks: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(deliverables, { headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = (await req.json().catch(() => ({}))) as CreateDeliverableBody
  const title = body.title?.trim()
  const briefId = body.briefId?.trim()
  if (!title || !briefId) return NextResponse.json({ error: 'Deliverable title and briefId are required.' }, { status: 400 })

  const brief = await prisma.brief.findFirst({
    where: { id: briefId, companyId: user.companyId },
    select: { id: true, campaignId: true, companyId: true },
  })
  if (!brief) return NextResponse.json({ error: 'Selected brief was not found in this workspace.' }, { status: 404 })

  const deliverable = await prisma.deliverable.create({
    data: {
      companyId: user.companyId,
      campaignId: brief.campaignId,
      briefId: brief.id,
      title,
      description: body.description?.trim() || null,
      type: normalizeType(body.type),
      outputSpecifications:
        body.outputSpecifications === undefined
          ? undefined
          : body.outputSpecifications === null
            ? Prisma.JsonNull
            : (body.outputSpecifications as Prisma.InputJsonValue),
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      status: 'INTERNAL_REVIEW',
      approvalState: 'PENDING',
      revisions: {
        create: {
          versionNumber: 1,
          status: 'INTERNAL_REVIEW',
          changeNote: 'Initial deliverable scope',
        },
      },
      activities: {
        create: {
          companyId: user.companyId,
          briefId: brief.id,
          actorId: user.id,
          type: 'deliverable.created',
          title: 'Deliverable created',
          body: title,
        },
      },
    },
    include: {
      brief: { select: { id: true, title: true, status: true } },
      campaign: { select: { id: true, title: true } },
      tasks: true,
      revisions: true,
    },
  })

  return NextResponse.json(deliverable, { status: 201 })
}
