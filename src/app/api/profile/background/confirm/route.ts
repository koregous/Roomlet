import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { checkStorageQuota, incrementStorageUsage, formatBytes } from '@/shared/lib/storage-quota'
import { getPublicUrl, getR2ObjectInfo, deleteFromR2 } from '@/shared/lib/r2-storage'
import {
  canAddSlide,
  getProfileBackgroundSlides,
  isOwnBackgroundUrl,
  legacyColumnsFor,
  normalizeBackgroundInterval,
  slideTypeForContentType,
} from '@/shared/lib/background-slides'

export const dynamic = 'force-dynamic'

const MAX_BACKGROUND_SIZE = 10 * 1024 * 1024 // 10MB

// Called after the browser has uploaded a file straight to R2 (presigned URL).
// Appends it to the profile's background slideshow.
//
// Nothing the browser says about the file is trusted: the URL must be inside the
// user's own folder, and the real size/type are read back from R2.

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, is_premium, profile_background_slides, profile_background_url, profile_background_type, profile_background_interval_seconds')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.is_premium) {
    return NextResponse.json(
      {
        error: 'Premium subscription required',
        message: 'Profile backgrounds are a premium feature.',
      },
      { status: 403 }
    )
  }

  let body: { publicUrl?: unknown; isNSFW?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const publicUrl = body.publicUrl
  if (typeof publicUrl !== 'string' || publicUrl.length === 0) {
    return NextResponse.json({ error: 'Missing required field: publicUrl' }, { status: 400 })
  }

  // The file must live in this user's own background folder
  const ownPrefix = getPublicUrl(`roomlet/${user.id}/profile-background/`)
  if (!isOwnBackgroundUrl(publicUrl, ownPrefix)) {
    return NextResponse.json({ error: 'Invalid file location' }, { status: 400 })
  }

  const slides = getProfileBackgroundSlides(profile)
  const intervalSeconds = normalizeBackgroundInterval(profile.profile_background_interval_seconds)

  // Retried confirm for a file we already added: succeed without duplicating it
  if (slides.some(s => s.url === publicUrl)) {
    return NextResponse.json({ success: true, slides, intervalSeconds })
  }

  // From here on, a rejected upload must not be left orphaned in R2
  const reject = async (status: number, error: string, extra?: Record<string, unknown>) => {
    try {
      await deleteFromR2(publicUrl)
    } catch (cleanupError) {
      console.error('[background/confirm] Failed to clean up rejected upload:', cleanupError)
    }
    return NextResponse.json({ error, ...extra }, { status })
  }

  const info = await getR2ObjectInfo(publicUrl)
  if (!info) {
    return NextResponse.json(
      { error: 'Upload not found. Please try uploading again.' },
      { status: 400 }
    )
  }

  const type = slideTypeForContentType(info.contentType)
  if (!type) {
    return reject(400, 'Invalid file type. Allowed: MP4, WebM, GIF, JPG, PNG, WebP')
  }

  if (info.size <= 0 || info.size > MAX_BACKGROUND_SIZE) {
    return reject(413, `Maximum file size is ${formatBytes(MAX_BACKGROUND_SIZE)}.`)
  }

  const allowed = canAddSlide(slides, type)
  if (!allowed.ok) {
    return reject(409, allowed.reason)
  }

  const quotaCheck = await checkStorageQuota(user.id, info.size)
  if (!quotaCheck.allowed) {
    return reject(413, quotaCheck.error ?? 'Storage quota exceeded')
  }

  const newSlides = [...slides, { url: publicUrl, type, size: info.size }]

  const update: Record<string, unknown> = {
    profile_background_slides: newSlides,
    ...legacyColumnsFor(newSlides),
    updated_at: new Date().toISOString(),
  }
  if (typeof body.isNSFW === 'boolean') {
    update.background_is_nsfw = body.isNSFW
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(update)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[background/confirm] Failed to update profile:', updateError)
    return reject(500, 'Failed to save background to profile')
  }

  try {
    await incrementStorageUsage(user.id, info.size)
  } catch (err) {
    console.error('[background/confirm] Failed to update storage usage:', err)
    // Not critical for the upload itself
  }

  return NextResponse.json({
    success: true,
    slides: newSlides,
    intervalSeconds,
    message: 'Background added successfully!',
  })
}
