/**
 * POST /api/upload/confirm
 * 
 * Confirms a successful upload and increments user storage quota.
 * Called by client after presigned upload completes.
 * 
 * Flow:
 * 1. Client uploads to R2 using presigned URL
 * 2. Client calls this endpoint with key and size
 * 3. Server increments user storage usage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { incrementStorageUsage } from '@/shared/lib/storage-quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ConfirmRequest {
  key: string    // R2 object key
  size: number   // File size in bytes
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ConfirmRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }

  const { key, size } = body

  if (!key || typeof size !== 'number' || size <= 0) {
    return NextResponse.json(
      { error: 'Missing required fields: key, size' },
      { status: 400 }
    )
  }

  if (!key.startsWith(`roomlet/${user.id}/`)) {
    return NextResponse.json(
      { error: 'Invalid key - does not belong to user' },
      { status: 403 }
    )
  }

  try {
    await incrementStorageUsage(user.id, size)

    return NextResponse.json({
      success: true,
      message: 'Upload confirmed',
    })
  } catch (error) {
    console.error('[confirm/route] Failed to increment storage:', error)
    return NextResponse.json(
      { error: 'Failed to update storage quota' },
      { status: 500 }
    )
  }
}
