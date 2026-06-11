import { NextResponse } from 'next/server'

import { getInvitePreview } from '@/lib/invites'
import { withApiHandler } from "@/lib/api/handler";

export const runtime = 'nodejs'

export const GET = withApiHandler(async ({ req, params }) => {
const { code } = params

try {
const invite = await getInvitePreview(code)
if (!invite) {
  return NextResponse.json({ error: 'Invalid invite code.' }, { status: 404 })
}

return NextResponse.json({
  code: invite.code,
  invitedEmailMasked: invite.invitedEmailMasked,
  role: invite.role,
  companyName: invite.companyName,
  companyType: invite.companyType,
  expiresAt: invite.expiresAt,
})
} catch (error) {
console.error(error)
return NextResponse.json({ error: 'Failed to validate invite.' }, { status: 500 })
}
}, { auth: 'required' });
