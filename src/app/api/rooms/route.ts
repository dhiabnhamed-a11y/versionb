import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { normalizeCompanyType } from '@/lib/company-types'
import { prisma } from '@/lib/db'
import { emitCompanyRealtime } from '@/lib/realtime-server'

export async function GET() {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.companyId) {
    return NextResponse.json([])
  }

  try {
    const rooms = await prisma.room.findMany({
      where: {
        companyId: user.companyId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projects: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    })

    return NextResponse.json(
      rooms.map((room) => ({
        id: room.id,
        name: room.name,
        description: room.description,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        projectCount: room._count.projects,
      }))
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to load rooms.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!user.companyId) {
    return NextResponse.json({ error: 'No company found for this account.' }, { status: 400 })
  }

  if (user.role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (normalizeCompanyType(user.companyType) !== 'INDUSTRY') {
    return NextResponse.json({ error: 'Rooms are only available for industry workspaces.' }, { status: 403 })
  }

  try {
    const body = (await req.json()) as {
      name?: string
      description?: string
    }

    const name = body.name?.trim()
    const description = body.description?.trim()

    if (!name) {
      return NextResponse.json({ error: 'Room name is required.' }, { status: 400 })
    }

    const room = await prisma.room.create({
      data: {
        companyId: user.companyId,
        name,
        description: description || null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            projects: true,
          },
        },
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

    return NextResponse.json(responseRoom, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
  }
}
