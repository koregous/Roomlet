import { getSupabaseServerClient } from '@/shared/lib/supabase-server'
import { redirect } from 'next/navigation'
import BookmarksPageClient from './BookmarksPageClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'My Bookmarks - Roomlet',
  description: 'Your saved collections and sections',
}

// Force dynamic rendering to prevent SSR caching issues
export const dynamic = 'force-dynamic'

export default async function BookmarksPage() {
  const supabase = await getSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch initial bookmarks with proper error handling
  // Note: sections.profile_id references profiles.id (not profiles.user_id)
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select(`
      id,
      created_at,
      section_id,
      sections!inner(
        id,
        title,
        blocks,
        published,
        is_nsfw,
        category_id,
        created_at,
        updated_at,
        profile_id,
        profiles:profile_id(
          username,
          display_name,
          avatar_url
        ),
        categories(
          id,
          name,
          slug,
          icon
        )
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Error fetching bookmarks:', error)
    // Return empty array if there's an error instead of crashing
    return <BookmarksPageClient initialBookmarks={[]} />
  }

  return <BookmarksPageClient initialBookmarks={bookmarks as any || []} />
}
