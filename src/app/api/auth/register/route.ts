import { NextRequest, NextResponse } from 'next/server'
import { createOwnerSignup, isSignupRole } from '@/lib/onboarding'
import type { CompanyType } from '@/lib/company-types'
import { redeemInviteSignup } from '@/lib/invites'
import { withApiError } from '@/modules/shared/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return withApiError(
    req,
    async () => {
      const { name, email, password, role, companyName, inviteCode, companyType, country, industry, registrationNumber } =
        (await req.json().catch(() => ({}))) as {
        name?: string
        email?: string
        password?: string
        role?: string
        companyName?: string
        inviteCode?: string
        companyType?: string
        country?: string
        industry?: string
        registrationNumber?: string
      }

      if (!name?.trim() || !email?.trim() || !password || !role?.trim()) {
        return NextResponse.json({ error: 'Full name, email, password, and role are required.' }, { status: 400 })
      }

      const normalizedRole = role.trim().toUpperCase()

      if (!isSignupRole(normalizedRole)) {
        return NextResponse.json({ error: 'Invalid signup role.' }, { status: 400 })
      }

      // Keep the role split on the server so invite-only and owner-only rules cannot be bypassed in the UI.
      if (normalizedRole === 'OWNER') {
        if (!companyName?.trim()) {
          return NextResponse.json({ error: 'Company name is required for Owner signup.' }, { status: 400 })
        }

        const owner = await createOwnerSignup({
          name,
          email,
          password,
          companyName,
          country: country ?? '',
          industry: industry ?? '',
          registrationNumber: registrationNumber ?? '',
          companyType: (companyType ?? 'OTHER').trim().toUpperCase() as CompanyType,
        })

        return NextResponse.json(
          {
            success: true,
            userId: owner.userId,
            companyId: owner.companyId,
            message: 'Registration submitted. A Super Admin must approve your company before you can sign in.',
          },
          { status: 201 }
        )
      }

      if (!inviteCode?.trim()) {
        return NextResponse.json({ error: 'Invalid invite code.' }, { status: 400 })
      }

      const user = await redeemInviteSignup({
        name,
        email,
        password,
        inviteCode,
        requestedRole: normalizedRole,
      })

      return NextResponse.json({ success: true, userId: user.id }, { status: 201 })
    },
    {
      rateLimit: {
        namespace: 'auth.register',
        windowMs: 60 * 60 * 1000,
        max: 8,
      },
    }
  )
}
