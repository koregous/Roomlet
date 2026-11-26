import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { generateSectionUrl, extractThumbnail } from '@/shared/lib/feed'
import { getBookmarkCounts } from '@/shared/lib/bookmark-counts'
import type { SuggestedCollection } from '@/shared/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_SUGGESTIONS = 6
const CANDIDATE_POOL = 40

/**
 * GET /api/feed/suggestions
 *
 * Collections worth bookmarking, for thin/empty feeds. Picks from the most
 * recently published approved collections the user hasn't bookmarked and
 * doesn't own, then ranks them by bookmark count (newest first on ties).
 *
 * Query: include_nsfw=true|false (default false)
 * Response: { collections: SuggestedCollection[] }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeNsfw = new URL(request.url).searchParams.get('include_nsfw') === 'true'

    const [bookmarksResult, ownProfileResult] = await Promise.all([
      supabase.from('bookmarks').select('section_id').eq('user_id', user.id),
      supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle(),
    ])

    const bookmarkedIds = (bookmarksResult.data || []).map(b => b.section_id)
    const ownProfileId = ownProfileResult.data?.id

    let query = supabase
      .from('sections')
      .select(`
        id,
        title,
        blocks,
        is_nsfw,
        published_at,
        profiles!inner(username, display_name, avatar_url),
        categories(id, name, slug, icon)
      `)
      .eq('published', true)
      .eq('approval_status', 'approved')
      .eq('visible', true)

    if (!includeNsfw) query = query.eq('is_nsfw', false)
    if (bookmarkedIds.length > 0) {
      query = query.not('id', 'in', `(${bookmarkedIds.join(',')})`)
    }
    if (ownProfileId) query = query.neq('profile_id', ownProfileId)

    const { data: candidates, error } = await query
      .order('published_at', { ascending: false })
      .limit(CANDIDATE_POOL)

    if (error) {
      console.error('[feed/suggestions] query failed:', error)
      return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
    }

    const rows = (candidates || []) as any[]
    const counts = await getBookmarkCounts(supabase, rows.map(r => r.id))

    const ranked = rows
      .map((row, index) => ({ row, index, count: counts.get(row.id) || 0 }))
      // Most bookmarked first; `index` preserves newest-first order on ties
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, MAX_SUGGESTIONS)

    const collections: SuggestedCollection[] = ranked.map(({ row, count }) => ({
      id: row.id,
      title: row.title || 'Untitled',
      url: generateSectionUrl(row.profiles.username, row.title || 'untitled'),
      thumbnail_url: extractThumbnail(row.blocks || [], row.id),
      bookmark_count: count,
      creator: {
        username: row.profiles.username,
        display_name: row.profiles.display_name || row.profiles.username,
        avatar_url: row.profiles.avatar_url || undefined,
      },
      category: row.categories
        ? {
            id: row.categories.id,
            name: row.categories.name,
            slug: row.categories.slug,
            icon: row.categories.icon || undefined,
          }
        : { id: 'uncategorized', name: 'Uncategorized', slug: 'uncategorized' },
    }))

    return NextResponse.json({ collections })
  } catch (error) {
    console.error('[feed/suggestions] unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
