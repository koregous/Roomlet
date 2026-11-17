import { getSupabaseClient } from '@/shared/lib/supabase'
import { Profile, Section } from '@/shared/lib/types'
import { matchesSlug } from '@/shared/lib/slug'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import ViewTracker from '@/features/gallery/components/ViewTracker'
import ReportButton from '@/features/sections/components/ReportButton'
import ShareButton from '@/features/sections/components/ShareButton'
import BookmarkButton from '@/shared/components/BookmarkButton'
import { checkAdminRole } from '@/shared/lib/auth/admin-auth'

// Import block renderers
import TextBlock from '@/features/sections/components/blocks/TextBlock'
import ImageBlock from '@/features/sections/components/blocks/ImageBlock'
import GalleryBlock from '@/features/sections/components/blocks/GalleryBlock'
import CarouselBlock from '@/features/sections/components/blocks/CarouselBlock'
import QuoteBlock from '@/features/sections/components/blocks/QuoteBlock'
import DividerBlock from '@/features/sections/components/blocks/DividerBlock'
import LinksBlock from '@/features/sections/components/blocks/LinksBlock'
import AudioBlock from '@/features/sections/components/blocks/AudioBlock'
import EmbedBlock from '@/features/sections/components/blocks/EmbedBlock'

// ISR: revalidate every 60 seconds, matching the profile page.
export const revalidate = 60

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koregous.vercel.app'

interface PageProps {
  params: Promise<{ username: string; section: string }>
}

async function getProfileAndSection(username: string, sectionSlug: string) {
  const supabase = getSupabaseClient()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single()

  const profile = profileData as Profile | null
  if (!profile) return null

  const { data: sectionsData } = await supabase
    .from('sections')
    .select(`
      *,
      categories(id, name, slug)
    `)
    .eq('profile_id', profile.id)
    .eq('visible', true)
    .order('position')

  const sections = (sectionsData as Section[]) || []
  const activeSection = sections.find(
    s => matchesSlug(s.title, sectionSlug)
  )

  if (!activeSection) return null

  return { profile, sections, activeSection }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, section: sectionSlug } = await params
  const data = await getProfileAndSection(username, sectionSlug)

  if (!data) {
    return {
      title: 'Section Not Found - Roomlet',
      description: 'This section does not exist.',
    }
  }

  const { profile, activeSection } = data
  const name = profile.display_name || profile.username
  const sectionTitle = activeSection.title
  const description = `${sectionTitle} — ${name}'s collection on Roomlet.`
  const pageUrl = `${SITE_URL}/${username}/${sectionSlug}`
  const ogImage = `${SITE_URL}/${username}/${sectionSlug}/opengraph-image`

  // NSFW content should not be indexed by search engines
  const robotsDirective = activeSection.is_nsfw 
    ? 'noindex, nofollow' 
    : 'index, follow'

  return {
    title: `${sectionTitle} · ${name}`,
    description,
    robots: robotsDirective,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: `${sectionTitle} · ${name}`,
      description,
      url: pageUrl,
      siteName: 'Roomlet',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${sectionTitle} by ${name} on Roomlet`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${sectionTitle} · ${name}`,
      description,
      images: [ogImage],
      creator: `@${profile.username}`,
    },
  }
}

export default async function SectionPage({ params }: PageProps) {
  const { username, section: sectionSlug } = await params
  const data = await getProfileAndSection(username, sectionSlug)

  if (!data) notFound()

  const { profile, activeSection } = data
  const name = profile.display_name || profile.username
  const pageUrl = `${SITE_URL}/${username}/${sectionSlug}`

  // Check if current user is admin
  const adminCheck = await checkAdminRole()
  const userIsAdmin = adminCheck.isAdmin

  // JSON-LD structured data for the specific section
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: activeSection.title,
    description: `${activeSection.title} — ${name}'s collection on Roomlet.`,
    url: pageUrl,
    author: {
      '@type': 'Person',
      name,
      url: `${SITE_URL}/${username}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Roomlet',
      url: SITE_URL,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <div className="min-h-screen bg-black text-white">
        {/* Curator Header Card */}
        <div className="border-b border-gray-800 bg-gradient-to-b from-black to-gray-950">
          <div className="container mx-auto px-6 py-8 max-w-4xl">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              {profile.avatar_url && (
                <a href={`/${username}`} className="shrink-0 group">
                  <img
                    src={profile.avatar_url}
                    alt={name}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-gray-800 group-hover:ring-gray-600 transition"
                  />
                </a>
              )}
              
              {/* Curator Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <a 
                    href={`/${username}`}
                    className="text-2xl font-bold hover:text-gray-300 transition truncate"
                  >
                    {name}
                  </a>
                  <span className="text-gray-600">·</span>
                  <span className="text-gray-500 text-sm">@{profile.username}</span>
                </div>
                
                {profile.bio && (
                  <p className="text-gray-400 text-sm line-clamp-2">{profile.bio}</p>
                )}
              </div>

              {/* Share and Report Buttons */}
              <div className="shrink-0 flex gap-2">
                <BookmarkButton sectionId={activeSection.id} />
                <ShareButton 
                  sectionId={activeSection.id} 
                  title={activeSection.title} 
                  username={username}
                />
                <ReportButton sectionId={activeSection.id} userId={profile.id} />
              </div>
            </div>
          </div>
        </div>

        {/* Section Content */}
        <div className="container mx-auto px-6 py-12 max-w-4xl">
          {/* Section Title */}
          <h1 className="text-4xl font-serif mb-8">{activeSection.title}</h1>

          {/* Render all blocks from the section */}
          <div className="space-y-6">
            {activeSection.blocks.length === 0 ? (
              <p className="text-gray-500 text-center py-12">
                This section is empty.
              </p>
            ) : (
              activeSection.blocks
                .sort((a, b) => a.position - b.position)
                .map((block) => {
                  switch (block.type) {
                    case 'text':
                      return <TextBlock key={block.id} block={block} />
                    case 'image':
                      return <ImageBlock key={block.id} block={block} />
                    case 'gallery':
                      return <GalleryBlock key={block.id} block={block} />
                    case 'carousel':
                      return <CarouselBlock key={block.id} block={block} />
                    case 'quote':
                      return <QuoteBlock key={block.id} block={block} />
                    case 'divider':
                      return <DividerBlock key={block.id} block={block} />
                    case 'links':
                      return <LinksBlock key={block.id} block={block} />
                    case 'audio':
                      return <AudioBlock key={block.id} block={block} />
                    case 'embed':
                      return <EmbedBlock key={block.id} block={block} />
                    default:
                      return null
                  }
                })
            )}
          </div>

          {/* Back to Profile Link */}
          <div className="mt-16 pt-8 border-t border-gray-800 text-center">
            <a
              href={`/${username}`}
              className="text-gray-500 hover:text-white transition inline-flex items-center gap-2"
            >
              ← View all of {name}'s work
            </a>
          </div>
        </div>

        {/* Track view */}
        <ViewTracker sectionId={activeSection.id} />
      </div>
    </>
  )
}
