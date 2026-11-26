import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { getSupabaseServiceClient } from '@/shared/lib/supabase'
import { syncItemIndex } from '@/shared/lib/feed-item-extraction'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * POST /api/admin/reindex-items?offset=0&limit=25   (admin only)
 *
 * Reconciles item_index with every section's current blocks by running the same
 * syncItemIndex used on save: adds missing images, removes images that no
 * longer exist, and fixes positions/captions/NSFW in place (row ids and
 * upload_time of surviving images are kept). Idempotent and safe to re-run.
 *
 * Processes one batch per call so it fits in a serverless time limit. Keep
 * calling with `next_offset` until it comes back null.
 *
 * Response: { total, processed, failed: [{ id, error }], next_offset }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = getSupabaseServiceClient()
    if (!service) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parsedOffset = parseInt(searchParams.get('offset') || '0')
    const parsedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT))
    const offset = Number.isNaN(parsedOffset) || parsedOffset < 0 ? 0 : parsedOffset
    const limit = Math.min(
      Number.isNaN(parsedLimit) || parsedLimit < 1 ? DEFAULT_LIMIT : parsedLimit,
      MAX_LIMIT
    )

    const { data: sections, count, error } = await service
      .from('sections')
      .select('id, blocks, is_nsfw', { count: 'exact' })
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[admin/reindex-items] failed to load sections:', error)
      return NextResponse.json({ error: 'Failed to load sections' }, { status: 500 })
    }

    const rows = sections || []
    const failed: Array<{ id: string; error: string }> = []
    let processed = 0

    // Sequential on purpose: keeps load predictable and errors attributable
    for (const row of rows) {
      try {
        await syncItemIndex(row.id, row.blocks || [], row.is_nsfw || false)
        processed++
      } catch (syncError) {
        failed.push({
          id: row.id,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        })
      }
    }

    const total = count ?? 0
    const nextOffset = offset + rows.length < total ? offset + rows.length : null

    console.log(
      `[admin/reindex-items] user=${user.id} offset=${offset} processed=${processed} failed=${failed.length} total=${total}`
    )

    return NextResponse.json({ total, processed, failed, next_offset: nextOffset })
  } catch (error) {
    console.error('[admin/reindex-items] unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
