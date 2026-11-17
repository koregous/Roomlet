import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { deleteFile } from '@/shared/lib/storage'
import { getPublicUrl } from '@/shared/lib/r2-storage'
import { decrementStorageUsage } from '@/shared/lib/storage-quota'
import {
  BACKGROUND_INTERVAL_OPTIONS,
  getProfileBackgroundSlides,
  isOwnBackgroundUrl,
  isPermutationOfUrls,
  legacyColumnsFor,
  normalizeBackgroundInterval,
} from '@/shared/lib/background-slides'

export const dynamic = 'force-dynamic'

const PROFILE_COLUMNS =
  'id, profile_background_slides, profile_background_url, profile_background_type, profile_background_interval_seconds, background_is_nsfw'

// ── DELETE /api/profile/background ───────────────────────────────────────────
// ?url=<slide url>  removes just that slide
// (no url)          removes the whole background

export async function DELETE(request: Request) {
  // ── 1. Auth check ─────────────────────────────────────────────────────────
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Current profile ────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const slides = getProfileBackgroundSlides(profile)
  if (slides.length === 0) {
    return NextResponse.json({ success: true, slides: [], message: 'No background to remove' })
  }

  const targetUrl = new URL(request.url).searchParams.get('url')
  const removed = targetUrl ? slides.filter(s => s.url === targetUrl) : slides
  const remaining = targetUrl ? slides.filter(s => s.url !== targetUrl) : []

  if (targetUrl && removed.length === 0) {
    return NextResponse.json({ error: 'Background image not found' }, { status: 404 })
  }

  // ── 3. Update profile first (so a storage hiccup never leaves a dead link) ─
  const update: Record<string, unknown> = {
    profile_background_slides: remaining,
    ...legacyColumnsFor(remaining),
    updated_at: new Date().toISOString(),
  }
  if (remaining.length === 0) {
    update.background_is_nsfw = false
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(update)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[background/delete] Failed to update profile:', updateError)
    return NextResponse.json({ error: 'Failed to remove background from profile' }, { status: 500 })
  }

  // ── 4. Remove the files from storage (R2) and release quota ───────────────
  // Only ever delete objects inside this user's own folder, whatever the row says.
  const ownPrefix = getPublicUrl(`roomlet/${user.id}/profile-background/`)
  let freedBytes = 0

  await Promise.all(
    removed.map(async slide => {
      if (!isOwnBackgroundUrl(slide.url, ownPrefix)) return
      try {
        const result = await deleteFile(slide.url)
        if (result.success) freedBytes += slide.size
        else console.error('[background/delete] Storage deletion failed:', result.error)
      } catch (err) {
        console.error('[background/delete] Storage deletion error:', err)
        // Non-critical: the reference is already gone from the profile
      }
    })
  )

  if (freedBytes > 0) {
    await decrementStorageUsage(user.id, freedBytes)
  }

  return NextResponse.json({
    success: true,
    slides: remaining,
    message: targetUrl ? 'Image removed' : 'Background removed successfully',
  })
}

// ── PATCH /api/profile/background ────────────────────────────────────────────
// Body (all optional, at least one required):
//   order:           string[]  new slide order (must be a permutation of current urls)
//   intervalSeconds: number    one of BACKGROUND_INTERVAL_OPTIONS
//   isNSFW:          boolean   applies to the whole background

export async function PATCH(request: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { order?: unknown; intervalSeconds?: unknown; isNSFW?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  let slides = getProfileBackgroundSlides(profile)
  const update: Record<string, unknown> = {}

  if (body.order !== undefined) {
    if (!isPermutationOfUrls(body.order, slides)) {
      return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
    }
    const byUrl = new Map(slides.map(s => [s.url, s]))
    slides = body.order.map(url => byUrl.get(url)!)
    update.profile_background_slides = slides
    Object.assign(update, legacyColumnsFor(slides))
  }

  if (body.intervalSeconds !== undefined) {
    const valid = (BACKGROUND_INTERVAL_OPTIONS as readonly number[]).includes(body.intervalSeconds as number)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })
    }
    update.profile_background_interval_seconds = body.intervalSeconds
  }

  if (body.isNSFW !== undefined) {
    if (typeof body.isNSFW !== 'boolean') {
      return NextResponse.json({ error: 'Invalid isNSFW' }, { status: 400 })
    }
    update.background_is_nsfw = body.isNSFW
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  update.updated_at = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('profiles')
    .update(update)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[background/patch] Failed to update profile:', updateError)
    return NextResponse.json({ error: 'Failed to update background' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    slides,
    intervalSeconds: normalizeBackgroundInterval(
      update.profile_background_interval_seconds ?? profile.profile_background_interval_seconds
    ),
    isNSFW: typeof update.background_is_nsfw === 'boolean'
      ? update.background_is_nsfw
      : !!profile.background_is_nsfw,
  })
}
