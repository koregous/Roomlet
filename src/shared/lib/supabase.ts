import { createServerClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in Server Components that only need
 * public/anon-key access (e.g. public profile pages).
 *
 * - Uses @supabase/ssr so the same library is used everywhere.
 * - No cookies needed — this client only reads public data with the anon key.
 * - Never cached at module scope: each call returns a new instance, preventing
 *   any cross-request state leaks in SSR/edge environments.
 * - NOT for authenticated operations — use getSupabaseServerClient() instead.
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    // During build without env vars, return a placeholder so the build
    // completes. Runtime requests will fail with a clear network error.
    if (typeof window !== 'undefined') {
      throw new Error('Missing Supabase environment variables')
    }
    return createServerClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
      { cookies: { get: () => undefined } }
    )
  }

  // No cookie store needed — public reads only, no session required.
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: { get: () => undefined },
  })
}

/**
 * Creates a Supabase client with service role privileges (bypasses RLS).
 * 
 * ⚠️ WARNING: Use with extreme caution!
 * - Only use in server-side code (Server Components, API routes)
 * - Never expose this client to the browser
 * - Only use for operations that explicitly require admin privileges
 * 
 * Use cases:
 * - Reading public bookmarks when RLS policies have issues
 * - Admin operations that need to bypass RLS
 * - Background jobs and cron tasks
 * 
 * @returns Service role client, or null if credentials are missing
 */
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[getSupabaseServiceClient] Missing service role credentials, returning null')
    return null
  }

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { get: () => undefined },
  })
}
