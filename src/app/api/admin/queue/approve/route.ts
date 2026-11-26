import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { checkAdminRole } from '@/shared/lib/auth/admin-auth'
import { revalidatePath } from 'next/cache'

/**
 * POST /api/admin/queue/approve
 * Approve a pending section
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServerClient()
    
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
    const { sectionId, adminNotes } = body

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Section ID is required' },
        { status: 400 }
      )
    }

    // Verify section exists and is pending
    const { data: section, error: fetchError } = await supabase
      .from('sections')
      .select('id, approval_status, profile_id')
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

    // Approve the section
    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('sections')
      .update({
        approval_status: 'approved',
        published: true,
        published_at: now,
        reviewed_at: now,
        reviewed_by: user.id,
        admin_notes: adminNotes || null,
        rejection_reason: null, // Clear any old rejection reason
      })
      .eq('id', sectionId)
      .select('id, title, approval_status')
      .single()

    if (updateError || !updated) {
      console.error('Error approving section:', updateError)
      return NextResponse.json(
        { error: 'Failed to approve section' },
        { status: 500 }
      )
    }

    try {
      revalidatePath('/gallery')
      revalidatePath('/discover-list')
      revalidatePath('/(public)', 'layout')
    } catch (revalidateError) {
      console.error('Error revalidating paths:', revalidateError)
      // Non-critical, continue
    }

    return NextResponse.json({
      success: true,
      message: `Section "${updated.title}" approved and published`,
      section: updated,
    })

  } catch (error) {
    console.error('Approve section error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
