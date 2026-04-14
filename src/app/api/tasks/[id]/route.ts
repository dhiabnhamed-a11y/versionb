import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getStageProgress } from '@/lib/utils'

// PATCH update a task (stage, progress, etc.)
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  const user = session.user as any

  try {
    const body = await req.json()
    const { stage, title, description, priority, deadline, assigneeId } = body

    const existing = await prisma.task.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Employees can only update stage
    const updateData: any = {}
    if (stage) {
      updateData.stage = stage
      updateData.progress = getStageProgress(stage)
    }
    if (user.role !== 'EMPLOYEE') {
      if (title) updateData.title = title
      if (description !== undefined) updateData.description = description
      if (priority) updateData.priority = priority
      if (deadline !== undefined) updateData.deadline = deadline ? new Date(deadline) : null
      if (assigneeId !== undefined) updateData.assigneeId = assigneeId
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, title: true } },
      },
    })

    // Log activity
    const action = stage ? `Stage moved to ${stage}` : 'Task updated'
    await prisma.activity.create({
      data: { taskId: id, userId: user.id, action },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE a task
export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/tasks/[id]'>) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as any
  if (user.role === 'EMPLOYEE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await ctx.params

  try {
    await prisma.activity.deleteMany({ where: { taskId: id } })
    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
