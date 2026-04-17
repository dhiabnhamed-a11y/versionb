import { NextRequest, NextResponse } from 'next/server'
import { InviteFlowError, redeemInviteSignup } from '@/lib/invites'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, inviteCode } = (await req.json()) as {
      name?: string
      email?: string
      password?: string
      inviteCode?: string
    }

    if (!name || !email || !password || !inviteCode) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const user = await redeemInviteSignup({
      name,
      email,
      password,
      inviteCode,
    })

    return NextResponse.json({ success: true, userId: user.id }, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof InviteFlowError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }

    console.error(err)
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message, details: String(err) }, { status: 500 })
  }
}
