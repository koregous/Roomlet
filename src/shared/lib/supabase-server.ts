import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for Route Handlers and Server Actions.
 * Reads/writes cookies so the user's session is available server-side.
 *
 * BREAKING CHANGE in Next.js 15: cookies() is now async and returns
 * Promise<ReadonlyRequestCookies>. getSupabaseServerClient() must be
 * awaited everywhere it is called.
 */
  export async function getSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(key: string) {
          return cookieStore.get(key)?.value
        },
        set(key: string, value: string, options) {
          try {
            cookieStore.set({ name: key, value, ...options })
          } catch {
            // Called from a Server Component — cookies are read-only there.
            // Safe to ignore; the session will still be read correctly.
          }
        },
        remove(key: string, options) {
          try {
            cookieStore.set({ name: key, value: '', ...options })
          } catch {
            // Same as above — safe to ignore in Server Components.
          }
        },
      },
    }
  )
}