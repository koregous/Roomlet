import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'

// ── DELETE /api/profile/background ───────────────────────────────────────────

export async function DELETE(request: Request) {
  // ── 1. Auth check ─────────────────────────────────────────────────────────
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Get current profile to check if background exists ─────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('profile_background_url, profile_background_type')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.profile_background_url) {
    return NextResponse.json({ 
      success: true,
      message: 'No background to remove'
    })
  }

  // ── 3. Remove background from storage ─────────────────────────────────────
  // Extract file path from URL
  // URL format: https://storage.url/roomlet/{user_id}/profile-background/bg-123.mp4
  try {
    const urlParts = profile.profile_background_url.split('/')
    const folderAndFile = urlParts.slice(-3).join('/') // roomlet/{user_id}/profile-background/bg-123.mp4
    
    // Attempt to delete from storage (non-critical if fails)
    try {
      await supabase.storage
        .from('profile-media') // Assuming same bucket as other profile media
        .remove([folderAndFile])
    } catch (storageErr) {
      console.error('[background/delete] Storage deletion failed:', storageErr)
      // Continue anyway - we'll remove the reference from profile
    }

  } catch (err) {
    console.error('[background/delete] Error parsing URL:', err)
    // Continue - we'll at least clear the profile reference
  }

  // ── 4. Update profile to remove background ───────────────────────────────
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      profile_background_url: null,
      profile_background_type: null,
      background_is_nsfw: false,
      profile_background_poster_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[background/delete] Failed to update profile:', updateError)
    return NextResponse.json(
      { error: 'Failed to remove background from profile' },
      { status: 500 }
    )
  }

  // Note: We don't decrement storage_used_bytes here because:
  // 1. It's complex to track exact file sizes
  // 2. Storage is backfilled/recalculated periodically
  // 3. Being slightly over-counted is safer than under-counted

  return NextResponse.json({
    success: true,
    message: 'Background removed successfully'
  })
}
