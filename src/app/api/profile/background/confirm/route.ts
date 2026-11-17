import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { incrementStorageUsage } from '@/shared/lib/storage-quota'

export const dynamic = 'force-dynamic'

// ── POST /api/profile/background/confirm ────────────────────────────────────
// Confirms a successful direct upload and updates the profile

export async function POST(request: Request) {
  // ── 1. Auth check ─────────────────────────────────────────────────────────
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse request body ─────────────────────────────────────────────────
  let body: { 
    publicUrl: string
    backgroundType: 'video' | 'gif' | 'image'
    fileSize: number
    isNSFW: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { publicUrl, backgroundType, fileSize, isNSFW } = body

  if (!publicUrl || !backgroundType || !fileSize) {
    return NextResponse.json(
      { error: 'Missing required fields: publicUrl, backgroundType, fileSize' },
      { status: 400 }
    )
  }

  // ── 3. Update storage usage ───────────────────────────────────────────────
  try {
    await incrementStorageUsage(user.id, fileSize)
  } catch (err) {
    console.error('[background/confirm] Failed to update storage usage:', err)
    // Continue anyway - this is not critical for the upload
  }

  // ── 4. Update profile with background info ───────────────────────────────
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      profile_background_url: publicUrl,
      profile_background_type: backgroundType,
      background_is_nsfw: isNSFW,
      profile_background_poster_url: null, // TODO: Generate poster for videos
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[background/confirm] Failed to update profile:', updateError)
    return NextResponse.json(
      { error: 'Failed to save background to profile' },
      { status: 500 }
    )
  }

  // ── 5. Return success ─────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    backgroundUrl: publicUrl,
    type: backgroundType,
    message: 'Background uploaded successfully!'
  })
}
