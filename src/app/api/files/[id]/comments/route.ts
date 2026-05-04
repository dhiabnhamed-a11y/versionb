import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { COMMENT_TIME_TOLERANCE_SECONDS, commentSelect, getAllowedCommentFile } from '@/lib/media-comments'
import type { SessionUser } from '@/lib/project-access'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = session.user as SessionUser
  const { id } = await params
  const file = await getAllowedCommentFile(id, user)
  if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  const comments = await prisma.comment.findMany({
    where: { fileId: file.id },
    select: commentSelect,
    orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ comments, toleranceSeconds: COMMENT_TIME_TOLERANCE_SECONDS })
}
