import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { checkAdminRole } from '@/shared/lib/auth/admin-auth'

/**
 * POST /api/admin/queue/reject
 * Reject a pending section with reason
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
    // Check admin authentication
    const { isAdmin } = await checkAdminRole()
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { sectionId, reason, adminNotes } = body

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Section ID is required' },
        { status: 400 }
      )
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Verify section exists and is pending
    const { data: section, error: fetchError } = await supabase
      .from('sections')
      .select('id, approval_status, title, profile_id')
      .eq('id', sectionId)
      .single()

    if (fetchError || !section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      )
    }

    if (section.approval_status !== 'pending') {
      return NextResponse.json(
        { error: 'Section is not pending review' },
        { status: 400 }
      )
    }

    // Reject the section
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('sections')
      .update({
        approval_status: 'rejected',
        published: false,
        reviewed_at: now,
        reviewed_by: user.id,
        rejection_reason: reason,
        admin_notes: adminNotes || null,
      })
      .eq('id', sectionId)
      .select('id, title, approval_status, rejection_reason')
      .single()

    if (updateError || !updated) {
      console.error('Error rejecting section:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject section' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Section "${updated.title}" rejected`,
      section: updated,
    })

  } catch (error) {
    console.error('Reject section error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
