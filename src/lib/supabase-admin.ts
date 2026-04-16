import { createClient } from '@supabase/supabase-js'

/** Server-only: uses service role key. Never import in client components. */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for camera uploads')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export const PROJECT_CAMERA_BUCKET = process.env.SUPABASE_PROJECT_CAMERA_BUCKET || 'project-camera'
