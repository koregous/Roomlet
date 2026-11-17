import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { getUserStorageQuota } from '@/shared/lib/storage-quota'

/**
 * GET /api/storage/quota
 * 
 * Returns current user's storage quota information
 */
export async function GET() {
  // ── 1. Authentication ────────────────────────────────────────────
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Get storage quota ─────────────────────────────────────────
  try {
    const quota = await getUserStorageQuota(user.id)
    
    return NextResponse.json({
      quota: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        percentage: quota.percentage,
        isOverLimit: quota.isOverLimit,
      },
    })
  } catch (error) {
    console.error('[storage/quota] Failed to get quota:', error)
    return NextResponse.json(
      { error: 'Failed to fetch storage quota' },
      { status: 500 }
    )
  }
}
