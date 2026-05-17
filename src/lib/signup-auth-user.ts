import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { AppError } from '@/modules/shared/errors'
import { logger } from '@/modules/shared/logger'

type CreateSignupAuthUserInput = {
  email: string
  password: string
  metadata: Record<string, unknown>
  source: 'owner_signup' | 'invite_signup'
}

export async function createSignupAuthUser(input: CreateSignupAuthUserInput) {
  const hasSupabaseAdminConfig = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (!hasSupabaseAdminConfig) {
    logger.warn('signup.supabase_admin_config_missing', {
      source: input.source,
      emailDomain: input.email.split('@')[1] ?? 'unknown',
    })
    return { authUserId: null as string | null }
  }

  const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      ...input.metadata,
      taskit_onboarding: true,
    },
  })

  if (error || !data.user) {
    if (error?.message?.toLowerCase().includes('already')) {
      throw new AppError('That email is already registered in Supabase Auth.', { status: 409, code: 'CONFLICT' })
    }

    throw new AppError(error?.message ?? 'Supabase Auth user creation failed.', { status: 500, code: 'SUPABASE_AUTH_ERROR' })
  }

  return { authUserId: data.user.id }
}

export async function rollbackSignupAuthUser(authUserId: string | null, source: 'owner_signup' | 'invite_signup') {
  if (!authUserId) return

  try {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(authUserId)
    if (error) {
      logger.error('signup.supabase_auth_rollback_failed', error, { source, authUserId })
    }
  } catch (error) {
    logger.error('signup.supabase_auth_rollback_unexpected', error, { source, authUserId })
  }
}
