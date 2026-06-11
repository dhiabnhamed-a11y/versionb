import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { getAiConversationReplay } from '@/lib/ai-conversation-state'
import { NO_STORE_HEADERS } from '@/lib/http'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

function cleanConversationId(value: string | null) {
  return value && /^[a-z0-9_-]{8,80}$/i.test(value) ? value : null
}

export const GET = withApiHandler(async ({ req, params }) => {
const user = await requireSessionUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS })

const conversationId = cleanConversationId(req.nextUrl.searchParams.get('conversationId'))
const replay = await getAiConversationReplay({ user, conversationId })

return NextResponse.json(replay, { headers: NO_STORE_HEADERS })
}, { auth: 'required' });
