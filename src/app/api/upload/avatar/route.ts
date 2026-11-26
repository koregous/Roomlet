import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  uploadFile,
  STORAGE_CONFIGURED,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
  STORAGE_PROVIDER,
} from '@/shared/lib/storage'
import { withAutoOptimisation } from '@/shared/lib/cloudinary'
import { checkRateLimit, getClientIP, RateLimits } from '@/shared/lib/rate-limit'
import { checkStorageQuota, incrementStorageUsage, formatBytes } from '@/shared/lib/storage-quota'

export async function POST(request: Request) {
  // Rate limiting — cheapest check first
  const ip = getClientIP(request)
  const rateLimitResult = checkRateLimit(ip, RateLimits.PROFILE_UPLOAD)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many upload requests. Please try again later.' },
      {
        status: 429,
        headers: rateLimitResult.headers,
      }
    )
  }

  if (!STORAGE_CONFIGURED) {
    return NextResponse.json(
      { error: 'Image upload is not configured. Contact support.' },
      { status: 503 }
    )
  }

  // Auth — second cheapest check
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  // Validate before uploading
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10 MB.' },
      { status: 400 }
    )
  }

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
      { status: 413 } // 413 Payload Too Large
    )
  }

  // Automatically uses R2 (if configured) or falls back to Cloudinary
  try {
    const uploadResult = await uploadFile(file.stream(), {
      folder: `roomlet/${user.id}/avatars`,
      fileName: file.name,
      contentType: file.type,
    })

    await incrementStorageUsage(user.id, file.size)

    // Apply Cloudinary URL optimization if using Cloudinary
    // R2 URLs pass through unchanged
    const finalUrl = uploadResult.provider === 'cloudinary' 
      ? withAutoOptimisation(uploadResult.url)
      : uploadResult.url

    return NextResponse.json(
      {
        url: finalUrl,
        publicId: uploadResult.key, // R2 key or Cloudinary public_id
        provider: uploadResult.provider,
      },
      { headers: rateLimitResult.headers }
    )
  } catch (err) {
    console.error(
      `[avatar/route] ${STORAGE_PROVIDER} upload failed:`,
      err instanceof Error ? err.message : 'unknown'
    )
    return NextResponse.json(
      { error: 'Avatar upload failed. Please try again.' },
      { status: 500 }
    )
  }
}