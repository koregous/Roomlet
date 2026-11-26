import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { RateLimits } from '@/shared/lib/rate-limit'
import { deleteAccountBody } from '@/shared/lib/validation/account-schemas'
import { deleteMultipleFiles } from '@/shared/lib/storage'
import { extractStorageUrlsFromSections, isStorageUrl } from '@/shared/lib/section-assets'
import { parseBackgroundSlides } from '@/shared/lib/background-slides'
import type { Section } from '@/shared/lib/types'
import {
  getSupabaseAdminClient,
  jsonError,
  limitOr429,
  readJson,
  requireUser,
  verifyPassword,
} from '@/shared/lib/auth/account-server'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/account  Body: { password, confirmUsername }
 *
 * Permanently deletes the account.
 *
 * Order matters:
 *   1. Delete uploaded files first. If that fails we stop and nothing is lost, so the user
 *      can simply try again (deleting an already-deleted file counts as success).
 *   2. Delete the auth user. Foreign keys cascade to the profile, sections, bookmarks, etc.
 * Doing it the other way round would leave publicly reachable files with no owner.
 */
export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth

  const blocked = limitOr429(`account:delete:${user.id}`, RateLimits.ACCOUNT_SENSITIVE)
  if (blocked) return blocked

  const parsed = deleteAccountBody.safeParse(await readJson(request))
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid request', 400)
  }
  const { password, confirmUsername } = parsed.data

  const admin = getSupabaseAdminClient()
  if (!admin) return jsonError('Account deletion is not available right now', 503)

  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, username, is_admin, avatar_url, banner_url, og_banner_url, profile_background_url, profile_background_poster_url, profile_background_slides'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile) {
    if (profile.is_admin) {
      return jsonError('Admin accounts cannot be deleted here. Remove the admin role first.', 403)
    }
    if (confirmUsername !== profile.username) {
      return jsonError('The username you typed does not match', 400)
    }
  }

  if (!(await verifyPassword(user.email, password))) {
    return jsonError('Password is incorrect', 403)
  }

  if (profile) {
    const { data: sections, error: sectionsError } = await admin
      .from('sections')
      .select('*')
      .eq('profile_id', profile.id)
    if (sectionsError) {
      console.error('[DELETE /api/account] could not load sections:', sectionsError.message)
      return jsonError('Could not prepare your account for deletion. Nothing was deleted.', 500)
    }

    const slideUrls = parseBackgroundSlides(profile.profile_background_slides).map((s) => s.url)
    const urls = Array.from(
      new Set(
        [
          profile.avatar_url,
          profile.banner_url,
          profile.og_banner_url,
          profile.profile_background_url,
          profile.profile_background_poster_url,
          ...slideUrls,
          ...extractStorageUrlsFromSections((sections ?? []) as Section[]),
        ].filter((u): u is string => typeof u === 'string' && isStorageUrl(u))
      )
    )

    if (urls.length > 0) {
      const summary = await deleteMultipleFiles(urls)
      if (summary.failed > 0) {
        console.error(
          `[DELETE /api/account] ${summary.failed}/${summary.total} files could not be deleted`,
          summary.results.filter((r) => !r.success)
        )
        return jsonError(
          'We could not remove all of your uploaded files, so nothing was deleted. Please try again.',
          502
        )
      }
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('[DELETE /api/account] auth delete failed:', deleteError.message)
    return jsonError('Could not delete your account. Please try again.', 500)
  }

  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // The session is already invalid; the browser also clears it client-side.
  }

  if (profile) revalidatePath(`/${profile.username}`)
  revalidatePath('/creators')
  revalidatePath('/gallery')

  return NextResponse.json({ ok: true })
}
