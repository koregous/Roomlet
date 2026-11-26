import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { RateLimits } from '@/shared/lib/rate-limit'
import { loginBody } from '@/shared/lib/validation/account-schemas'
import { parseLoginIdentifier } from '@/shared/lib/auth/login-identifier'
import {
  getClientIP,
  getSupabaseAdminClient,
  jsonError,
  limitOr429,
  readJson,
} from '@/shared/lib/auth/account-server'

export const dynamic = 'force-dynamic'

// Same wording for "no such user" and "wrong password" so the endpoint can't be used
// to find out which usernames or emails exist.
const INVALID = 'Invalid login credentials'

/**
 * POST /api/auth/login
 * Body: { identifier: "email or username", password }
 *
 * A username is resolved to its email on the server (service role), then the normal
 * Supabase password sign-in runs here so the session cookie is set as usual. The email
 * is never sent back to the browser.
 */
export async function POST(request: Request) {
  const body = loginBody.safeParse(await readJson(request))
  if (!body.success) return jsonError('Please fill in all fields', 400)

  const { identifier, password } = body.data
  const parsed = parseLoginIdentifier(identifier)
  if (parsed.kind === 'invalid') return jsonError(INVALID, 401)

  // Throttle per IP and per target account so one account can't be brute-forced
  // from many addresses, and one address can't spray many accounts.
  const blocked =
    limitOr429(`login:ip:${getClientIP(request)}`, RateLimits.LOGIN) ||
    limitOr429(`login:id:${parsed.value}`, RateLimits.LOGIN)
  if (blocked) return blocked

  let email: string
  if (parsed.kind === 'email') {
    email = parsed.value
  } else {
    const admin = getSupabaseAdminClient()
    if (!admin) {
      console.error('[login] SUPABASE_SERVICE_ROLE_KEY is not configured; username login unavailable')
      return jsonError('Username login is not available right now. Use your email instead.', 503)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('username', parsed.value)
      .maybeSingle()
    if (!profile) return jsonError(INVALID, 401)

    const { data: authUser, error } = await admin.auth.admin.getUserById(profile.user_id)
    if (error || !authUser?.user?.email) return jsonError(INVALID, 401)
    email = authUser.user.email
  }

  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (/email not confirmed/i.test(error.message)) {
      return jsonError('Please confirm your email address first. Check your inbox.', 403)
    }
    return jsonError(INVALID, 401)
  }

  return NextResponse.json({ ok: true })
}
