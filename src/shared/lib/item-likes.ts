/**
 * Helpers for per-image likes.
 *
 * Reads degrade gracefully: if the item_likes migration (048) hasn't been
 * applied yet, every item simply reports 0 likes / not liked instead of
 * breaking the page that asked for it.
 */

// Deliberately loose: works with any Supabase client flavour (server, browser,
// service role) without dragging the generated schema generics into this helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export interface ItemLikeState {
  like_count: number
  liked_by_me: boolean
}

export async function getItemLikeStates(
  supabase: SupabaseLike,
  itemIds: string[],
  userId?: string | null
): Promise<Map<string, ItemLikeState>> {
  const states = new Map<string, ItemLikeState>()
  if (itemIds.length === 0) return states

  const { data: counts, error: countError } = await supabase
    .from('item_index')
    .select('id, like_count')
    .in('id', itemIds)

  if (countError) {
    console.warn('[item-likes] Could not read like counts (is migration 048 applied?):', countError.message)
    return states
  }

  for (const row of (counts || []) as Array<{ id: string; like_count: number | null }>) {
    states.set(row.id, { like_count: row.like_count ?? 0, liked_by_me: false })
  }

  if (userId) {
    const { data: liked, error: likedError } = await supabase
      .from('item_likes')
      .select('item_id')
      .eq('user_id', userId)
      .in('item_id', itemIds)

    if (likedError) {
      console.warn('[item-likes] Could not read liked state:', likedError.message)
    } else {
      for (const row of (liked || []) as Array<{ item_id: string }>) {
        const existing = states.get(row.item_id)
        if (existing) existing.liked_by_me = true
        else states.set(row.item_id, { like_count: 0, liked_by_me: true })
      }
    }
  }

  return states
}
