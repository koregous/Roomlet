import { getSupabaseClient } from '@/shared/lib/supabase'
import { NextResponse } from 'next/server'
import { extractThumbnail, inferMimeType, escapeXml, generateSectionUrl } from '@/shared/lib/feed'

// Force dynamic rendering (API route with query params)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0 // Disable ISR caching
export const fetchCache = 'force-no-store'

/**
 * GET /api/feed/rss
 * 
 * Returns an RSS 2.0 feed of the latest published sections.
 * ALWAYS SFW-only for public RSS consumption.
 * 
 * Query Parameters:
 * - category: Filter by category slug (e.g., "photography", "art")
 * - limit: Number of items to return (default: 20, max: 50)
 */
export async function GET(request: Request) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    const supabase = getSupabaseClient()
    
    // Build the query (always SFW for RSS, approved sections only)
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
      .eq('is_nsfw', false) // SECURITY: RSS feed is always SFW-only
      .eq('approval_status', 'approved') // Only include approved sections

    if (category) {
      // Get category ID first
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single()
      
      if (!categoryData) {
        return new NextResponse('Category not found', { status: 404 })
      }
      
      query = query.eq('category_id', categoryData.id)
    }

    query = query
      .order('published_at', { ascending: false })
      .order('id', { ascending: false }) // Stable sort
      .limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('[feed/rss] Database error:', error)
      return new NextResponse('Internal server error', { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://roomlet.app'
    const feedTitle = category 
      ? `Roomlet - ${category.charAt(0).toUpperCase() + category.slice(1)} Collections`
      : 'Roomlet - Latest Collections'
    
    const feedDescription = category
      ? `Latest ${category} collections and portfolios from Roomlet`
      : 'Discover the latest creative collections, portfolios, and showcases from Roomlet'

    const rssItems = (data || []).map((section: any) => {
      const thumbnailUrl = extractThumbnail(section.blocks, section.id)
      const sectionPath = generateSectionUrl(section.profiles.username, section.title)
      const sectionUrl = `${baseUrl}${sectionPath}`
      const creator = section.profiles.display_name || section.profiles.username
      const category = section.categories.name
      
      // Extract tags for RSS categories and description
      const tags = section.section_tags?.map((st: any) => st.tags.name).filter(Boolean) || []
      const tagString = tags.join(', ')
      
      const mimeType = inferMimeType(thumbnailUrl)
      
      const tagMeta = tags.length > 0 ? `<p><strong>Tags:</strong> ${escapeXml(tagString)}</p>` : ''
      const description = `
        <![CDATA[
          <p><img src="${escapeXml(thumbnailUrl)}" alt="${escapeXml(section.title)}" style="max-width: 100%; height: auto;" /></p>
          <p>By ${escapeXml(creator)} • ${escapeXml(category)}</p>
          ${tagMeta}
          <p>${section.view_count || 0} views</p>
        ]]>
      `.trim()

      // Only include enclosure if we can determine the MIME type
      // Note: RSS spec requires 'length' but we can't easily determine file size without fetching
      // Using 0 as placeholder is acceptable per RSS 2.0 spec
      const enclosureTag = mimeType 
        ? `<enclosure url="${escapeXml(thumbnailUrl)}" type="${mimeType}" length="0" />`
        : ''
      
      // Add tags as category elements for RSS readers
      const categoryTags = tags.map((tag: string) => `<category>${escapeXml(tag)}</category>`).join('\n      ')

      return `
    <item>
      <title>${escapeXml(section.title)}</title>
      <link>${escapeXml(sectionUrl)}</link>
      <guid isPermaLink="true">${escapeXml(sectionUrl)}</guid>
      <pubDate>${new Date(section.published_at).toUTCString()}</pubDate>
      <category>${escapeXml(category)}</category>
      ${categoryTags}
      <description>${description}</description>
      ${enclosureTag}
    </item>`
    }).join('\n')

    const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${baseUrl}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/api/feed/rss${category ? `?category=${category}` : ''}" rel="self" type="application/rss+xml" />
    <image>
      <url>${baseUrl}/app-icon.png</url>
      <title>${escapeXml(feedTitle)}</title>
      <link>${baseUrl}</link>
      <width>144</width>
      <height>144</height>
    </image>
    ${rssItems}
  </channel>
</rss>`

    // Log response time
    const duration = Date.now() - startTime
    if (duration > 5000) {
      console.warn(`⚠️ [feed/rss] Slow response: ${duration}ms (category=${category}, limit=${limit})`)
    } else {
      console.log(`[feed/rss] Response time: ${duration}ms (category=${category}, limit=${limit})`)
    }

    return new NextResponse(rss, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60, must-revalidate',
        'CDN-Cache-Control': 'public, s-maxage=30',
        'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
      },
    })
  } catch (error) {
    console.error('[feed/rss] Unexpected error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
