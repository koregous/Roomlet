import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/shared/lib/supabase-server'

/**
 * POST /api/admin/notify
 * Send email notifications to admins
 * 
 * This is a server-side only endpoint that sends email notifications
 * for important admin events (new reports, high report counts, etc.)
 * 
 * SETUP REQUIRED:
 * 1. Add ADMIN_EMAIL to environment variables (.env.local)
 * 2. Choose email service (Resend, SendGrid, or Supabase Edge Function)
 * 3. Add API keys for chosen service
 */
export async function POST(request: NextRequest) {
  try {
    const { type, section_id, reason, report_count, reporter_username } = await request.json()

    const supabase = await getSupabaseServerClient()

    const { data: section } = await supabase
      .from('sections')
      .select(`
        id,
        title,
        profiles!inner (
          username,
          display_name
        )
      `)
      .eq('id', section_id)
      .single()

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const profileData = section.profiles as unknown as { username: string; display_name?: string }

    // Build email content based on notification type
    let subject = ''
    let body = ''

    if (type === 'new_report') {
      subject = `🚨 New Report: ${section.title}`
      body = `
A new content report has been submitted:

Section: "${section.title}"
Author: @${profileData.username}
Reason: ${reason}
Reported by: ${reporter_username || 'Anonymous'}

View section: ${process.env.NEXT_PUBLIC_SITE_URL}/s/${section_id}
Admin dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/admin/reports

Please review and take appropriate action.
      `.trim()
    } else if (type === 'high_report_count') {
      subject = `⚠️ High Report Count: ${section.title} (${report_count} reports)`
      body = `
A section has received ${report_count} reports and requires review:

Section: "${section.title}"
Author: @${profileData.username}
Report Count: ${report_count}

View section: ${process.env.NEXT_PUBLIC_SITE_URL}/s/${section_id}
Admin dashboard: ${process.env.NEXT_PUBLIC_SITE_URL}/admin/reports

This section may need to be unpublished or removed.
      `.trim()
    }

    console.log('[ADMIN NOTIFICATION]')
    console.log('To:', process.env.ADMIN_EMAIL || 'admin@roomlet.app')
    console.log('Subject:', subject)
    console.log('Body:', body)
    console.log('---')

    // TODO: Integrate with email service
    // 
    // Option 1: Resend (recommended, has generous free tier)
    // https://resend.com/docs/send-with-nextjs
    // 
    // import { Resend } from 'resend'
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: 'Roomlet <notifications@roomlet.app>',
    //   to: process.env.ADMIN_EMAIL,
    //   subject,
    //   text: body,
    // })
    //
    // Option 2: SendGrid
    // https://docs.sendgrid.com/for-developers/sending-email/quickstart-nodejs
    //
    // Option 3: Supabase Edge Function
    // https://supabase.com/docs/guides/functions/examples/send-emails
    //
    // For now, we just log the notification.
    // In production, uncomment your chosen email service above.

    return NextResponse.json({
      success: true,
      message: 'Notification logged (email integration pending)',
    })
  } catch (error) {
    console.error('Admin notify error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
