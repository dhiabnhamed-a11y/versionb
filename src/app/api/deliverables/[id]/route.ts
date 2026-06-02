import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'

type UpdateDeliverableBody = {
  title?: string
  description?: string | null
  type?: string
  status?: string
  approvalState?: string
  outputSpecifications?: unknown
  dueAt?: string | null
  approvalNote?: string | null
}

const DELIVERABLE_STATUSES = new Set(['INTERNAL_REVIEW', 'CLIENT_REVIEW', 'APPROVED', 'DELIVERED'])
const APPROVAL_STATES = new Set(['PENDING', 'CHANGES_REQUESTED', 'APPROVED'])

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser()
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })

  const { id } = await ctx.params
  const deliverable = await prisma.deliverable.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      brief: { select: { id: true, title: true, status: true } },
      campaign: { select: { id: true, title: true, clientId: true, clientName: true } },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          dependencies: { select: { dependsOnTask: { select: { id: true, title: true, stage: true } } } },
          subtasks: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      files: { include: { uploadedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      revisions: { orderBy: { versionNumber: 'desc' } },
      approvals: { include: { decidedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } },
      activities: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 50 },
      invoiceItems: { include: { invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } } } },
    },
  })

  if (!deliverable) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(deliverable)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser()
  if (!user.companyId) return NextResponse.json({ error: 'No company found for this account' }, { status: 400 })
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as UpdateDeliverableBody
  const existing = await prisma.deliverable.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, briefId: true, status: true, approvalState: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.status && !DELIVERABLE_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Invalid deliverable status.' }, { status: 400 })
  }
  if (body.approvalState && !APPROVAL_STATES.has(body.approvalState)) {
    return NextResponse.json({ error: 'Invalid approval state.' }, { status: 400 })
  }
  if (body.status === 'DELIVERED' && body.approvalState !== 'APPROVED' && existing.approvalState !== 'APPROVED') {
    return NextResponse.json({ error: 'A deliverable cannot be delivered until approved.' }, { status: 409 })
  }

  const deliverable = await prisma.$transaction(async (tx) => {
    const updated = await tx.deliverable.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
        ...(body.type !== undefined ? { type: body.type.trim().toUpperCase() || 'GENERAL' } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.approvalState !== undefined ? { approvalState: body.approvalState } : {}),
        ...(body.outputSpecifications !== undefined
          ? {
              outputSpecifications:
                body.outputSpecifications === null ? Prisma.JsonNull : (body.outputSpecifications as Prisma.InputJsonValue),
            }
          : {}),
        ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? new Date(body.dueAt) : null } : {}),
        ...(body.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(body.approvalState === 'CHANGES_REQUESTED' ? { revisionCount: { increment: 1 } } : {}),
      },
      include: {
        brief: { select: { id: true, title: true } },
        campaign: { select: { id: true, title: true } },
      },
    })

    if (body.approvalState && body.approvalState !== existing.approvalState) {
      await tx.approvalDecision.create({
        data: {
          companyId: user.companyId!,
          deliverableId: id,
          decidedById: user.id,
          status: body.approvalState,
          note: body.approvalNote?.trim() || null,
        },
      })
    }

    await tx.deliverableActivity.create({
      data: {
        companyId: user.companyId!,
        briefId: existing.briefId,
        deliverableId: id,
        actorId: user.id,
        type: 'deliverable.updated',
        title: 'Deliverable updated',
        metadata: {
          status: body.status,
          approvalState: body.approvalState,
        },
      },
    })

    return updated
  })

  return NextResponse.json(deliverable)
}
