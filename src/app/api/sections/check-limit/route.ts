import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { checkSectionLimit } from '@/shared/lib/section-limits'

/**
 * GET /api/sections/check-limit
 * 
 * Checks if the user can create a new section
 * Returns section limit status
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

  // ── 2. Check section limit ───────────────────────────────────────
  try {
    const limitCheck = await checkSectionLimit(user.id)
    
    // Convert Infinity to null for JSON serialization (client will interpret null as unlimited)
    const serializedLimit = limitCheck.limit.limit === Infinity ? null : limitCheck.limit.limit
    const serializedRemaining = limitCheck.limit.remaining === Infinity ? null : limitCheck.limit.remaining
    
    return NextResponse.json({
      allowed: limitCheck.allowed,
      error: limitCheck.error,
      limit: {
        count: limitCheck.limit.count,
        limit: serializedLimit,
        remaining: serializedRemaining,
        percentage: Math.round(limitCheck.limit.percentage),
      },
    })
  } catch (error) {
    console.error('[sections/check-limit] Failed to check limit:', error)
    return NextResponse.json(
      { error: 'Failed to check section limit' },
      { status: 500 }
    )
  }
}
