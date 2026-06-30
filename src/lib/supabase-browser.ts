'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

// Anon-key client for browser-side Realtime subscriptions. Read-only access
// is enforced by RLS; the service-role client at src/lib/supabase.ts stays
// server-only.
export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  _client = createClient(url, key, {
    auth: { persistSession: false },
  })
  return _client
}
