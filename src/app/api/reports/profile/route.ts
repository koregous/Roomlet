import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { z } from 'zod'

// Validation schema for profile reports
const CreateProfileReportSchema = z.object({
  username: z.string().min(1),
  reason: z.enum(['spam', 'harassment', 'inappropriate_background', 'inappropriate_content', 'impersonation']),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate with Zod schema
    const validation = CreateProfileReportSchema.safeParse(body)
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

    const { username, reason } = validation.data

    const supabase = await getSupabaseServerClient()

    // SECURITY: Require authentication to prevent anonymous spam
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to report content' },
        { status: 401 }
      )
    }

    // Get the reporter's profile ID
    const { data: reporterProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!reporterProfile) {
      return NextResponse.json(
        { error: 'Reporter profile not found' },
        { status: 404 }
      )
    }

    // Get the reported profile
    const { data: reportedProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .single()

    if (profileError || !reportedProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Prevent self-reporting
    if (reporterProfile.id === reportedProfile.id) {
      return NextResponse.json(
        { error: 'You cannot report your own profile' },
        { status: 400 }
      )
    }

    // Get reporter IP for additional tracking
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

    // Check if user has already reported this profile
    const { data: existingReport } = await supabase
      .from('profile_reports')
      .select('id')
      .eq('reported_profile_id', reportedProfile.id)
      .eq('reporter_user_id', reporterProfile.id)
      .single()

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this profile' },
        { status: 409 }
      )
    }

    // Check user's report count in the last 24 hours (rate limiting)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentReports, error: countError } = await supabase
      .from('profile_reports')
      .select('id', { count: 'exact' })
      .eq('reporter_user_id', reporterProfile.id)
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
      .from('profile_reports')
      .insert({
        reported_profile_id: reportedProfile.id,
        reason,
        reporter_user_id: reporterProfile.id,
        reporter_ip: ip,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create profile report:', error)
      return NextResponse.json(
        { 
          error: process.env.NODE_ENV === 'production'
            ? 'Failed to submit report'
            : `Failed to submit report: ${error.message || 'Unknown error'}`
        },
        { status: 500 }
      )
    }

    // Check report count for this profile
    const { count: reportCount } = await supabase
      .from('profile_reports')
      .select('id', { count: 'exact', head: true })
      .eq('reported_profile_id', reportedProfile.id)
      .eq('status', 'pending')

    if (reportCount && reportCount >= 10) {
      // Flag for manual admin review
      console.warn(`Profile @${reportedProfile.username} has ${reportCount} pending reports - flagged for review`)
      
      // TODO: Send email notification to admin
      // Uncomment after setting up email service (Resend/SendGrid)
    }

    return NextResponse.json(
      { success: true, report: data },
      { status: 201 }
    )
  } catch (error) {
    console.error('Profile report API error:', error)
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
