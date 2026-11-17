import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { revalidatePath } from 'next/cache'

/**
 * PATCH /api/admin/reports/[id]
 * Update report status (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, admin_notes } = await request.json()
    const reportId = params.id

    if (!status || !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseServerClient()

    // Check admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, user_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Update report
    const { error } = await supabase
      .from('reports')
      .update({
        status,
        admin_notes: admin_notes || null,
        resolved_at: status !== 'pending' ? new Date().toISOString() : null,
      })
      .eq('id', reportId)

    if (error) {
      console.error('Failed to update report:', error)
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
