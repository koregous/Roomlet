import { getSupabaseClient } from '@/shared/lib/supabase'
import { NextResponse } from 'next/server'

// GET /api/tags - Get all tags or search tags
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (query) {
      const { data: tags, error } = await supabase
        .rpc('search_tags', { 
          search_query: query,
          limit_count: limit 
        })

      if (error) {
        console.error('Search tags error:', error)
        return NextResponse.json(
          { error: 'Failed to search tags' },
          { status: 500 }
        )
      }

      return NextResponse.json({ tags })
    } else {
      const { data: tags, error } = await supabase
        .rpc('get_popular_tags', { limit_count: limit })

      if (error) {
        console.error('Get popular tags error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch tags' },
          { status: 500 }
        )
      }

      return NextResponse.json({ tags })
    }
  } catch (error) {
    console.error('Tags API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
