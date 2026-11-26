import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { checkRateLimit, RateLimits } from '@/shared/lib/rate-limit'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST   /api/items/[id]/like  - like an image
 * DELETE /api/items/[id]/like  - remove your like
 *
 * `id` is an item_index id (one row per image). Both verbs are idempotent, so
 * a double-click or a retry can't skew the count. Authorization is enforced by
 * RLS on item_likes (own rows only, and only on visible items).
 *
 * Response: { liked: boolean, like_count: number }
 */
async function setLike(id: string, like: boolean) {
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 })
  }

  const supabase = await getSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rate = checkRateLimit(`item-like:${user.id}`, RateLimits.GENEROUS)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: rate.headers }
    )
  }

  if (like) {
    const { error } = await supabase
      .from('item_likes')
      .insert({ item_id: id, user_id: user.id })

    // 23505 = already liked -> fine (idempotent)
    if (error && error.code !== '23505') {
      // 23503 (FK) / 42501 (RLS): item doesn't exist or isn't visible
      if (error.code === '23503' || error.code === '42501') {
        return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      }
      console.error('[items/like] insert failed:', error)
      return NextResponse.json({ error: 'Failed to like item' }, { status: 500 })
    }
  } else {
    const { error } = await supabase
      .from('item_likes')
      .delete()
      .eq('item_id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[items/like] delete failed:', error)
      return NextResponse.json({ error: 'Failed to remove like' }, { status: 500 })
    }
  }

  const { data: item } = await supabase
    .from('item_index')
    .select('like_count')
    .eq('id', id)
    .maybeSingle()

  return NextResponse.json({ liked: like, like_count: item?.like_count ?? 0 })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return await setLike(params.id, true)
  } catch (error) {
    console.error('[items/like] POST unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return await setLike(params.id, false)
  } catch (error) {
    console.error('[items/like] DELETE unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
