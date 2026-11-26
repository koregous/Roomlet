import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'

/**
 * GET /api/bookmarks - Get user's bookmarks
 * Returns paginated list of bookmarked sections with full section data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Fetch bookmarks with section data
    // Note: sections.profile_id references profiles.id
    const { data: bookmarks, error, count } = await supabase
      .from('bookmarks')
      .select(`
        id,
        created_at,
        section_id,
        sections!inner(
          id,
          title,
          blocks,
          published,
          is_nsfw,
          category_id,
          created_at,
          updated_at,
          profile_id,
          profiles:profile_id(
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
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching bookmarks:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      bookmarks,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Bookmarks GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bookmarks - Toggle bookmark
 * Body: { section_id: string }
 * Idempotent - adds if not exists, removes if exists
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { section_id } = body

    if (!section_id) {
      return NextResponse.json(
        { error: 'section_id is required' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('section_id', section_id)
      .single()

    if (existing) {
      const { error: deleteError } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('section_id', section_id)

      if (deleteError) {
        console.error('Error removing bookmark:', deleteError)
        return NextResponse.json(
          { error: 'Failed to remove bookmark', details: deleteError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        bookmarked: false,
        message: 'Bookmark removed'
      })
    } else {
      const { error: insertError } = await supabase
        .from('bookmarks')
        .insert({
          user_id: user.id,
          section_id
        })

      if (insertError) {
        console.error('Error adding bookmark:', insertError)
        console.error('Insert error details:', {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint
        })
        return NextResponse.json(
          { error: 'Failed to add bookmark', details: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        bookmarked: true,
        message: 'Bookmark added'
      })
    }
  } catch (error) {
    console.error('Bookmarks POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
