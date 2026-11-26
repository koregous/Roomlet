import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  uploadFile,
  STORAGE_CONFIGURED,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from '@/shared/lib/storage'
import { checkRateLimit, getClientIP, RateLimits } from '@/shared/lib/rate-limit'
import { checkStorageQuota, incrementStorageUsage, formatBytes } from '@/shared/lib/storage-quota'

export async function POST(request: Request) {
  // Rate limiting — cheapest check first
  // Gallery uploads need higher limit for batch collection uploads (12-20 images)
  const ip = getClientIP(request)
  const rateLimitResult = checkRateLimit(ip, RateLimits.GALLERY_UPLOAD)

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
  const sectionId = formData.get('sectionId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!sectionId) {
    return NextResponse.json({ error: 'sectionId is required' }, { status: 400 })
  }

  // Validate file before any DB or storage work
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

  // Ownership check BEFORE uploading to storage
  // Previously this happened AFTER the file was buffered into memory,
  // meaning an unauthorized request would waste time and memory processing
  // the file before being rejected. Now we reject early.
  const { data: section } = await supabase
    .from('sections')
    .select('id, profile_id, og_image_url, profiles!inner(user_id)')
    .eq('id', sectionId)
    .single()

  if (!section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  const profileData = section.profiles as unknown as { user_id: string }
  if (profileData.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const isFirstImage = !section.og_image_url

  try {
    const uploadResult = await uploadFile(file.stream(), {
      folder: `roomlet/${user.id}/gallery`,
      fileName: file.name,
      contentType: file.type,
    })

    await incrementStorageUsage(user.id, file.size)

    // This is returned to client which will upload it separately
    const response: any = {
      url: uploadResult.url,
      publicId: uploadResult.key, // R2 key
      provider: uploadResult.provider,
      isFirstImage, // Tell client if this needs OG thumbnail
    }

    return NextResponse.json(response, { headers: rateLimitResult.headers })
  } catch (err) {
    console.error('[gallery/route] Upload failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'Image upload failed. Please try again.' },
      { status: 500 }
    )
  }
}