import { NextResponse } from 'next/server'
import { RateLimits } from '@/shared/lib/rate-limit'
import { changeEmailBody } from '@/shared/lib/validation/account-schemas'
import {
  jsonError,
  limitOr429,
  readJson,
  requireUser,
  verifyPassword,
} from '@/shared/lib/auth/account-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/account/email  Body: { email, password }
 *
 * Starts an email change. Supabase emails a confirmation link; the address only changes
 * once the link is clicked (and, if "Secure email change" is on in the Supabase dashboard,
 * after the link sent to the old address is clicked too).
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const blocked = limitOr429(`account:email:${user.id}`, RateLimits.ACCOUNT_SENSITIVE)
  if (blocked) return blocked

  const parsed = changeEmailBody.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
  }
  const { email, password } = parsed.data

  if (email === user.email.toLowerCase()) {
    return jsonError('That is already your email address', 400)
  }

  if (!(await verifyPassword(user.email, password))) {
    return jsonError('Password is incorrect', 403)
  }

  const origin = new URL(request.url).origin
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${origin}/auth/callback?next=/dashboard/settings` }
  )

  if (error) {
    if (/already (been )?registered|already exists/i.test(error.message)) {
      return jsonError('That email address is already in use', 409)
    }
    console.error('[account/email] update failed:', error.message)
    return jsonError(error.message || 'Could not start the email change', 400)
  }

  return NextResponse.json({ ok: true, pendingEmail: email })
}
