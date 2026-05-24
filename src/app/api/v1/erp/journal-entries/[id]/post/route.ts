import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiRouteContext } from '@/lib/api'
import { postErpJournalEntry } from '@/services/erp'

type Params = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, context: ApiRouteContext<Params>) {
  return handleApiRoute(
    req,
    context,
    async ({ user, params }) => apiData(await postErpJournalEntry(user, params.id), { code: 'ERP_JOURNAL_ENTRY_POSTED' }),
    {
      auth: 'required',
      idempotency: true,
      responseMode: 'canonical',
      route: '/api/v1/erp/journal-entries/[id]/post',
    }
  )
}
