import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') return null
  if (!supabaseUrl || !supabaseKey) return null
  browserClient ??= createClient(supabaseUrl, supabaseKey)
  return browserClient
}

// Ensure we do not initialize the browser client during server render/import time.
export const supabase = typeof window === 'undefined' ? null : getSupabaseBrowserClient()
