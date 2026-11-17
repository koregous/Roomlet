/**
 * POST /api/upload/presign
 * 
 * Generates presigned URLs for direct client-to-R2 uploads.
 * This bypasses Vercel's 4.5MB body size limit.
 * 
 * Flow:
 * 1. Client requests presigned URL with file metadata
 * 2. Server validates auth, rate limits, file type/size
 * 3. Server generates presigned URL from R2
 * 4. Client uploads directly to R2 using that URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { generatePresignedUploadUrl, R2_CONFIGURED, ALLOWED_IMAGE_TYPES, ALLOWED_AUDIO_TYPES, MAX_IMAGE_SIZE, MAX_AUDIO_SIZE } from '@/shared/lib/r2-storage'
import { checkRateLimit, getClientIP, RateLimits } from '@/shared/lib/rate-limit'
import { checkStorageQuota, formatBytes } from '@/shared/lib/storage-quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PresignRequest {
  folder: string
  fileName: string
  contentType: string
  size: number
}

export async function POST(request: NextRequest) {
  // ── 1. Rate limiting ─────────────────────────────────────────────
  const clientIP = getClientIP(request)
  const rateLimitResult = checkRateLimit(clientIP, RateLimits.GALLERY_UPLOAD)

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Please try again later.',
        resetAt: rateLimitResult.resetAt,
      },
      { 
        status: 429,
        headers: rateLimitResult.headers 
      }
    )
  }

  // ── 2. Check if R2 is configured ─────────────────────────────────
  if (!R2_CONFIGURED) {
    return NextResponse.json(
      { error: 'File upload is not configured. Contact support.' },
      { status: 503 }
    )
  }

  // ── 3. Authentication ────────────────────────────────────────────
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 4. Parse and validate request ────────────────────────────────
  let body: PresignRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { folder, fileName, contentType, size } = body

  if (!folder || !fileName || !contentType || typeof size !== 'number') {
    return NextResponse.json(
      { error: 'Missing required fields: folder, fileName, contentType, size' },
      { status: 400 }
    )
  }

  // ── 5. Validate file type ────────────────────────────────────────
  const isImage = ALLOWED_IMAGE_TYPES.has(contentType)
  const isAudio = ALLOWED_AUDIO_TYPES.has(contentType)

  if (!isImage && !isAudio) {
    return NextResponse.json(
      {
        error: `File type not allowed: ${contentType}`,
        allowedTypes: [
          ...Array.from(ALLOWED_IMAGE_TYPES),
          ...Array.from(ALLOWED_AUDIO_TYPES),
        ],
      },
      { status: 400 }
    )
  }

  // ── 6. Validate file size ────────────────────────────────────────
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_AUDIO_SIZE
  if (size > maxSize) {
    return NextResponse.json(
      {
        error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
        maxSize,
        fileSize: size,
      },
      { status: 400 }
    )
  }

  // ── 6.5. Check storage quota ─────────────────────────────────────
  const quotaCheck = await checkStorageQuota(user.id, size)
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

  // ── 7. Generate presigned URL ────────────────────────────────────
  try {
    const result = await generatePresignedUploadUrl(
      {
        folder: `roomlet/${user.id}/${folder}`,
        fileName,
        contentType,
      },
      3600 // 1 hour expiration
    )

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      key: result.key,
    })
  } catch (error) {
    console.error('[presign/route] Failed to generate presigned URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    )
  }
}
