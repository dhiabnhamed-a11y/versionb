import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject, type ApiRouteContext } from '@/lib/api'
import { reverseErpJournalEntry } from '@/services/erp'

type Params = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: ApiRouteContext<Params>) {
  return handleApiRoute(
    req,
    context,
    async ({ user, params }) => {
      const body = await parseJsonObject(req)
      return apiData(await reverseErpJournalEntry(user, (params.id as string), body), { code: 'ERP_JOURNAL_ENTRY_REVERSED', status: 201 })
    },
    {
      auth: 'required',
      idempotency: { responseStatus: 201 },
      responseMode: 'canonical',
      route: '/api/v1/erp/journal-entries/[id]/reverse',
    }
  )
}
