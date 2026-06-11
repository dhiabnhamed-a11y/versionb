import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { prisma } from '@/lib/db'
import { badRequest, notFound } from '@/modules/shared/errors'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createNoteSchema = z.object({
  content: z.string().min(1),
  isPrivate: z.boolean().default(true),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(req, undefined, async ({ user }) => {
    const { id } = await params as { id: string }
    const incident = await prisma.enterpriseIncident.findFirst({
      where: { id, companyId: user.companyId! },
      select: { id: true },
    })
    if (!incident) throw notFound('Incident not found')

    const notes = await prisma.enterpriseIncidentNote.findMany({
      where: { incidentId: id, companyId: user.companyId! },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })
    return apiData(notes)
  }, { auth: 'required', responseMode: 'canonical' })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const { id } = await params as { id: string }
      const body = await parseJsonObject(req)
      const input = createNoteSchema.parse(body)

      const incident = await prisma.enterpriseIncident.findFirst({
        where: { id, companyId: user.companyId! },
        select: { id: true },
      })
      if (!incident) throw notFound('Incident not found')

      const note = await prisma.enterpriseIncidentNote.create({
        data: {
          companyId: user.companyId!,
          incidentId: id,
          authorId: user.id,
          content: input.content,
          isPrivate: input.isPrivate,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      })
      return apiData(note, { status: 201 })
    },
    { auth: 'required', responseMode: 'canonical' }
  )
}
