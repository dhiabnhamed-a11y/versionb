import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { NO_STORE_HEADERS } from '@/lib/http'
import { COMMENT_TIME_TOLERANCE_SECONDS, commentSelect, getAllowedCommentFile } from '@/lib/media-comments'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser()
  const { id } = await params
  const file = await getAllowedCommentFile(id, user)
  if (!file) return NextResponse.json({ error: 'File not found.' }, { status: 404 })

  const comments = await prisma.comment.findMany({
    where: { fileId: file.id },
    select: commentSelect,
    orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json(
    { comments, toleranceSeconds: COMMENT_TIME_TOLERANCE_SECONDS },
    { headers: NO_STORE_HEADERS }
  )
}
