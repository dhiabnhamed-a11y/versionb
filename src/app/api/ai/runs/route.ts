import { requireSessionUser } from '@/modules/shared/session'
import { NextRequest, NextResponse } from 'next/server'
import { NO_STORE_HEADERS } from '@/lib/http'
import { normalizeAppLocale } from '@/lib/i18n'
import { createOperationalAiPlan } from '@/modules/ai/services/operational-ai.service'
import { getAiObservabilitySummary } from '@/modules/ai/observability/metrics'

export const runtime = 'nodejs'

type SessionUser = {
  id: string
  role?: string | null
  companyId?: string | null
}

function sessionActor(user: SessionUser, locale?: string | null) {
  if (!user.companyId) return null
  return {
    id: user.id,
    companyId: user.companyId,
    role: user.role ?? 'EMPLOYEE',
    locale: normalizeAppLocale(locale),
  }
}

export async function GET() {
  const user = await requireSessionUser()
  if (!user.companyId) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 })

  const summary = await getAiObservabilitySummary(user.companyId)
  return NextResponse.json({ summary, generatedAt: new Date().toISOString() }, { headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest) {
  const user = await requireSessionUser()
  const body = (await req.json().catch(() => ({}))) as {
    goal?: unknown
    conversationId?: unknown
    locale?: unknown
    idempotencyKey?: unknown
  }
  const actor = sessionActor(user as SessionUser, typeof body.locale === 'string' ? body.locale : null)
  if (!actor) return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 })

  const goal = typeof body.goal === 'string' ? body.goal.trim() : ''
  if (!goal) return NextResponse.json({ error: 'Goal is required.' }, { status: 400 })

  const result = await createOperationalAiPlan({
    goal,
    actor,
    conversationId: typeof body.conversationId === 'string' ? body.conversationId : null,
    idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null,
    dryRun: true,
  })

  if (result.blocked) {
    return NextResponse.json({ blocked: true, safety: result.safety }, { status: 403, headers: NO_STORE_HEADERS })
  }

  return NextResponse.json(
    {
      blocked: false,
      aiRunId: result.result?.aiRun.id,
      plan: result.result?.plan,
      steps: result.result?.steps.map((step) => ({
        id: step.id,
        sequence: step.sequence,
        name: step.name,
        status: step.status,
        toolName: step.toolName,
        riskLevel: step.riskLevel,
        approvalRequired: step.approvalRequired,
      })),
      safety: result.safety,
      generatedAt: new Date().toISOString(),
    },
    { headers: NO_STORE_HEADERS }
  )
}
