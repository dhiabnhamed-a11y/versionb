import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { suggestJournalEntryForWorkspace } from '@/services/erp2/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handleApiRoute(
    req,
    undefined,
    async ({ user }) => {
      const body = await parseJsonObject(req)
      const result = await suggestJournalEntryForWorkspace({
        description: body.description,
        amount: body.amount ? Math.round(parseFloat(body.amount) * 100) : null,
        workspaceId: user.companyId!,
      })
      return apiData(result, { code: 'ERP_AI_SUGGESTION_READY' })
    },
    {
      auth: 'required',
      responseMode: 'canonical',
      route: '/api/v1/erp2/ai/suggest-journal-entry',
    }
  )
}
