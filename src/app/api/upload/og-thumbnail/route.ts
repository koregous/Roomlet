import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  uploadFile,
  STORAGE_CONFIGURED,
} from '@/shared/lib/storage'
import { checkRateLimit, getClientIP, RateLimits } from '@/shared/lib/rate-limit'

// Uploads OpenGraph JPEG thumbnail and updates section.og_image_url
export async function POST(request: Request) {
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
      { error: 'Storage not configured.' },
      { status: 503 }
    )
  }

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

  if (file.type !== 'image/jpeg') {
    return NextResponse.json(
      { error: 'OG thumbnail must be JPEG' },
      { status: 400 }
    )
  }

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

  // Only allow if og_image_url is not already set
  if (section.og_image_url) {
    console.log('[og-thumbnail] Section already has OG image, skipping')
    return NextResponse.json(
      { 
        message: 'Section already has OG thumbnail',
        url: section.og_image_url 
      },
      { headers: rateLimitResult.headers }
    )
  }

  try {
    const uploadResult = await uploadFile(file.stream(), {
      folder: `roomlet/${user.id}/og-thumbnails`,
      fileName: `og-${sectionId}.jpg`,
      contentType: 'image/jpeg',
    })

    const { error: updateError } = await supabase
      .from('sections')
      .update({ og_image_url: uploadResult.url })
      .eq('id', sectionId)

    if (updateError) {
      console.error('[og-thumbnail] Failed to update section:', updateError)
      // Note: Image is uploaded but DB update failed
      // Could implement cleanup here, but not critical
      return NextResponse.json(
        { error: 'Failed to update section' },
        { status: 500 }
      )
    }

    console.log('[og-thumbnail] Successfully uploaded and set OG image for section:', sectionId)

    return NextResponse.json(
      {
        url: uploadResult.url,
        message: 'OG thumbnail uploaded successfully',
      },
      { headers: rateLimitResult.headers }
    )
  } catch (err) {
    console.error('[og-thumbnail] Upload failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'OG thumbnail upload failed' },
      { status: 500 }
    )
  }
}
