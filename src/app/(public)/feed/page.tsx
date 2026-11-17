import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import type { PersonalizedFeedResponse } from '@/shared/lib/types'
import FeedPageClient from './FeedPageClient'

export const metadata: Metadata = {
  title: 'Your Feed - Roomlet',
  description: 'Latest images from your bookmarked collections',
}

// Force dynamic rendering to prevent SSR caching issues
export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const supabase = await getSupabaseServerClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login?redirect=/feed')
  }

  // Fetch initial feed data from the API
  // We need to pass cookies to authenticate the server-to-server request
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll()
    .map(cookie => `${cookie.name}=${cookie.value}`)
    .join('; ')
  
  const apiUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/feed/personalized?limit=50`
  
  let initialFeed: PersonalizedFeedResponse
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': cookieHeader,
      },
      cache: 'no-store', // Don't cache the feed data
    })

    if (!response.ok) {
      console.error('[feed/page] Failed to fetch initial feed:', response.status, response.statusText)
      // Provide fallback empty feed
      initialFeed = {
        items: [],
        has_more: false,
        mode: 'discovery',
        bookmark_count: 0,
      }
    } else {
      initialFeed = await response.json()
    }
  } catch (error) {
    console.error('[feed/page] Error fetching initial feed:', error)
    // Provide fallback empty feed
    initialFeed = {
      items: [],
      has_more: false,
      mode: 'discovery',
      bookmark_count: 0,
    }
  }

  // Pass initialFeed to client component
  return <FeedPageClient initialFeed={initialFeed} />
}
