import { NextRequest, NextResponse } from 'next/server'

import { normalizeCompanyType } from '@/lib/company-types'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type SessionUser = {
  companyId?: string | null
  role?: string
  companyType?: string | null
}

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SessionUser
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
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as SessionUser
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

    return NextResponse.json(
      {
        id: room.id,
        name: room.name,
        description: room.description,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        projectCount: room._count.projects,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 })
  }
}
