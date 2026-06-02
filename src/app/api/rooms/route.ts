import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { apiData, handleApiRoute, validateJson, type ApiParams } from '@/lib/api'

import { normalizeCompanyType } from '@/lib/company-types'
import { prisma } from '@/lib/db'
import { emitCompanyRealtime } from '@/lib/realtime-server'

export const runtime = 'nodejs'

const createRoomSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData([])
      }

      const rooms = await prisma.room.findMany({
        where: { companyId: user.companyId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { projects: true } },
        },
        orderBy: [{ createdAt: 'asc' }],
      })

      return apiData(
        rooms.map((room) => ({
          id: room.id,
          name: room.name,
          description: room.description,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
          projectCount: room._count.projects,
        }))
      )
    },
    {
      auth: 'required',
      rateLimit: { max: 30, namespace: 'rooms.list', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/rooms',
    }
  )
}

export async function POST(req: NextRequest) {
  return handleApiRoute<ApiParams, unknown>(
    req,
    undefined,
    async ({ user }) => {
      if (!user.companyId) {
        return apiData({ error: 'No company found for this account.' }, { status: 400 })
      }
      if (user.role === 'EMPLOYEE') {
        return apiData({ error: 'Forbidden' }, { status: 403 })
      }
      if (normalizeCompanyType(user.companyType) !== 'INDUSTRY') {
        return apiData({ error: 'Rooms are only available for industry workspaces.' }, { status: 403 })
      }

      const parsed = await validateJson(req, createRoomSchema)
      const name = parsed.name.trim()
      const description = parsed.description?.trim() || null

      const room = await prisma.room.create({
        data: { companyId: user.companyId, name, description },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { projects: true } },
        },
      })

      const responseRoom = {
        id: room.id,
        name: room.name,
        description: room.description,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        projectCount: room._count.projects,
      }

      emitCompanyRealtime(user.companyId, 'room_created', { room: responseRoom })

      return apiData(responseRoom, { status: 201 })
    },
    {
      auth: 'required',
      idempotency: true,
      rateLimit: { max: 20, namespace: 'rooms.create', windowMs: 60_000 },
      responseMode: 'canonical',
      route: '/api/rooms',
    }
  )
}
