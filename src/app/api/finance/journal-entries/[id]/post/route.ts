import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { postJournalEntry } from '@/modules/accounting/accounting.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => apiData(await postJournalEntry(user, params.id)),
    { auth: 'required', responseMode: 'legacy' }
  )
}
