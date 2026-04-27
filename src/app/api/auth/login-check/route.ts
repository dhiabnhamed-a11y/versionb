import { NextRequest, NextResponse } from 'next/server'

import { validateCredentialsForLogin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    email?: string
    password?: string
  }

  if (!body.email?.trim() || !body.password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const result = await validateCredentialsForLogin(body.email, body.password)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
