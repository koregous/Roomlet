/**
 * Aggregate bookmark counts for many sections at once.
 *
 * Why an RPC: the bookmarks table is RLS-restricted (owner or public lists
 * only), so `select ... from bookmarks` from a public/anon client undercounts.
 * get_section_bookmark_counts (migration 048) is SECURITY DEFINER and returns
 * aggregates only. If it isn't available yet we fall back to the old
 * RLS-limited query so pages keep working.
 */

// Deliberately loose: works with any Supabase client flavour without importing generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export async function getBookmarkCounts(
  supabase: SupabaseLike,
  sectionIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (sectionIds.length === 0) return counts

  const { data, error } = await supabase.rpc('get_section_bookmark_counts', {
    p_section_ids: sectionIds,
  })

  if (!error && Array.isArray(data)) {
    for (const row of data as Array<{ section_id: string; bookmark_count: number }>) {
      counts.set(row.section_id, row.bookmark_count)
    }
    return counts
  }

  console.warn('[bookmark-counts] RPC unavailable, falling back to RLS-limited count:', error?.message)
  const { data: rows } = await supabase
    .from('bookmarks')
    .select('section_id')
    .in('section_id', sectionIds)

  for (const row of (rows || []) as Array<{ section_id: string }>) {
    counts.set(row.section_id, (counts.get(row.section_id) || 0) + 1)
  }
  return counts
}
