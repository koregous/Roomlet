import { getSupabaseClient, getSupabaseServiceClient } from '@/shared/lib/supabase'
import { Profile, Section } from '@/shared/lib/types'
import ProfileCard from '@/features/profile/components/ProfileCard'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// ISR: revalidate every 30 seconds. On-demand revalidation is triggered
// when sections are published/unpublished/deleted.
export const revalidate = 30

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

interface PageProps {
  // In Next.js 15, params is a Promise — must be awaited.
  params: Promise<{ username: string }>
}

async function getProfile(username: string) {
  const supabase = getSupabaseClient()

  const { data: profileData } = await supabase
    .from('profiles')
    .select(`
      *,
      is_premium,
      is_nsfw,
      profile_background_url,
      profile_background_type,
      background_is_nsfw,
      profile_background_poster_url
    `)
    .eq('username', username.toLowerCase())
    // Supabase v2.102+ no longer accepts type arguments on .single().
    // Cast the result after the call instead.
    .single()

  const profile = profileData as Profile | null
  if (!profile) return null

  // Fetch sections for this profile
  // Profile sections are visible if:
  // - visible = true (shown on profile)
  // - No published/approval requirement for profile-only content
  // 
  // Note: The approval system gates GALLERY discovery, not personal profiles
  // Users can build their profile freely without moderation
  const { data: sections } = await supabase
    .from('sections')
    .select('*')
    .eq('profile_id', profile.id)
    .eq('visible', true)
    .order('position')

  // Fetch bookmarks if profile has public bookmarks enabled
  let bookmarks = null
  if (profile.bookmarks_public) {
    console.log('[getProfile] Fetching bookmarks for user_id:', profile.user_id)
    console.log('[getProfile] Profile data:', { id: profile.id, user_id: profile.user_id, bookmarks_public: profile.bookmarks_public })
    
    // Try to use service role client to bypass RLS (safe because we already checked bookmarks_public = true)
    // Falls back to anon client if service role key is not available
    const supabaseAdmin = getSupabaseServiceClient()
    const bookmarksClient = supabaseAdmin || supabase
    
    console.log('[getProfile] Using client:', supabaseAdmin ? 'service_role' : 'anon')
    
    // Step 1: Get bookmark IDs and section IDs
    const { data: bookmarkData, error: bookmarkError, count } = await bookmarksClient
      .from('bookmarks')
      .select('id, created_at, section_id, user_id', { count: 'exact' })
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(20)
    
    console.log('[getProfile] Bookmarks query result:', { 
      data: bookmarkData, 
      count, 
      error: bookmarkError,
      dataLength: bookmarkData?.length 
    })
    
    if (bookmarkError) {
      console.error('[getProfile] Error fetching bookmarks:', bookmarkError)
    }
    
    if (bookmarkData && bookmarkData.length > 0) {
      // Step 2: Fetch sections for these bookmarks
      const sectionIds = bookmarkData.map(b => b.section_id)
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select(`
          id,
          title,
          blocks,
          published,
          is_nsfw,
          category_id,
          created_at,
          updated_at,
          profile_id,
          categories(id, name, slug, icon)
        `)
        .in('id', sectionIds)
      
      console.log('[getProfile] Sections query result:', { count: sectionsData?.length, error: sectionsError })
      
      if (sectionsError) {
        console.error('[getProfile] Error fetching sections:', sectionsError)
      }
      
      if (sectionsData && sectionsData.length > 0) {
        // Step 3: Fetch profiles for these sections
        const profileIds = [...new Set(sectionsData.map(s => s.profile_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', profileIds)
        
        const profileMap = new Map(profilesData?.map(p => [p.id, p]) || [])
        const sectionMap = new Map(sectionsData.map(s => [s.id, s]))
        
        // Step 4: Combine everything
        bookmarks = bookmarkData.map((bookmark: any) => {
          const section = sectionMap.get(bookmark.section_id)
          if (!section) return null
          
          const profileData = profileMap.get(section.profile_id)
          
          return {
            id: section.id,
            title: section.title || 'Untitled',
            blocks: section.blocks || [],
            view_count: 0,
            published_at: section.created_at,
            is_nsfw: section.is_nsfw || false,
            creator: {
              username: profileData?.username || 'unknown',
              display_name: profileData?.display_name,
              avatar_url: profileData?.avatar_url,
            },
            category: {
              id: (section.categories as any)?.id || '',
              name: (section.categories as any)?.name || 'Uncategorized',
              slug: (section.categories as any)?.slug || 'uncategorized',
              icon: (section.categories as any)?.icon,
            },
          }
        }).filter(Boolean) // Remove any null entries
        
        console.log('[getProfile] Final bookmarks count:', bookmarks.length)
      }
    }
  }

  return { 
    profile, 
    sections: (sections as Section[]) || [],
    bookmarks: bookmarks || []
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const data = await getProfile(username)

  if (!data) {
    return {
      title: 'Profile Not Found - Roomlet',
      description: 'This profile does not exist.',
    }
  }

  const { profile, sections } = data
  const name = profile.display_name || profile.username
  const description = profile.bio || `Check out ${name}'s profile on Roomlet.`
  const profileUrl = `${SITE_URL}/${username}`
  const ogImage = `${SITE_URL}/${username}/opengraph-image`

  // Generate keywords from profile content
  const keywords = [
    'Roomlet',
    'personal profile',
    name,
    username,
    ...sections.slice(0, 3).map(s => s.title).filter(Boolean),
  ].join(', ')

  return {
    title: name,
    description,
    keywords,
    authors: [{ name }],
    creator: name,
    publisher: 'Roomlet',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: profileUrl,
    },
    openGraph: {
      title: name,
      description,
      url: profileUrl,
      siteName: 'Roomlet',
      locale: 'en_US',
      type: 'profile',
      images: [
        { 
          url: ogImage, 
          width: 1200, 
          height: 630, 
          alt: `${name}'s profile on Roomlet`,
          type: 'image/png',
        }
      ],
      ...(profile.display_name && {
        // @ts-ignore - OpenGraph profile extensions
        profile: {
          username: profile.username,
          ...(profile.display_name && { firstName: profile.display_name.split(' ')[0] }),
        }
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description,
      images: [ogImage],
      creator: `@${username}`,
    },
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const data = await getProfile(username)

  if (!data) notFound()

  const { profile, sections, bookmarks } = data
  const name = profile.display_name || profile.username
  const profileUrl = `${SITE_URL}/${username}`

  // JSON-LD structured data for better SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name,
      alternateName: profile.username,
      description: profile.bio || undefined,
      image: profile.avatar_url || undefined,
      url: profileUrl,
      sameAs: sections
        .flatMap(s => s.blocks || [])
        .filter((b: any) => b.type === 'links' && b.content?.links)
        .flatMap((b: any) => b.content.links.map((l: any) => l.url))
        .filter(Boolean)
        .slice(0, 5), // Include up to 5 social links
    },
    author: {
      '@type': 'Person',
      name,
      url: profileUrl,
    },
    dateModified: profile.updated_at || undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Roomlet',
      url: SITE_URL,
    },
  }

  return (
    <>
      {/* JSON-LD for structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileCard profile={profile} sections={sections} bookmarks={bookmarks} />
    </>
  )
}