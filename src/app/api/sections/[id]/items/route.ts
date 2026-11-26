import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { getItemLikeStates } from '@/shared/lib/item-likes'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sections/[id]/items
 *
 * Returns the indexed images of a section with their like state, so the
 * gallery/lightbox can show a heart on each image. Public; `liked_by_me` is
 * only true when the caller is signed in.
 *
 * item_index RLS only exposes items of published + approved + visible
 * sections, so unpublished sections simply return an empty list.
 *
 * Response: { items: Array<{ id, url, block_id, position, like_count, liked_by_me }> }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('item_index')
      .select('id, item_url, block_id, position')
      .eq('section_id', params.id)
      .order('position', { ascending: true })

    if (error) {
      console.error('[sections/items] query failed:', error)
      return NextResponse.json({ error: 'Failed to load items' }, { status: 500 })
    }

    const rows = data || []
    const likeStates = await getItemLikeStates(supabase, rows.map(r => r.id), user?.id)

    return NextResponse.json({
      items: rows.map(row => ({
        id: row.id,
        url: row.item_url,
        block_id: row.block_id,
        position: row.position,
        like_count: likeStates.get(row.id)?.like_count ?? 0,
        liked_by_me: likeStates.get(row.id)?.liked_by_me ?? false,
      })),
    })
  } catch (error) {
    console.error('[sections/items] unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
