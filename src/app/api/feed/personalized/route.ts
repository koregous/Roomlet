import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { generateSectionUrl } from '@/shared/lib/feed'
import { getItemLikeStates } from '@/shared/lib/item-likes'
import { z } from 'zod'
import type { PersonalizedFeedItem } from '@/shared/lib/types'

// Force dynamic rendering (API route with query params)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0 // Disable ISR caching
export const fetchCache = 'force-no-store' // Disable fetch cache

// Query parameter validation schema
const querySchema = z.object({
  limit: z.string().optional().default('50'),
  cursor: z.string().optional(),
  since: z.string().datetime().optional(),
  include_nsfw: z.enum(['true', 'false']).optional().default('false'),
})

/**
 * The feed is served in two phases so it never runs dry:
 *   1. 'bookmarked'  - items from collections the user bookmarked
 *   2. 'discovery'   - recent items from everywhere else (approved, published, visible)
 * A page that exhausts phase 1 is topped up from phase 2 in the same response.
 */
type FeedPhase = 'bookmarked' | 'discovery'

interface FeedCursor {
  phase: FeedPhase
  // Absent for "start of the discovery phase"
  upload_time?: string
  id?: string
}

function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64')
}

/**
 * Decode a pagination cursor. Legacy cursors ({upload_time, id} without a
 * phase) are treated as bookmarked-phase cursors.
 */
function decodeCursor(cursor: string): FeedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))

    const phase: FeedPhase = parsed.phase === 'discovery' ? 'discovery' : 'bookmarked'
    const hasTime = typeof parsed.upload_time === 'string'
    const hasId = typeof parsed.id === 'string'

    if (hasTime !== hasId) return null
    if (!hasTime && phase !== 'discovery') return null

    return {
      phase,
      ...(hasTime && hasId ? { upload_time: parsed.upload_time, id: parsed.id } : {}),
    }
  } catch {
    return null
  }
}

const ITEM_SELECT = `
  id,
  section_id,
  block_id,
  block_type,
  item_url,
  upload_time,
  position,
  caption,
  alt_text,
  is_nsfw,
  sections!inner(
    id,
    title,
    published,
    approval_status,
    visible,
    profile_id,
    category_id
  )
`

interface FetchOptions {
  scope: FeedPhase
  bookmarkedIds: string[]
  includeNsfw: boolean
  since?: string
  after?: { upload_time?: string; id?: string } | null
  limit: number
}

async function fetchItems(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  { scope, bookmarkedIds, includeNsfw, since, after, limit }: FetchOptions
) {
  let query = supabase.from('item_index').select(ITEM_SELECT)

  if (scope === 'bookmarked') {
    query = query.in('section_id', bookmarkedIds)
  } else {
    // Discovery: published, approved, visible sections only...
    query = query
      .eq('sections.published', true)
      .eq('sections.approval_status', 'approved')
      .eq('sections.visible', true)

    // ...and don't repeat what the user already gets from their bookmarks
    if (bookmarkedIds.length > 0) {
      query = query.not('section_id', 'in', `(${bookmarkedIds.join(',')})`)
    }
  }

  // NSFW filtering (default: exclude NSFW)
  if (!includeNsfw) {
    query = query.eq('is_nsfw', false)
  }

  if (since) {
    query = query.gt('upload_time', since)
  }

  // Keyset pagination: upload_time < cursor OR (upload_time = cursor AND id < cursor.id)
  if (after?.upload_time && after.id) {
    query = query.or(
      `upload_time.lt.${after.upload_time},and(upload_time.eq.${after.upload_time},id.lt.${after.id})`
    )
  }

  return query
    .order('upload_time', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
}

/**
 * GET /api/feed/personalized
 *
 * Returns the user's feed of media items: images from bookmarked collections
 * first, topped up with recent discovery items so the feed is never empty.
 *
 * Authentication: Required - returns 401 if user is not authenticated
 *
 * Query Parameters:
 * - limit: Number of items to return (default: 50, max: 100)
 * - cursor: Base64-encoded pagination cursor {phase, upload_time?, id?}
 * - since: ISO timestamp - only return items published after this time
 * - include_nsfw: Include NSFW content (default: false)
 *
 * Response Format:
 * {
 *   items: Array<PersonalizedFeedItem>   (each has source + like_count + liked_by_me)
 *   cursor?: string (present if has_more = true)
 *   has_more: boolean
 *   mode: 'personalized' | 'discovery'   ('personalized' = user has bookmarks)
 *   bookmark_count: number
 * }
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await getSupabaseServerClient()

    // Authentication check - required for personalized feed
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)

    const params = querySchema.safeParse({
      limit: searchParams.get('limit') || '50',
      cursor: searchParams.get('cursor') || undefined,
      since: searchParams.get('since') || undefined,
      include_nsfw: searchParams.get('include_nsfw') || 'false',
    })

    if (!params.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: params.error.issues },
        { status: 400 }
      )
    }

    const { limit: limitStr, cursor, since, include_nsfw } = params.data
    const includeNsfw = include_nsfw === 'true'
    const parsedLimit = parseInt(limitStr)
    const limit = Math.min(Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit, 100)

    // Step 1: Retrieve user's bookmarked section IDs
    const { data: bookmarks, error: bookmarksError } = await supabase
      .from('bookmarks')
      .select('section_id')
      .eq('user_id', user.id)

    if (bookmarksError) {
      console.error('[feed/personalized] Error fetching bookmarks:', bookmarksError)
      return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 })
    }

    const bookmarkedIds = bookmarks?.map(b => b.section_id) || []
    const bookmarkCount = bookmarkedIds.length
    const mode: 'personalized' | 'discovery' = bookmarkCount > 0 ? 'personalized' : 'discovery'

    // Step 2: Work out where in the feed this request starts
    let decoded: FeedCursor | null = null
    if (cursor) {
      decoded = decodeCursor(cursor)
      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid pagination cursor', code: 'INVALID_CURSOR' },
          { status: 400 }
        )
      }
    }

    let phase: FeedPhase = decoded?.phase ?? (bookmarkCount > 0 ? 'bookmarked' : 'discovery')
    let after: FeedCursor | null = decoded

    // User removed their last bookmark mid-scroll: restart in discovery
    if (phase === 'bookmarked' && bookmarkCount === 0) {
      phase = 'discovery'
      after = null
    }

    // Step 3: Fetch rows for this page
    const queryStartTime = Date.now()
    const rows: Array<{ row: any; source: FeedPhase }> = []
    let hasMore = false
    let nextCursor: string | undefined

    const common = { bookmarkedIds, includeNsfw, since }

    if (phase === 'bookmarked') {
      const { data, error } = await fetchItems(supabase, {
        ...common,
        scope: 'bookmarked',
        after,
        limit: limit + 1, // +1 to detect has_more
      })

      if (error) {
        console.error('[feed/personalized] Error querying item_index (bookmarked):', error)
        return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 })
      }

      const bookmarkedRows = (data || []) as any[]

      if (bookmarkedRows.length > limit) {
        // More bookmarked items remain - plain page
        const page = bookmarkedRows.slice(0, limit)
        page.forEach(row => rows.push({ row, source: 'bookmarked' }))
        const last = page[page.length - 1]
        hasMore = true
        nextCursor = encodeCursor({ phase: 'bookmarked', upload_time: last.upload_time, id: last.id })
      } else {
        // Bookmarked items exhausted - top the page up from discovery
        bookmarkedRows.forEach(row => rows.push({ row, source: 'bookmarked' }))
        const remaining = limit - bookmarkedRows.length

        const { data: discData, error: discError } = await fetchItems(supabase, {
          ...common,
          scope: 'discovery',
          after: null,
          limit: remaining + 1,
        })

        if (discError) {
          // Padding is best-effort; never fail the feed over it
          console.error('[feed/personalized] Error querying item_index (discovery padding):', discError)
        } else {
          const discRows = (discData || []) as any[]
          if (remaining > 0) {
            const page = discRows.slice(0, remaining)
            page.forEach(row => rows.push({ row, source: 'discovery' }))
            if (discRows.length > remaining) {
              const last = page[page.length - 1]
              hasMore = true
              nextCursor = encodeCursor({ phase: 'discovery', upload_time: last.upload_time, id: last.id })
            }
          } else if (discRows.length > 0) {
            // Page was exactly full of bookmarked items; discovery starts next page
            hasMore = true
            nextCursor = encodeCursor({ phase: 'discovery' })
          }
        }
      }
    } else {
      const { data, error } = await fetchItems(supabase, {
        ...common,
        scope: 'discovery',
        after,
        limit: limit + 1,
      })

      if (error) {
        console.error('[feed/personalized] Error querying item_index (discovery):', error)
        return NextResponse.json({ error: 'Failed to load feed' }, { status: 500 })
      }

      const discRows = (data || []) as any[]
      const page = discRows.length > limit ? discRows.slice(0, limit) : discRows
      page.forEach(row => rows.push({ row, source: 'discovery' }))

      if (discRows.length > limit) {
        const last = page[page.length - 1]
        hasMore = true
        nextCursor = encodeCursor({ phase: 'discovery', upload_time: last.upload_time, id: last.id })
      }
    }

    const queryDuration = Date.now() - queryStartTime
    console.log(`[feed/personalized] Query time: ${queryDuration}ms`)

    // Empty feed (nothing published anywhere yet)
    if (rows.length === 0) {
      return NextResponse.json({
        items: [],
        has_more: false,
        mode,
        bookmark_count: bookmarkCount,
      })
    }

    // Step 4: Enrich with profile, category and like metadata
    // Note: With !inner join, sections is a single object, not an array
    const profileIds = [...new Set(rows.map(({ row }) => row.sections.profile_id))]
    const categoryIds = [...new Set(rows.map(({ row }) => row.sections.category_id).filter(Boolean))]

    const [profilesResult, categoriesResult, likeStates] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', profileIds),
      categoryIds.length > 0
        ? supabase.from('categories').select('id, name, slug, icon').in('id', categoryIds)
        : Promise.resolve({ data: [], error: null }),
      getItemLikeStates(supabase, rows.map(({ row }) => row.id), user.id),
    ])

    if (profilesResult.error) {
      console.error('[feed/personalized] Error fetching profiles:', profilesResult.error)
    }
    if (categoriesResult.error) {
      console.error('[feed/personalized] Error fetching categories:', categoriesResult.error)
    }

    const profileMap = new Map<string, any>((profilesResult.data || []).map((p: any) => [p.id, p]))
    const categoryMap = new Map<string, any>((categoriesResult.data || []).map((c: any) => [c.id, c]))

    const enrichedItems: PersonalizedFeedItem[] = rows.map(({ row, source }) => {
      const sections = row.sections
      const profile = profileMap.get(sections.profile_id)
      const category = sections.category_id ? categoryMap.get(sections.category_id) : null
      const likeState = likeStates.get(row.id)

      return {
        id: row.id,
        section_id: row.section_id,
        block_id: row.block_id,
        block_type: row.block_type,
        image_url: row.item_url,
        upload_time: row.upload_time,
        position: row.position,
        caption: row.caption || undefined,
        alt_text: row.alt_text || undefined,
        is_nsfw: row.is_nsfw,
        source,
        like_count: likeState?.like_count ?? 0,
        liked_by_me: likeState?.liked_by_me ?? false,
        section: {
          id: sections.id,
          title: sections.title,
          url: generateSectionUrl(profile?.username || 'unknown', sections.title),
        },
        creator: {
          username: profile?.username || 'unknown',
          display_name: profile?.display_name || profile?.username || 'Unknown',
          avatar_url: profile?.avatar_url || undefined,
        },
        category: category
          ? {
              id: category.id,
              name: category.name,
              slug: category.slug,
              icon: category.icon || undefined,
            }
          : {
              id: 'uncategorized',
              name: 'Uncategorized',
              slug: 'uncategorized',
            },
      }
    })

    const duration = Date.now() - startTime
    console.log(
      `[feed/personalized] Response time: ${duration}ms ` +
      `(user=${user.id}, mode=${mode}, phase=${phase}, bookmarks=${bookmarkCount}, ` +
      `items=${enrichedItems.length}, limit=${limit}, query=${queryDuration}ms)`
    )

    if (duration > 2000) {
      console.warn(`[feed/personalized] SLOW RESPONSE: ${duration}ms > 2000ms target`)
    }

    return NextResponse.json({
      items: enrichedItems,
      cursor: nextCursor,
      has_more: hasMore,
      mode,
      bookmark_count: bookmarkCount,
    })
  } catch (error) {
    console.error('[feed/personalized] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
