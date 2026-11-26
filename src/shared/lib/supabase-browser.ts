'use client'

import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

/**
 * Returns a singleton Supabase client for use in Client Components.
 * Safe to cache in the browser — one tab, one user, one client.
 * Uses @supabase/ssr (successor to the removed @supabase/auth-helpers-nextjs).
 */
export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
