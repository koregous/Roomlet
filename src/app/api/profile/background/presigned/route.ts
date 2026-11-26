import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import { generatePresignedUploadUrl, R2_CONFIGURED } from '@/shared/lib/r2-storage'
import { checkStorageQuota, formatBytes } from '@/shared/lib/storage-quota'
import { canAddSlide, getProfileBackgroundSlides } from '@/shared/lib/background-slides'

const MAX_BACKGROUND_SIZE = 10 * 1024 * 1024 // 10MB

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

export const dynamic = 'force-dynamic'

// Generates a presigned URL for direct browser upload to R2

export async function POST(request: Request) {
  if (!R2_CONFIGURED) {
    return NextResponse.json(
      { error: 'Storage is not configured. Contact support.' },
      { status: 503 }
    )
  }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, user_id, is_premium, storage_used_bytes, profile_background_slides, profile_background_url, profile_background_type')
    .eq('user_id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!profile.is_premium) {
    return NextResponse.json(
      { 
        error: 'Premium subscription required',
        message: 'Profile backgrounds are a premium feature. Upgrade to upload animated backgrounds.'
      },
      { status: 403 }
    )
  }

  let body: { fileName: string; fileSize: number; fileType: string; isNSFW?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { fileName, fileSize, fileType, isNSFW = false } = body

  if (!fileName || !fileSize || !fileType) {
    return NextResponse.json(
      { error: 'Missing required fields: fileName, fileSize, fileType' },
      { status: 400 }
    )
  }

  if (!ALLOWED_BACKGROUND_TYPES.has(fileType)) {
    return NextResponse.json(
      { 
        error: 'Invalid file type',
        message: 'Allowed formats: MP4, WebM, GIF, JPG, PNG, WebP'
      },
      { status: 400 }
    )
  }

  if (fileSize > MAX_BACKGROUND_SIZE) {
    return NextResponse.json(
      { 
        error: 'File too large',
        message: `Maximum file size is ${formatBytes(MAX_BACKGROUND_SIZE)}. Your file is ${formatBytes(fileSize)}.`
      },
      { status: 413 }
    )
  }

  const quotaCheck = await checkStorageQuota(user.id, fileSize)
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

  let backgroundType: 'video' | 'gif' | 'image'
  if (fileType.startsWith('video/')) {
    backgroundType = 'video'
  } else if (fileType === 'image/gif') {
    backgroundType = 'gif'
  } else {
    backgroundType = 'image'
  }

  // ── 8b. Slideshow rules: max slides, and no mixing video with other slides ─
  const slideCheck = canAddSlide(getProfileBackgroundSlides(profile), backgroundType)
  if (!slideCheck.ok) {
    return NextResponse.json({ error: slideCheck.reason }, { status: 409 })
  }

  try {
    const { uploadUrl, key, publicUrl } = await generatePresignedUploadUrl(
      {
        folder: `roomlet/${user.id}/profile-background`,
        fileName,
        contentType: fileType,
      },
      3600 // 1 hour expiration
    )

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      key,
      fileSize,
      backgroundType,
      isNSFW,
    })

  } catch (err) {
    console.error('[background/presigned] Failed to generate presigned URL:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'Failed to generate upload URL. Please try again.' },
      { status: 500 }
    )
  }
}
