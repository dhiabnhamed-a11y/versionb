import type { NextRequest } from 'next/server'
import { apiData, handleApiRoute } from '@/lib/api'
import { postExpense } from '@/modules/expenses/expense.service'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const POST = withApiHandler(async ({ req, params }) => {
return handleApiRoute(
req,
context,
async ({ params, user }) => apiData(await postExpense(user, params.id)),
{ auth: 'required', responseMode: 'legacy' }
)
}, { auth: 'required' });
