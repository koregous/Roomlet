import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { checkRateLimit, getClientIP } from '@/shared/lib/rate-limit'

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

type AuthedResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>; user: User & { email: string } }
  | { ok: false; response: NextResponse }

/** Resolve the signed-in user from the session cookie, or a ready-made 401. */
export async function requireUser(): Promise<AuthedResult> {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user || !user.email) {
    return { ok: false, response: jsonError('Unauthorized', 401) }
  }
  return { ok: true, supabase, user: user as User & { email: string } }
}

/** Service-role client. Server only. Never import this from a client component. */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

/**
 * Check a password without touching the user's real session: sign in with a throwaway,
 * non-persistent client and discard the result.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase environment variables are not configured')

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  return !error
}

/** Returns a 429 response when the limit is exceeded, otherwise null. */
export function limitOr429(
  key: string,
  preset: { limit: number; windowMs: number }
): NextResponse | null {
  const result = checkRateLimit(key, preset)
  if (result.allowed) return null
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
  return NextResponse.json(
    { error: 'Too many attempts. Please wait a moment and try again.' },
    { status: 429, headers: { ...result.headers, 'Retry-After': String(retryAfter) } }
  )
}

export { getClientIP }

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
