import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getProjectIfAllowed } from '@/lib/project-access'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as { id: string; role: string; companyId?: string | null }
  const { id } = await params

  const allowed = await getProjectIfAllowed(id, user)
  if (!allowed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const project = await prisma.project.findFirst({
    where: { id },
    include: {
      manager: { select: { id: true, name: true } },
      tasks: { select: { id: true, stage: true, title: true } },
      cameraMedia: { orderBy: { createdAt: 'desc' }, take: 12 },
    },
  })

  return NextResponse.json(project)
}
