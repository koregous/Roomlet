import { getSupabaseClient } from '@/shared/lib/supabase'
import { NextResponse } from 'next/server'

// GET /api/tags/popular - Get popular tags with counts
export async function GET() {
  try {
    const supabase = getSupabaseClient()

    const { data: tags, error } = await supabase
      .from('tags_with_counts')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(30)

    if (error) {
      console.error('Get popular tags error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch popular tags' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Popular tags API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
