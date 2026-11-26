import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import {
  CLOUDINARY_CONFIGURED,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  streamToCloudinary,
  withAutoOptimisation,
} from '@/shared/lib/cloudinary'

export async function POST(request: Request) {
  if (!CLOUDINARY_CONFIGURED) {
    return NextResponse.json(
      { error: 'Image upload is not configured. Contact support.' },
      { status: 503 }
    )
  }

  // Auth — cheapest check first
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

  // Validate before touching Cloudinary
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG.' },
      { status: 400 }
    )
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10 MB.' },
      { status: 400 }
    )
  }

  try {
    const uploadResult = await streamToCloudinary(file.stream(), {
      folder: `roomlet/${user.id}/avatars`,
      // Optimisation applied at delivery time via withAutoOptimisation(),
      // not at upload time — saves 200-800ms per upload.
    })

    return NextResponse.json({
      url: withAutoOptimisation(uploadResult.secure_url),
      publicId: uploadResult.public_id,
    })
  } catch (err) {
    console.error('[avatar/route] Cloudinary upload failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'Avatar upload failed. Please try again.' },
      { status: 500 }
    )
  }
}