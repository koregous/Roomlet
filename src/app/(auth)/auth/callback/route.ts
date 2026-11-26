import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Only same-site relative paths are allowed as a post-login target (no open redirects).
  const nextParam = requestUrl.searchParams.get('next')
  const next =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.startsWith('/\\')
      ? nextParam
      : '/dashboard'

  // Handle OAuth / email confirmation errors
  if (error) {
    console.error('[auth/callback] Auth error:', error, errorDescription)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    )
  }

  if (code) {
    try {
      const supabase = await getSupabaseServerClient()
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('[auth/callback] Code exchange error:', exchangeError.message)
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url)
        )
      }
    } catch (err) {
      console.error('[auth/callback] Unexpected error:', err instanceof Error ? err.message : err)
      return NextResponse.redirect(
        new URL('/login?error=Authentication+failed', request.url)
      )
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}