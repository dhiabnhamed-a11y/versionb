import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Supabase Realtime is opt-in. The app delivers live updates over the
// socket + polling fallback, so we only open the Realtime WebSocket when
// it is explicitly enabled AND properly configured on the Supabase project.
// This prevents failed `wss://…/realtime/v1/websocket` connections (and the
// reconnect spam in the console) on projects without Realtime enabled.
const realtimeEnabled = process.env.NEXT_PUBLIC_SUPABASE_REALTIME === 'true'

let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === 'undefined') return null
  if (!realtimeEnabled) return null
  if (!supabaseUrl || !supabaseKey) return null
  browserClient ??= createClient(supabaseUrl, supabaseKey)
  return browserClient
}

// Ensure we do not initialize the browser client during server render/import time.
export const supabase = typeof window === 'undefined' ? null : getSupabaseBrowserClient()
