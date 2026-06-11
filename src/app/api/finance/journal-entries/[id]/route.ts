import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { getJournalEntry } from '@/modules/accounting/accounting.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ params, user }) => apiData(await getJournalEntry(user, params.id)),
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
