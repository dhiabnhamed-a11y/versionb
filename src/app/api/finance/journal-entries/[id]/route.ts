import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getJournalEntry } from '@/modules/accounting/accounting.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await getJournalEntry(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
