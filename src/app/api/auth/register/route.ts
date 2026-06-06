import { NextRequest, NextResponse } from 'next/server'
import { createOwnerSignup, isSignupRole } from '@/lib/onboarding'
import type { CompanyType } from '@/lib/company-types'
import { getWorkspaceHomePath } from '@/lib/workspace-routing'
import { assertSignupLegalAcceptance, getLegalRequestContext } from '@/lib/legal'
import { redeemInviteSignup } from '@/lib/invites'
import { withApiError } from '@/modules/shared/api'
import { logger } from '@/modules/shared/logger'
import { assertPasswordPolicy } from '@/modules/security/password-policy'
import { createDodoWorkspaceCheckout } from '@/lib/dodo-workspace-billing'
import { getDefaultPlanForWorkspace, getWorkspacePlan, isFreePlan, type BillingCycle } from '@/lib/workspace-pricing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return withApiError(
    req,
    async ({ requestId }) => {
      const body = (await req.json().catch(() => ({}))) as {
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
        locale?: string
        billingSelection?: {
          planId?: string
          seatCount?: number
          isolationEnabled?: boolean
          billingCycle?: string
        }
      }
      const { name, email, password, role, companyName, inviteCode, companyType, country, industry, registrationNumber } = body
      const legalAcceptance = assertSignupLegalAcceptance(body)
      const legalContext = getLegalRequestContext(req, requestId, body.locale)

      if (!name?.trim() || !email?.trim() || !password || !role?.trim()) {
        return NextResponse.json({ error: 'Full name, email, password, and role are required.' }, { status: 400 })
      }

      assertPasswordPolicy(password, { email, name })

      const normalizedRole = role.trim().toUpperCase()

      if (!isSignupRole(normalizedRole)) {
        return NextResponse.json({ error: 'Invalid signup role.' }, { status: 400 })
      }

      // Keep the role split on the server so invite-only and owner-only rules cannot be bypassed in the UI.
      if (normalizedRole === 'OWNER') {
        if (!companyName?.trim()) {
          return NextResponse.json({ error: 'Company name is required for Owner signup.' }, { status: 400 })
        }
        const normalizedCompanyType = (companyType ?? 'OTHER').trim().toUpperCase() as CompanyType
        const selectedPlan =
          body.billingSelection?.planId
            ? getWorkspacePlan(normalizedCompanyType, body.billingSelection.planId)
            : getDefaultPlanForWorkspace(normalizedCompanyType)
        if (!selectedPlan) {
          return NextResponse.json({ error: 'Choose a valid plan for this workspace type.' }, { status: 400 })
        }
        const billingCycle: BillingCycle = body.billingSelection?.billingCycle === 'annual' ? 'annual' : 'monthly'
        try {
          const owner = await createOwnerSignup({
            name,
            email,
            password,
            companyName,
            country: country ?? '',
            industry: industry ?? '',
            registrationNumber: registrationNumber ?? '',
            companyType: normalizedCompanyType,
            billingSelection: {
              billingCycle,
              isolationEnabled: Boolean(body.billingSelection?.isolationEnabled),
              planId: selectedPlan.id,
              seatCount: Number(body.billingSelection?.seatCount ?? 1),
            },
            legalAcceptance,
            legalContext,
          })

          let checkout: Awaited<ReturnType<typeof createDodoWorkspaceCheckout>> = null
          let checkoutWarning: string | null = null

          if (!isFreePlan(selectedPlan)) {
            try {
              checkout = await createDodoWorkspaceCheckout({
                billingCycle,
                companyId: owner.companyId,
                companyType: normalizedCompanyType,
                customerEmail: email,
                customerName: name,
                isolationEnabled: Boolean(body.billingSelection?.isolationEnabled),
                planId: selectedPlan.id,
                seatCount: Number(body.billingSelection?.seatCount ?? 1),
              })
            } catch (checkoutError) {
              checkoutWarning =
                checkoutError instanceof Error ? checkoutError.message : 'Unable to create checkout session.'
              logger.warn('signup.checkout_creation_failed_after_workspace_created', {
                billingCycle,
                companyId: owner.companyId,
                companyType: normalizedCompanyType,
                planId: selectedPlan.id,
                reason: checkoutWarning,
              })
            }
          }

          return NextResponse.json(
            {
              success: true,
              userId: owner.userId,
              companyId: owner.companyId,
              checkoutUrl: checkout?.url ?? null,
              billingCheckoutWarning: checkoutWarning,
              workspaceHomePath: getWorkspaceHomePath({ role: 'OWNER', companyType: normalizedCompanyType }),
              message: checkout?.url
                ? 'Workspace created. Continue to Dodo Payments checkout to activate billing.'
                : checkoutWarning
                  ? 'Workspace created. Sign in and open Billing to finish payment setup.'
                  : 'Workspace created. Sign in to enter your provisioned TASKIT workspace.',
            },
            { status: 201 }
          )
        } catch (err) {
          if (err instanceof Error && err.message.includes('LEGAL_CONSENT_SIGNING_SECRET')) {
            return NextResponse.json({ error: 'Server misconfiguration: legal consent signing secret missing.' }, { status: 500 })
          }
          throw err
        }
      }

      if (!inviteCode?.trim()) {
        return NextResponse.json({ error: 'Invalid invite code.' }, { status: 400 })
      }

      try {
        const user = await redeemInviteSignup({
          name,
          email,
          password,
          inviteCode,
          requestedRole: normalizedRole,
          legalAcceptance,
          legalContext,
        })

        return NextResponse.json({ success: true, userId: user.id }, { status: 201 })
      } catch (err) {
        if (err instanceof Error && err.message.includes('LEGAL_CONSENT_SIGNING_SECRET')) {
          return NextResponse.json({ error: 'Server misconfiguration: legal consent signing secret missing.' }, { status: 500 })
        }
        throw err
      }
    },
    {
      rateLimit: {
        namespace: 'auth.register',
        windowMs: 60 * 60 * 1000,
        max: 8,
      },
      route: '/api/auth/register',
    }
  )
}
