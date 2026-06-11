import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { reverseJournalEntry } from '@/modules/accounting/accounting.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ params, user }) => {
  const body = await parseJsonObject(req)
  return apiData(await reverseJournalEntry(user, params.id, body))
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
