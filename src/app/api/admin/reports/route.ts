import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { requireAdminRole } from '@/shared/lib/auth/admin-auth'

/**
 * GET /api/admin/reports
 * List all reports (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin role (standardized check)
    await requireAdminRole()

    const supabase = await getSupabaseServerClient()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

    // Fetch reports with section and reporter details
    const { data: reports, error } = await supabase
      .from('reports')
      .select(
        `
        *,
        sections (
          id,
          title,
          published,
          profiles!inner (
            username,
            display_name
          )
        ),
        reporter:profiles!reports_reporter_user_id_fkey (
          username,
          display_name
        )
      `
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Failed to fetch reports:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      )
    }

    const { data: statusCounts } = await supabase
      .from('reports')
      .select('status')

    const counts = {
      pending: statusCounts?.filter((r) => r.status === 'pending').length || 0,
      reviewed: statusCounts?.filter((r) => r.status === 'reviewed').length || 0,
      resolved: statusCounts?.filter((r) => r.status === 'resolved').length || 0,
      dismissed: statusCounts?.filter((r) => r.status === 'dismissed').length || 0,
    }

    return NextResponse.json({
      reports,
      counts,
      status,
    })
  } catch (error: any) {
    console.error('Admin reports API error:', error)

    if (error.message?.includes('Admin access required')) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
