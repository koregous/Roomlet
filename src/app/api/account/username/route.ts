import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { RateLimits } from '@/shared/lib/rate-limit'
import {
  USERNAME_COOLDOWN_DAYS,
  USERNAME_HOLD_DAYS,
  changeUsernameBody,
  usernameSchema,
} from '@/shared/lib/validation/account-schemas'
import { isReservedUsername } from '@/shared/lib/reservedUsernames'
import { containsProfanity } from '@/shared/lib/content-moderation'
import {
  getSupabaseAdminClient,
  jsonError,
  limitOr429,
  readJson,
  requireUser,
  verifyPassword,
} from '@/shared/lib/auth/account-server'

export const dynamic = 'force-dynamic'

/** Checks that don't need the database. Returns an error message or null. */
function localUsernameProblem(username: string): string | null {
  if (isReservedUsername(username)) return 'This username is reserved and cannot be used'
  if (containsProfanity(username)) return 'This username contains inappropriate language'
  return null
}

/**
 * GET /api/account/username?u=name
 * Live availability check for the settings form.
 */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const blocked = limitOr429(`account:username-check:${auth.user.id}`, { limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const parsed = usernameSchema.safeParse(new URL(request.url).searchParams.get('u') ?? '')
  if (!parsed.success) {
    return NextResponse.json({ available: false, reason: parsed.error.issues[0]?.message })
  }
  const username = parsed.data

  const problem = localUsernameProblem(username)
  if (problem) return NextResponse.json({ available: false, reason: problem })

  const admin = getSupabaseAdminClient()
  if (!admin) return jsonError('Username changes are not available right now', 503)

  const { data: me } = await admin.from('profiles').select('id, username').eq('user_id', auth.user.id).maybeSingle()
  if (me?.username === username) {
    return NextResponse.json({ available: false, reason: 'That is already your username' })
  }

  const [{ data: taken }, { data: held }] = await Promise.all([
    admin.from('profiles').select('id').eq('username', username).maybeSingle(),
    admin
      .from('username_history')
      .select('profile_id')
      .eq('old_username', username)
      .gt('reserved_until', new Date().toISOString())
      .maybeSingle(),
  ])

  const heldByOther = held && held.profile_id !== me?.id
  if (taken || heldByOther) {
    return NextResponse.json({ available: false, reason: 'That username is taken' })
  }
  return NextResponse.json({ available: true })
}

/**
 * POST /api/account/username  Body: { username, password }
 * Renames the account. Allowed once every USERNAME_COOLDOWN_DAYS; the old name keeps
 * redirecting to the new profile and stays reserved for USERNAME_HOLD_DAYS.
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { user } = auth

  const blocked = limitOr429(`account:username:${user.id}`, RateLimits.ACCOUNT_SENSITIVE)
  if (blocked) return blocked

  const parsed = changeUsernameBody.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
  }
  const { username, password } = parsed.data

  const problem = localUsernameProblem(username)
  if (problem) return jsonError(problem, 400)

  if (!(await verifyPassword(user.email, password))) {
    return jsonError('Password is incorrect', 403)
  }

  const admin = getSupabaseAdminClient()
  if (!admin) return jsonError('Username changes are not available right now', 503)

  const { data, error } = await admin.rpc('change_username', {
    p_user_id: user.id,
    p_new_username: username,
    p_cooldown: `${USERNAME_COOLDOWN_DAYS} days`,
    p_hold: `${USERNAME_HOLD_DAYS} days`,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('USERNAME_COOLDOWN')) {
      const parsedDate = new Date(msg.split('USERNAME_COOLDOWN:')[1]?.trim() ?? '')
      return jsonError(
        `You can only change your username once every ${USERNAME_COOLDOWN_DAYS} days.`,
        429,
        { nextChangeAt: Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString() }
      )
    }
    if (msg.includes('USERNAME_TAKEN')) return jsonError('That username is taken', 409)
    if (msg.includes('USERNAME_RESERVED')) return jsonError('This username is reserved and cannot be used', 400)
    if (msg.includes('USERNAME_SAME')) return jsonError('That is already your username', 400)
    if (msg.includes('USERNAME_INVALID')) return jsonError('Invalid username format', 400)
    if (msg.includes('PROFILE_NOT_FOUND')) return jsonError('Profile not found', 404)
    if (/function .*change_username/i.test(msg)) {
      console.error('[account/username] migration 051 has not been applied:', msg)
      return jsonError('Username changes are not set up yet', 503)
    }
    console.error('[account/username] rpc failed:', msg)
    return jsonError('Could not change username', 500)
  }

  const result = data as { old_username: string; new_username: string }

  revalidatePath(`/${result.old_username}`)
  revalidatePath(`/${result.new_username}`)
  revalidatePath('/creators')
  revalidatePath('/gallery')

  return NextResponse.json({ ok: true, username: result.new_username, previousUsername: result.old_username })
}
