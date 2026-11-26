import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { checkAdminRole } from '@/shared/lib/auth/admin-auth'

/**
 * GET /api/admin/queue
 * Get pending submissions for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    const { isAdmin } = await checkAdminRole()
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'newest'
    const categoryId = searchParams.get('category')
    const nsfwFilter = searchParams.get('nsfw') || 'all' // all | true | false
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('sections')
      .select(`
        id,
        title,
        blocks,
        is_nsfw,
        submitted_at,
        category_id,
        profile_id,
        profiles!inner(
          username,
          display_name,
          avatar_url
        ),
        categories(
          id,
          name,
          slug,
          icon
        )
      `)
      .eq('approval_status', 'pending')

    if (categoryId && categoryId !== 'all') {
      query = query.eq('category_id', categoryId)
    }

    if (nsfwFilter === 'true') {
      query = query.eq('is_nsfw', true)
    } else if (nsfwFilter === 'false') {
      query = query.eq('is_nsfw', false)
    }

    if (filter === 'oldest') {
      query = query.order('submitted_at', { ascending: true })
    } else {
      query = query.order('submitted_at', { ascending: false })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: sections, error: fetchError } = await query

    if (fetchError) {
      console.error('Error fetching queue:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch pending submissions' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('sections')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')

    if (countError) {
      console.error('Error counting queue:', countError)
    }

    // Transform data to match expected format
    const formattedSections = (sections || []).map((section: any) => ({
      id: section.id,
      title: section.title,
      blocks: section.blocks,
      is_nsfw: section.is_nsfw,
      submitted_at: section.submitted_at,
      category: section.categories ? {
        id: section.categories.id,
        name: section.categories.name,
        slug: section.categories.slug,
        icon: section.categories.icon,
      } : null,
      creator: {
        username: section.profiles.username,
        display_name: section.profiles.display_name || section.profiles.username,
        avatar_url: section.profiles.avatar_url,
      },
    }))

    return NextResponse.json({
      sections: formattedSections,
      total: count || 0,
      has_more: (offset + limit) < (count || 0),
    })

  } catch (error) {
    console.error('Admin queue error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
