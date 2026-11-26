import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'

/**
 * GET /api/bookmarks/check?section_id=xxx
 * Check if user has bookmarked a specific section
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ bookmarked: false })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('section_id')

    if (!sectionId) {
      return NextResponse.json(
        { error: 'section_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('section_id', sectionId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking bookmark:', error)
      return NextResponse.json(
        { error: 'Failed to check bookmark' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bookmarked: !!data })
  } catch (error) {
    console.error('Bookmark check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
