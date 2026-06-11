import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, type ApiRouteContext } from '@/lib/api'
import { getErpJournalEntry } from '@/services/erp'

type Params = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, context: ApiRouteContext<Params>) {
  return handleApiRoute(
    req,
    context,
    async ({ user, params }) => apiData(await getErpJournalEntry(user, params.id), { code: 'ERP_JOURNAL_ENTRY_FOUND' }),
    { auth: 'required', responseMode: 'canonical', route: '/api/v1/erp/journal-entries/[id]' }
  )
}
