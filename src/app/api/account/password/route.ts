import { NextResponse } from 'next/server'
import { RateLimits } from '@/shared/lib/rate-limit'
import { changePasswordBody } from '@/shared/lib/validation/account-schemas'
import {
  getSupabaseAdminClient,
  jsonError,
  limitOr429,
  readJson,
  requireUser,
  verifyPassword,
} from '@/shared/lib/auth/account-server'

export const dynamic = 'force-dynamic'

/** POST /api/account/password  Body: { currentPassword, newPassword } */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const blocked = limitOr429(`account:password:${user.id}`, RateLimits.ACCOUNT_SENSITIVE)
  if (blocked) return blocked

  const parsed = changePasswordBody.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
  }
  const { currentPassword, newPassword } = parsed.data

  if (currentPassword === newPassword) {
    return jsonError('Your new password must be different from the current one', 400)
  }

  if (!(await verifyPassword(user.email, currentPassword))) {
    return jsonError('Current password is incorrect', 403)
  }

  // The current password was just verified, so update through the admin API. This avoids
  // Supabase's "recent login required" rule rejecting people whose session is older than 24h.
  const admin = getSupabaseAdminClient()
  if (!admin) return jsonError('Password changes are not available right now', 503)

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) {
    console.error('[account/password] update failed:', error.message)
    return jsonError(error.message || 'Could not update password', 400)
  }

  // Sign out every other device; keep this one. Best-effort: the password is already changed.
  try {
    await supabase.auth.signOut({ scope: 'others' })
  } catch (err) {
    console.warn('[account/password] could not revoke other sessions:', err)
  }

  return NextResponse.json({ ok: true })
}
