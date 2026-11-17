import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/shared/lib/supabase'
import { checkViewRateLimit, getClientIP } from '@/shared/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const { sectionId } = await request.json()

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Section ID is required' },
        { status: 400 }
      )
    }

    // SECURITY: Rate limit views by IP + section ID
    // Prevents bots from inflating view counts
    const ip = getClientIP(request)
    const rateLimitResult = checkViewRateLimit(ip, sectionId)

    if (!rateLimitResult.allowed) {
      // View already counted for this IP + section in last 5 minutes
      return NextResponse.json(
        { success: true, cached: true },
        { 
          status: 200,
          headers: rateLimitResult.headers 
        }
      )
    }

    const supabase = getSupabaseClient()

    // Increment view count
    const { error } = await supabase.rpc('increment_view_count', {
      section_id: sectionId,
    })

    if (error) {
      console.error('Failed to increment view count:', error)
      return NextResponse.json(
        { error: 'Failed to track view' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true },
      { headers: rateLimitResult.headers }
    )
  } catch (error) {
    console.error('View tracking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
