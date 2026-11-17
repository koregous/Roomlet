import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  uploadFile,
  STORAGE_CONFIGURED,
} from '@/shared/lib/storage'
import { checkRateLimit, getClientIP, RateLimits } from '@/shared/lib/rate-limit'

// ── POST /api/upload/og-banner ───────────────────────────────
// Uploads OpenGraph JPEG banner and updates profile.og_banner_url
export async function POST(request: Request) {
  // ── 0. Rate limiting ─────────────────────────────────────────
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
      { error: 'Storage not configured.' },
      { status: 503 }
    )
  }

  // ── 1. Auth ──────────────────────────────────────────────────
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
  const profileId = formData.get('profileId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!profileId) {
    return NextResponse.json({ error: 'profileId is required' }, { status: 400 })
  }

  // ── 3. Validate JPEG file ────────────────────────────────────
  if (file.type !== 'image/jpeg') {
    return NextResponse.json(
      { error: 'OG banner must be JPEG' },
      { status: 400 }
    )
  }

  // ── 4. Ownership check ───────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, og_banner_url')
    .eq('id', profileId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (profile.user_id !== user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // ── 5. Upload OG banner to R2 ────────────────────────────────
  try {
    const uploadResult = await uploadFile(file.stream(), {
      folder: `roomlet/${user.id}/og-banners`,
      fileName: `og-banner-${profileId}.jpg`,
      contentType: 'image/jpeg',
    })

    // ── 6. Update profile with og_banner_url ─────────────────────
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ og_banner_url: uploadResult.url })
      .eq('id', profileId)

    if (updateError) {
      console.error('[og-banner] Failed to update profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    console.log('[og-banner] Successfully uploaded and set OG banner for profile:', profileId)

    return NextResponse.json(
      {
        url: uploadResult.url,
        message: 'OG banner uploaded successfully',
      },
      { headers: rateLimitResult.headers }
    )
  } catch (err) {
    console.error('[og-banner] Upload failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'OG banner upload failed' },
      { status: 500 }
    )
  }
}
