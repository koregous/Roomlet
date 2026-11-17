import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'

/**
 * POST /api/sections/submit
 * Submit a section for admin review
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sectionId } = body

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Section ID is required' },
        { status: 400 }
      )
    }

    // Verify user owns this section
    const { data: section, error: fetchError } = await supabase
      .from('sections')
      .select('id, profile_id, blocks, approval_status, published')
      .eq('id', sectionId)
      .single()

    if (fetchError || !section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    // Check ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.id !== section.profile_id) {
      return NextResponse.json(
        { error: 'You do not own this section' },
        { status: 403 }
      )
    }

    // Validate section has content (at least 1 block)
    if (!section.blocks || section.blocks.length === 0) {
      return NextResponse.json(
        { error: 'Section must have at least one block of content' },
        { status: 400 }
      )
    }

    // Check current status - can only submit from draft or rejected
    if (section.approval_status === 'pending') {
      return NextResponse.json(
        { error: 'Section is already pending review' },
        { status: 400 }
      )
    }

    if (section.approval_status === 'approved' && section.published) {
      return NextResponse.json(
        { error: 'Section is already published' },
        { status: 400 }
      )
    }

    // Submit for review
    const { data: updated, error: updateError } = await supabase
      .from('sections')
      .update({
        approval_status: 'pending',
        submitted_at: new Date().toISOString(),
        published: false, // Ensure not public until approved
        rejection_reason: null, // Clear any previous rejection
      })
      .eq('id', sectionId)
      .select('id, approval_status, submitted_at')
      .single()

    if (updateError || !updated) {
      console.error('Error submitting section:', updateError)
      return NextResponse.json(
        { error: 'Failed to submit section for review' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Section submitted for review',
      section: updated,
    })

  } catch (error) {
    console.error('Submit section error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
