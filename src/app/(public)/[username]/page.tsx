import { getSupabaseClient, getSupabaseServiceClient } from '@/shared/lib/supabase'
import { Profile, Section } from '@/shared/lib/types'
import ProfileCard from '@/features/profile/components/ProfileCard'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { resolveRenamedUsername } from '@/shared/lib/username-redirect'
import type { Metadata } from 'next'

// ISR: revalidate every 30 seconds. On-demand revalidation is triggered
// when sections are published/unpublished/deleted.
export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

interface PageProps {
  // In Next.js 15, params is a Promise — must be awaited.
  params: Promise<{ username: string }>
}

const getProfile = cache(async function getProfile(username: string) {
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
    
    // Try to use service role client to bypass RLS (safe because we already checked bookmarks_public = true)
    // Falls back to anon client if service role key is not available
    const supabaseAdmin = getSupabaseServiceClient()
    const bookmarksClient = supabaseAdmin || supabase
    
    // Step 1: Get bookmark IDs and section IDs
    const { data: bookmarkData, error: bookmarkError, count } = await bookmarksClient
      .from('bookmarks')
      .select('id, created_at, section_id, user_id', { count: 'exact' })
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .limit(20)
    
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
      }
    }
  }

  return { 
    profile, 
    sections: (sections as Section[]) || [],
    bookmarks: bookmarks || []
  }
})

/** Pull every external link a user has put on their profile (for sameAs / identity linking). */
function collectLinks(sections: Section[]): string[] {
  const urls = sections
    .flatMap((s) => s.blocks || [])
    .filter((b: any) => b.type === 'links' && b.content?.links)
    .flatMap((b: any) => b.content.links.map((l: any) => l?.url))
    .filter((u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
  return Array.from(new Set(urls)).slice(0, 15)
}

/** Build a description that says what the profile is about, even when the bio is empty. */
function buildDescription(name: string, username: string, bio: string | null | undefined, sections: Section[]) {
  const topics = sections.map((s) => s.title).filter(Boolean).slice(0, 4)
  const base = bio?.trim() || `${name} (@${username}) on Roomlet.`
  const suffix = topics.length ? ` Collections: ${topics.join(', ')}.` : ''
  return `${base}${suffix}`.slice(0, 300)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params
  const data = await getProfile(username)

  if (!data) {
    return {
      title: 'Profile Not Found',
      description: 'This profile does not exist.',
      robots: { index: false, follow: false },
    }
  }

  const { profile, sections } = data
  const name = profile.display_name || profile.username
  const description = buildDescription(name, profile.username, profile.bio, sections)
  const profileUrl = `${SITE_URL}/${profile.username}`
  const ogImage = `${SITE_URL}/${profile.username}/opengraph-image`

  // Title always carries BOTH display name and @username, so searches for either match.
  const title = profile.display_name && profile.display_name !== profile.username
    ? `${name} (@${profile.username})`
    : `@${profile.username}`

  const keywords = Array.from(new Set([
    name,
    profile.username,
    `${profile.username} Roomlet`,
    `${name} profile`,
    ...sections.slice(0, 6).map((s) => s.title).filter(Boolean),
  ]))

  // NSFW profiles must not be indexed.
  const indexable = !profile.is_nsfw

  return {
    title,
    description,
    keywords,
    authors: [{ name, url: profileUrl }],
    creator: name,
    publisher: 'Roomlet',
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } }
      : { index: false, follow: false },
    alternates: { canonical: profileUrl },
    openGraph: {
      title,
      description,
      url: profileUrl,
      siteName: 'Roomlet',
      locale: 'en_US',
      type: 'profile',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${name}'s profile on Roomlet`, type: 'image/png' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params
  const data = await getProfile(username)

  if (!data) {
    // A renamed profile's old URL keeps working: send visitors and crawlers to the new one.
    const renamedTo = await resolveRenamedUsername(username)
    if (renamedTo) permanentRedirect(`/${renamedTo}`)
    notFound()
  }

  const { profile, sections, bookmarks } = data
  const name = profile.display_name || profile.username
  const profileUrl = `${SITE_URL}/${profile.username}`
  const links = collectLinks(sections)
  const topics = sections.map((s) => s.title).filter(Boolean).slice(0, 8)

  // JSON-LD: Person + ProfilePage is what search engines and AI answer engines read
  // to connect a name / @handle to a real entity and its other accounts.
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      '@id': `${profileUrl}#profile`,
      url: profileUrl,
      name: `${name} (@${profile.username})`,
      dateModified: profile.updated_at || undefined,
      dateCreated: (profile as any).created_at || undefined,
      isPartOf: { '@type': 'WebSite', name: 'Roomlet', url: SITE_URL },
      mainEntity: {
        '@type': 'Person',
        '@id': `${profileUrl}#person`,
        name,
        alternateName: Array.from(new Set([profile.username, `@${profile.username}`])),
        identifier: profile.username,
        description: profile.bio || undefined,
        image: profile.avatar_url || undefined,
        url: profileUrl,
        knowsAbout: topics.length ? topics : undefined,
        sameAs: links.length ? links : undefined,
        interactionStatistic: undefined,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Roomlet', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Profiles', item: `${SITE_URL}/creators` },
        { '@type': 'ListItem', position: 3, name, item: profileUrl },
      ],
    },
  ]

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so user-supplied text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ProfileCard profile={profile} sections={sections} bookmarks={bookmarks} />
    </>
  )
}
