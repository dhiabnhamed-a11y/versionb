import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute, parseJsonObject } from '@/lib/api'
import { createJournalEntry, listJournalEntries } from '@/modules/accounting/accounting.service'
import { parsePagination } from '@/modules/shared/pagination'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const pagination = parsePagination(req, { pageSize: 30, maxPageSize: 100 })
  return apiData(await listJournalEntries(user, pagination))
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
undefined,
async ({ user }) => {
  const body = await parseJsonObject(req)
  return apiData(await createJournalEntry(user, body), { status: 201 })
},
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
