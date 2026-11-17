import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  uploadFile,
  STORAGE_CONFIGURED,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE,
} from '@/shared/lib/storage'
import { checkRateLimit, getClientIP, RateLimits } from '@/shared/lib/rate-limit'

// ── POST /api/upload/banner ─────────────────────────────────
export async function POST(request: Request) {
  // ── 0. Rate limiting — cheapest check first ─────────────────
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

  // ── 1. Auth — second cheapest check ──────────────────────────
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse form data ───────────────────────────────────────
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

  // ── 3. Validate before uploading ─────────────────────────────
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

  // ── 4. Upload to R2 storage (no buffering) ───────────────────
  try {
    const uploadResult = await uploadFile(file.stream(), {
      folder: `roomlet/${user.id}/banners`,
      fileName: file.name,
      contentType: file.type,
    })

    return NextResponse.json(
      {
        url: uploadResult.url,
        publicId: uploadResult.key, // R2 key
        provider: uploadResult.provider,
      },
      { headers: rateLimitResult.headers }
    )
  } catch (err) {
    console.error('[banner/route] Upload failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'Banner upload failed. Please try again.' },
      { status: 500 }
    )
  }
}