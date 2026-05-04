import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { commentSelect, getAllowedCommentFile } from '@/lib/media-comments'
import type { SessionUser } from '@/lib/project-access'

type UpdateCommentBody = {
  resolved?: boolean
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  const { id } = await params
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true, fileId: true },
  })
  if (!existing) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })

  const file = await getAllowedCommentFile(existing.fileId, user)
  if (!file) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as UpdateCommentBody
  if (typeof body.resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved must be a boolean.' }, { status: 400 })
  }

  const comment = await prisma.comment.update({
    where: { id },
    data: { resolved: body.resolved },
    select: commentSelect,
  })

  return NextResponse.json(comment)
}
