import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseKey) return null
  browserClient ??= createClient(supabaseUrl, supabaseKey)
  return browserClient
}

export const supabase = getSupabaseBrowserClient()
