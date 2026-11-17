import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { uploadFile, STORAGE_CONFIGURED } from '@/shared/lib/storage'
import { checkStorageQuota, incrementStorageUsage, formatBytes } from '@/shared/lib/storage-quota'

// Allowed file types for backgrounds
const ALLOWED_BACKGROUND_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const MAX_BACKGROUND_SIZE = 10 * 1024 * 1024 // 10MB

// Configure route segment for longer execution and dynamic rendering
export const maxDuration = 30 // 30 seconds timeout for uploads
export const dynamic = 'force-dynamic'

// ── POST /api/profile/background/upload ──────────────────────────────────────

export async function POST(request: Request) {
  if (!STORAGE_CONFIGURED) {
    return NextResponse.json(
      { error: 'Storage is not configured. Contact support.' },
      { status: 503 }
    )
  }

  // ── 1. Auth check ─────────────────────────────────────────────────────────
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Get user profile and check premium status ─────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, user_id, is_premium, storage_used_bytes')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── 3. Check if user is premium ───────────────────────────────────────────
  if (!profile.is_premium) {
    return NextResponse.json(
      { 
        error: 'Premium subscription required',
        message: 'Profile backgrounds are a premium feature. Upgrade to upload animated backgrounds.'
      },
      { status: 403 }
    )
  }

  // ── 4. Parse form data ────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const isNSFW = formData.get('isNSFW') === 'true'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // ── 5. Validate file type ─────────────────────────────────────────────────
  if (!ALLOWED_BACKGROUND_TYPES.has(file.type)) {
    return NextResponse.json(
      { 
        error: 'Invalid file type',
        message: 'Allowed formats: MP4, WebM, GIF, JPG, PNG, WebP'
      },
      { status: 400 }
    )
  }

  // ── 6. Validate file size ─────────────────────────────────────────────────
  if (file.size > MAX_BACKGROUND_SIZE) {
    return NextResponse.json(
      { 
        error: 'File too large',
        message: `Maximum file size is ${formatBytes(MAX_BACKGROUND_SIZE)}. Your file is ${formatBytes(file.size)}.`
      },
      { status: 413 }
    )
  }

  // ── 7. Check storage quota ────────────────────────────────────────────────
  const quotaCheck = await checkStorageQuota(user.id, file.size)
  if (!quotaCheck.allowed) {
    return NextResponse.json(
      {
        error: quotaCheck.error,
        quota: {
          used: formatBytes(quotaCheck.quota.used),
          limit: formatBytes(quotaCheck.quota.limit),
          remaining: formatBytes(quotaCheck.quota.remaining),
          percentage: Math.round(quotaCheck.quota.percentage),
        },
      },
      { status: 413 }
    )
  }

  // ── 8. Determine background type ──────────────────────────────────────────
  let backgroundType: 'video' | 'gif' | 'image'
  if (file.type.startsWith('video/')) {
    backgroundType = 'video'
  } else if (file.type === 'image/gif') {
    backgroundType = 'gif'
  } else {
    backgroundType = 'image'
  }

  // ── 9. Upload to storage ──────────────────────────────────────────────────
  try {
    const uploadResult = await uploadFile(file.stream(), {
      folder: `roomlet/${user.id}/profile-background`,
      fileName: `bg-${Date.now()}.${file.name.split('.').pop()}`,
      contentType: file.type,
    })

    // ── 10. Update storage usage ──────────────────────────────────────────────
    await incrementStorageUsage(user.id, file.size)

    // ── 11. Update profile with background info ──────────────────────────────
    // Note: Poster frame generation for videos would happen here (future enhancement)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        profile_background_url: uploadResult.url,
        profile_background_type: backgroundType,
        background_is_nsfw: isNSFW,
        profile_background_poster_url: null, // TODO: Generate poster for videos
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[background/upload] Failed to update profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to save background to profile' },
        { status: 500 }
      )
    }

    // ── 12. Return success ────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      backgroundUrl: uploadResult.url,
      type: backgroundType,
      posterUrl: null, // TODO: Generate poster for videos
      message: 'Background uploaded successfully!'
    })

  } catch (err) {
    console.error('[background/upload] Upload failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'Background upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
