import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'

/**
 * GET /api/sections/:id/bookmark-count
 * Get aggregate bookmark count for a section (public, no user info exposed)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getSupabaseServerClient()
    const sectionId = params.id

    // Use the RPC function to get aggregate count
    const { data, error } = await supabase
      .rpc('get_section_bookmark_count', { p_section_id: sectionId })

    if (error) {
      console.error('Error getting bookmark count:', error)
      return NextResponse.json(
        { error: 'Failed to get bookmark count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ count: data || 0 })
  } catch (error) {
    console.error('Bookmark count error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
