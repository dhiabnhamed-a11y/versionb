import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { reverseJournalEntry } from '@/modules/accounting/accounting.service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return handleApiRoute(
    req,
    context,
    async ({ params, user }) => {
      const body = await parseJsonObject(req)
      return apiData(await reverseJournalEntry(user, params.id, body))
    },
    { auth: 'required', responseMode: 'legacy' }
  )
}
