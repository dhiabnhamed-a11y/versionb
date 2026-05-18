import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { getAiConversationReplay } from '@/lib/ai-conversation-state'
import { NO_STORE_HEADERS } from '@/lib/http'

type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  role?: string | null
  companyId?: string | null
}

function cleanConversationId(value: string | null) {
  return value && /^[a-z0-9_-]{8,80}$/i.test(value) ? value : null
}

export async function GET(req: NextRequest) {
  const user = await requireSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })

  const typedUser = user as SessionUser
  const conversationId = cleanConversationId(req.nextUrl.searchParams.get('conversationId'))
  const replay = await getAiConversationReplay({ user, conversationId })

  return NextResponse.json(replay, { headers: NO_STORE_HEADERS })
}
