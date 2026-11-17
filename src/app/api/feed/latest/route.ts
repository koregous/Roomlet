import { getSupabaseClient } from '@/shared/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { extractThumbnail, extractAllImages, generateSectionUrl } from '@/shared/lib/feed'

// Force dynamic rendering (API route with query params)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0 // Disable ISR caching
export const fetchCache = 'force-no-store' // Disable fetch cache

// Query parameter validation schema
const querySchema = z.object({
  category: z.string().optional(),
  nsfw: z.enum(['true', 'false']).optional().default('false'),
  limit: z.string().optional().default('20'),
  since: z.string().datetime().optional(),
  cursor: z.string().optional(), // For pagination (section ID)
})

/**
 * GET /api/feed/latest
 * 
 * Returns the latest published sections in a format optimized for Discord bots
 * and RSS feed consumers.
 * 
 * Query Parameters:
 * - category: Filter by category slug (e.g., "photography", "art")
 * - nsfw: Include NSFW content (default: false)
 * - limit: Number of items to return (default: 20, max: 50)
 * - since: ISO timestamp - only return items published after this time
 * - cursor: Section ID for pagination - return items published after this section
 * 
 * Response Format:
 * {
 *   items: Array<{
 *     id: string
 *     title: string
 *     section_url: string
 *     thumbnail_url: string
 *     category: { id, name, slug, icon }
 *     creator: { username, display_name, avatar_url }
 *     published_at: string (ISO)
 *     is_nsfw: boolean
 *     view_count: number
 *   }>
 *   cursor?: string (ID of last item, for pagination)
 *   has_more: boolean
 * }
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    
    // Validate query parameters
    const params = querySchema.safeParse({
      category: searchParams.get('category') || undefined,
      nsfw: searchParams.get('nsfw') || 'false',
      limit: searchParams.get('limit') || '20',
      since: searchParams.get('since') || undefined,
      cursor: searchParams.get('cursor') || undefined,
    })

    if (!params.success) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: params.error.issues 
        },
        { status: 400 }
      )
    }

    const { category, nsfw, limit: limitStr, since, cursor } = params.data
    const includeNsfw = nsfw === 'true'
    const limit = Math.min(parseInt(limitStr), 50) // Cap at 50

    const supabase = getSupabaseClient()
    
    // Build the query
    let query = supabase
      .from('sections')
      .select(`
        id,
        title,
        blocks,
        view_count,
        published_at,
        is_nsfw,
        approval_status,
        profiles!inner(username, display_name, avatar_url),
        categories!inner(id, name, slug, icon),
        section_tags!left(
          tags!inner(id, name, slug)
        )
      `)
      .eq('published', true)
      .eq('approval_status', 'approved') // Only include approved sections

    // SECURITY: NSFW filtering - column now exists with default false
    // Filter out NSFW content unless explicitly requested
    if (!includeNsfw) {
      query = query.eq('is_nsfw', false)
    }

    // Filter by category if provided
    if (category) {
      // Get category ID first
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single()
      
      if (!categoryData) {
        return NextResponse.json(
          { error: `Category "${category}" not found` },
          { status: 404 }
        )
      }
      
      query = query.eq('category_id', categoryData.id)
    }

    // Filter by timestamp if provided
    if (since) {
      query = query.gt('published_at', since)
    }

    // Cursor-based pagination with tie-breaking
    if (cursor) {
      // Get the published_at and id of the cursor section for stable pagination
      const { data: cursorSection } = await supabase
        .from('sections')
        .select('published_at, id')
        .eq('id', cursor)
        .single()

      if (cursorSection) {
        // Use (published_at, id) tuple comparison for stable pagination
        // This prevents skipped/duplicate items when timestamps are identical
        query = query.or(
          `published_at.lt.${cursorSection.published_at},and(published_at.eq.${cursorSection.published_at},id.lt.${cursorSection.id})`
        )
      }
    }

    // Order by published date DESC, then id DESC for stable sorting
    query = query
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1)

    const { data, error } = await query

    if (error) {
      console.error('[feed/latest] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch feed' },
        { status: 500 }
      )
    }

    // Check if category filter returned no results (404 vs empty array)
    if (category && data.length === 0) {
      return NextResponse.json(
        { error: `Category "${category}" not found or has no published sections` },
        { status: 404 }
      )
    }

    // Check if there are more items
    const hasMore = data.length > limit
    const items = hasMore ? data.slice(0, limit) : data

    // Transform to feed format
    const feedItems = items.map((section: any) => {
      // Extract first image from blocks for thumbnail
      const thumbnailUrl = extractThumbnail(section.blocks, section.id)
      // Extract all images for multi-image display
      const allImages = extractAllImages(section.blocks)
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://roomlet.app'
      
      // Generate user-friendly URL: /{username}/{section-title-slug}
      const sectionPath = generateSectionUrl(section.profiles.username, section.title)
      const sectionUrl = `${baseUrl}${sectionPath}`
      
      // Extract tags for SEO
      const tags = section.section_tags?.map((st: any) => st.tags.name).filter(Boolean) || []
      const tagString = tags.join(', ')
      
      // SEO-optimized title: "Tag1, Tag2 - Section Title" or just "Section Title" if no tags
      const seoTitle = tags.length > 0 
        ? `${tagString} - ${section.title}`
        : section.title

      return {
        id: section.id,
        title: seoTitle,
        section_url: sectionUrl,
        thumbnail_url: thumbnailUrl,
        images: allImages, // Array of all image URLs
        image_count: allImages.length,
        tags: tags, // Array of tag names for filtering/search
        category: {
          id: section.categories.id,
          name: section.categories.name,
          slug: section.categories.slug,
          icon: section.categories.icon,
        },
        creator: {
          username: section.profiles.username,
          display_name: section.profiles.display_name || section.profiles.username,
          avatar_url: section.profiles.avatar_url,
        },
        published_at: section.published_at,
        is_nsfw: section.is_nsfw || false,
        view_count: section.view_count || 0,
      }
    })

    // Build response
    const response: any = {
      items: feedItems,
      has_more: hasMore,
    }

    // Add cursor for pagination (last item's ID)
    if (hasMore && feedItems.length > 0) {
      response.cursor = feedItems[feedItems.length - 1].id
    }

    // Log response time
    const duration = Date.now() - startTime
    if (duration > 5000) {
      console.warn(`⚠️ [feed/latest] Slow response: ${duration}ms (category=${category}, limit=${limit})`)
    } else {
      console.log(`[feed/latest] Response time: ${duration}ms (category=${category}, limit=${limit})`)
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60, must-revalidate',
        'CDN-Cache-Control': 'public, s-maxage=30',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
      },
    })
  } catch (error) {
    console.error('[feed/latest] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
