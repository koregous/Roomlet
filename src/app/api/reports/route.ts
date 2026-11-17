import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { CreateReportSchema } from '@/shared/lib/validation/api-schemas'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate with Zod schema
    const validation = CreateReportSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    const { section_id, reason } = validation.data

    const supabase = await getSupabaseServerClient()

    // SECURITY: Require authentication to prevent anonymous spam
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to report content' },
        { status: 401 }
      )
    }

    // Get the user's profile ID (reports table references profiles.id, not auth.users.id)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Get reporter IP for additional tracking
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

    // Check if user has already reported this section
    const { data: existingReport } = await supabase
      .from('reports')
      .select('id')
      .eq('section_id', section_id)
      .eq('reporter_user_id', profile.id)
      .single()

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this content' },
        { status: 409 }
      )
    }

    // Check user's report count in the last 24 hours (rate limiting)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentReports, error: countError } = await supabase
      .from('reports')
      .select('id', { count: 'exact' })
      .eq('reporter_user_id', profile.id)
      .gte('created_at', yesterday)

    if (countError) {
      console.error('Failed to check report rate limit:', countError)
    } else if (recentReports && recentReports.length >= 10) {
      return NextResponse.json(
        { error: 'Report limit reached. Please try again later.' },
        { status: 429 }
      )
    }

    // Insert report
    const { data, error } = await supabase
      .from('reports')
      .insert({
        section_id,
        reason,
        reporter_user_id: profile.id,  // Use profile ID, not auth user ID!
        reporter_ip: ip,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create report:', error)
      return NextResponse.json(
        { 
          error: process.env.NODE_ENV === 'production'
            ? 'Failed to submit report'
            : `Failed to submit report: ${error.message || 'Unknown error'}`
        },
        { status: 500 }
      )
    }

    // SECURITY: Increased threshold to 10 reports before auto-action
    // Flag for manual review instead of auto-unpublishing
    // SECURITY: Increased threshold to 10 reports before flagging
    // Check report count for this section (gracefully handle if RPC doesn't exist)
    let reportCount: number | null = null
    try {
      const { data, error } = await supabase
        .rpc('count_pending_reports', { target_section_id: section_id })
      
      if (!error && data !== null) {
        reportCount = data
      }
    } catch (err) {
      // RPC function might not exist yet - gracefully continue
      console.log('count_pending_reports RPC not available:', err)
    }

    if (reportCount && reportCount >= 10) {
      // Flag for manual admin review
      console.warn(`Section ${section_id} has ${reportCount} pending reports - flagged for review`)
      
      // TODO: Send email notification to admin
      // Uncomment after setting up email service (Resend/SendGrid)
      // See docs/ADMIN_SYSTEM.md for setup instructions
    }

    return NextResponse.json(
      { success: true, report: data },
      { status: 201 }
    )
  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : `Internal server error: ${error}`
      },
      { status: 500 }
    )
  }
}
