import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'
import { prisma } from '@/lib/db'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

const createDeliverableSchema = z.object({
  briefId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  outputSpecifications: z.any().optional(),
  dueAt: z.string().optional().nullable(),
})

function normalizeType(type?: string | null) {
  return type?.trim().toUpperCase() || 'GENERAL'
}

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  if (!user.companyId) return apiData([])

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
        select: { id: true, title: true, stage: true, priority: true, assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      files: { orderBy: { createdAt: 'desc' }, take: 5 },
      approvals: { orderBy: { createdAt: 'desc' }, take: 3 },
      _count: { select: { revisions: true, files: true, tasks: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return apiData(deliverables)
},
{
  auth: 'required',
  rateLimit: { max: 30, namespace: 'deliverables.list', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/deliverables',
}
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute<ApiParams, unknown>(
req,
undefined,
async ({ user }) => {
  if (!user.companyId) {
    return apiData({ error: 'No company found for this account' }, { status: 400 }) as never
  }
  if (user.role === 'EMPLOYEE') {
    return apiData({ error: 'Forbidden' }, { status: 403 }) as never
  }

  const parsed = await validateJson(req, createDeliverableSchema)
  const title = parsed.title.trim()
  const briefId = parsed.briefId.trim()

  const brief = await prisma.brief.findFirst({
    where: { id: briefId, companyId: user.companyId },
    select: { id: true, campaignId: true, companyId: true },
  })
  if (!brief) {
    return apiData({ error: 'Selected brief was not found in this workspace.' }, { status: 404 }) as never
  }

  const deliverable = await prisma.deliverable.create({
    data: {
      companyId: user.companyId,
      campaignId: brief.campaignId,
      briefId: brief.id,
      title,
      description: parsed.description?.trim() || null,
      type: normalizeType(parsed.type),
      outputSpecifications:
        parsed.outputSpecifications === undefined
          ? undefined
          : parsed.outputSpecifications === null
            ? Prisma.JsonNull
            : (parsed.outputSpecifications as Prisma.InputJsonValue),
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null,
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

  return apiData(deliverable, { status: 201 })
},
{
  auth: 'required',
  idempotency: { responseStatus: 201 },
  rateLimit: { max: 20, namespace: 'deliverables.create', windowMs: 60_000 },
  responseMode: 'canonical',
  route: '/api/deliverables',
}
)
}, { auth: 'required' });
